/**
 * NexCore AI Chat — RAG-powered conversational endpoint
 * POST /api/ai-chat
 *
 * Flow:
 *   1. Authenticate user via JWT
 *   2. Enforce daily rate limit (consume_ai_chat_use RPC)
 *   3. Generate query embedding via Gemini embedding model
 *   4. Semantic search over ai_knowledge via search_knowledge RPC
 *   5. Build context prompt and call Gemini for a response
 *   6. Return { reply, used, remaining }
 *
 * GET /api/ai-chat?usage=1
 *   Returns today's chat usage stats without consuming a use.
 */

const { createClient } = require('@supabase/supabase-js');
const { GoogleGenAI } = require('@google/genai');

// ─── Environment ──────────────────────────────────────────────────────────────
const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const GEMINI_API_KEY   = process.env.GEMINI_CHAT_API_KEY || process.env.GEMINI_API_KEY;

// Chat model — prefer flash for low latency / cost
const CHAT_MODEL      = process.env.GEMINI_CHAT_MODEL  || 'models/gemini-2.5-flash';
const EMBED_MODEL     = process.env.GEMINI_EMBED_MODEL || 'gemini-embedding-001';
const EMBED_DIMENSIONS = parseInt(process.env.GEMINI_EMBED_DIMENSIONS || '768', 10);
const DAILY_LIMIT     = parseInt(process.env.AI_CHAT_DAILY_LIMIT || '10', 10);
const CHAT_RETRY_DELAY_MS = parseInt(process.env.GEMINI_CHAT_RETRY_DELAY_MS || '1200', 10);

// Restrict CORS to this origin (set ALLOWED_ORIGIN env var in production)
const ALLOWED_ORIGIN  = process.env.ALLOWED_ORIGIN || '*';
// Per-minute burst limit per user (serverless-safe; resets per warm instance)
const MINUTE_LIMIT    = parseInt(process.env.AI_CHAT_MINUTE_LIMIT || '5', 10);

// Max characters we pass as context to Gemini (approx 6 000 tokens)
const MAX_CONTEXT_CHARS = 4000;
// Max characters in a user message
const MAX_MSG_CHARS     = 500;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Per-minute burst limiter (in-memory; effective within a single serverless instance)
const minuteMap = new Map(); // userId → { count, windowStart }

function checkMinuteLimit(userId) {
  const now   = Date.now();
  const entry = minuteMap.get(userId);
  if (!entry || now - entry.windowStart > 60_000) {
    minuteMap.set(userId, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= MINUTE_LIMIT) return false;
  entry.count++;
  return true;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  // Always return JSON
  res.setHeader('Content-Type', 'application/json');

  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── Validate environment ─────────────────────────────────────────────────
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !GEMINI_API_KEY) {
    console.error('[ai-chat] Missing env vars');
    return res.status(500).json({ error: 'Server misconfigured — missing environment variables' });
  }

  // ── Auth ─────────────────────────────────────────────────────────────────
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization token' });
  }
  const token = authHeader.split(' ')[1];

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    console.error('[ai-chat] Auth error:', authError?.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // ── Per-minute burst check (POST only) ───────────────────────────────────
  if (req.method === 'POST' && !checkMinuteLimit(user.id)) {
    return res.status(429).json({
      error: 'Too many requests',
      message: 'You are sending messages too quickly. Please wait a moment.'
    });
  }

  // ── GET: usage check ────────────────────────────────────────────────────────
  if (req.method === 'GET' && String(req.query?.usage || '').trim() === '1') {
    const { data, error } = await supabase.rpc('get_ai_chat_usage', { max_uses: DAILY_LIMIT });
    if (error) {
      console.error('[ai-chat] get_ai_chat_usage error:', error.message);
      return res.status(500).json({ error: 'Failed to fetch usage', details: error.message });
    }
    return res.status(200).json(data);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Parse and validate request body ─────────────────────────────────────
  const body = req.body || {};
  const rawMessage = String(body.message || '').trim();

  if (!rawMessage) {
    return res.status(400).json({ error: 'Missing required field: message' });
  }

  // Sanitize: truncate oversized input, strip null bytes
  const userMessage = rawMessage.replace(/\0/g, '').slice(0, MAX_MSG_CHARS);

  // Optional project context passed from project.html
  const projectContext = body.projectContext
    ? {
        title:       String(body.projectContext.title       || '').slice(0, 200),
        description: String(body.projectContext.description || '').slice(0, 800)
      }
    : null;
  // Conversation history from the client (sanitized)
  const rawHistory = Array.isArray(body.history) ? body.history : [];
  const history = rawHistory
    .slice(-12)
    .filter(h => h && (h.role === 'user' || h.role === 'ai') && typeof h.text === 'string')
    .map(h => ({
      role:  h.role === 'ai' ? 'model' : 'user',
      parts: [{ text: String(h.text).replace(/\0/g, '').slice(0, MAX_MSG_CHARS) }]
    }));
  // ── Rate limit ───────────────────────────────────────────────────────────
  const { data: usageData, error: usageError } = await supabase.rpc('consume_ai_chat_use', {
    max_uses: DAILY_LIMIT
  });

  if (usageError) {
    console.error('[ai-chat] consume_ai_chat_use error:', usageError.message);
    if (usageError.message?.includes('daily limit reached')) {
      return res.status(429).json({
        error: 'Daily chat limit reached',
        message: `You have used all ${DAILY_LIMIT} AI chat messages for today. Try again tomorrow.`,
        remaining: 0
      });
    }
    return res.status(500).json({ error: 'Failed to check usage limit', details: usageError.message });
  }

  const used      = usageData?.used      ?? 0;
  const remaining = usageData?.remaining ?? 0;

  // ── Gemini clients ───────────────────────────────────────────────────────
  const genAi = new GoogleGenAI({ apiKey: GEMINI_API_KEY, httpOptions: { apiVersion: 'v1' } });
  const embedAi = new GoogleGenAI({ apiKey: GEMINI_API_KEY, httpOptions: { apiVersion: 'v1beta' } });

  // ── Step 1: Generate embedding for the user query ────────────────────────
  let queryEmbedding = null;
  try {
    const embedResult = await embedAi.models.embedContent({
      model: EMBED_MODEL,
      contents: userMessage,
      config: {
        outputDimensionality: EMBED_DIMENSIONS,
        taskType: 'RETRIEVAL_QUERY'
      }
    });

    // Defensive extraction — handles different SDK response shapes
    queryEmbedding =
      embedResult?.embeddings?.[0]?.values ||
      embedResult?.embedding?.values       ||
      null;

    if (!queryEmbedding || !Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      throw new Error('Embedding values missing from Gemini response');
    }
  } catch (embedErr) {
    console.error('[ai-chat] Embedding error:', embedErr.message);
    // Non-fatal fallback: if embeddings fail, continue without RAG context.
    queryEmbedding = null;
  }

  // ── Step 2: Semantic search — retrieve top-5 knowledge chunks ────────────
  let knowledgeChunks = [];
  try {
    if (!queryEmbedding) {
      knowledgeChunks = [];
    } else {
      const { data: chunks, error: searchError } = await supabase.rpc('search_knowledge', {
        query_embedding: queryEmbedding,
        match_count: 5
      });

      if (searchError) throw new Error(searchError.message);
      knowledgeChunks = chunks || [];
    }
  } catch (searchErr) {
    console.error('[ai-chat] Search error:', searchErr.message);
    // Non-fatal: continue with empty context rather than failing the request
  }

  // ── Step 3: Build context string from retrieved chunks ───────────────────
  let contextBlock = '';
  if (knowledgeChunks.length > 0) {
    const parts = knowledgeChunks.map(c =>
      `[${c.source.toUpperCase()}] ${c.title}\n${c.content}`
    );
    contextBlock = parts.join('\n\n').slice(0, MAX_CONTEXT_CHARS);
  }

  // ── Step 4: Build the final prompt ──────────────────────────────────────
  let systemInstruction = `You are the NexCore AI Assistant — a focused assistant exclusively for the NexCore Labs platform. NexCore Labs is a project-showcasing platform for Sultan Qaboos University (SQU) students in Oman.

## STRICT SCOPE — topics you are allowed to answer:
- NexCore Labs: platform features, how to submit or view projects, accounts, AI tools, FAQs
- SQU (Sultan Qaboos University): colleges, programs, admission, grading, campus life
- Student projects listed on NexCore Labs (use the search_projects or get_project_details tools for live data)
- Direct follow-up questions that relate to the above topics

## HARD RULES — never break these:
- If a question is outside the allowed scope, reply ONLY with: "I can only help with NexCore Labs and SQU topics. Is there something about the platform or university I can assist with?"
- Do NOT answer general coding help, world events, science, math, opinions, or anything unrelated — even if the user insists
- Do NOT make up project names, statistics, or features — use your tools to fetch live data when needed
- Keep every answer under 150 words. Be direct — no lengthy intros or filler text
- Format with **bold** for key terms; use bullet lists only for 3 or more items`;

  if (projectContext) {
    systemInstruction += `\n\nThe user is currently viewing this project:\nTitle: ${projectContext.title}\nDescription: ${projectContext.description}\nYou may reference this project when answering questions about it.`;
  }

  // Append RAG context directly to the current user turn
  const userTurn = contextBlock
    ? `${userMessage}\n\n[Relevant knowledge for this question]\n${contextBlock}`
    : userMessage;

  // Build multi-turn contents: prior history + current user message
  const contents = [
    ...history,
    { role: 'user', parts: [{ text: userTurn }] }
  ];

  // ── Tool declarations for function calling ────────────────────────────────
  const tools = [{
    functionDeclarations: [
      {
        name: 'search_projects',
        description: 'Search published student projects on NexCore Labs by keyword. Use when asked about specific projects, categories, or discovering projects on the platform.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query:    { type: 'STRING',  description: 'Search term matched against project name and description' },
            category: { type: 'STRING',  description: 'Optional category filter (e.g. "AI", "Web Development")' },
            limit:    { type: 'INTEGER', description: 'Max results to return (default 5, max 8)' }
          },
          required: ['query']
        }
      },
      {
        name: 'get_project_details',
        description: 'Get full public details of a specific project by its URL slug. Use when a user asks about a particular named project.',
        parameters: {
          type: 'OBJECT',
          properties: {
            slug: { type: 'STRING', description: 'The URL slug of the project to look up' }
          },
          required: ['slug']
        }
      },
      {
        name: 'get_platform_stats',
        description: 'Get live NexCore Labs statistics: total published project count and the 3 most recent projects. Use when asked "how many projects are there?" or similar platform-wide questions.',
        parameters: { type: 'OBJECT', properties: {} }
      }
    ]
  }];

  // ── Tool executor (uses user-auth Supabase client — RLS enforced) ─────────
  const executeTool = async (name, args) => {
    try {
      if (name === 'search_projects') {
        const limit = Math.min(parseInt(args.limit || 5, 10), 8);
        let q = supabase
          .from('projects')
          .select('name, slug, description, category')
          .eq('published', true)
          .limit(limit);
        if (args.query) {
          q = q.or(`name.ilike.%${args.query}%,description.ilike.%${args.query}%`);
        }
        if (args.category) {
          q = q.ilike('category', `%${args.category}%`);
        }
        const { data } = await q;
        return {
          results: (data || []).map(p => ({
            name:        p.name,
            slug:        p.slug,
            description: (p.description || '').slice(0, 200),
            category:    p.category
          })),
          count: (data || []).length
        };
      }

      if (name === 'get_project_details') {
        const { data } = await supabase
          .from('projects')
          .select('name, slug, description, category, website, github_url')
          .eq('slug', String(args.slug || '').slice(0, 100))
          .eq('published', true)
          .maybeSingle();
        if (!data) return { error: 'Project not found' };
        return {
          name:        data.name,
          slug:        data.slug,
          description: (data.description || '').slice(0, 500),
          category:    data.category,
          website:     data.website    || null,
          github_url:  data.github_url || null
        };
      }

      if (name === 'get_platform_stats') {
        const [countRes, newestRes] = await Promise.all([
          supabase.from('projects').select('*', { count: 'exact', head: true }).eq('published', true),
          supabase.from('projects').select('name, slug, category').eq('published', true)
            .order('created_at', { ascending: false }).limit(3)
        ]);
        return {
          total_projects:  countRes.count ?? 0,
          newest_projects: newestRes.data || []
        };
      }
    } catch (toolErr) {
      console.error(`[ai-chat] Tool "${name}" error:`, toolErr.message);
      return { error: 'Tool execution failed' };
    }
    return { error: 'Unknown tool' };
  };

  // ── Helper: single Gemini call with 503 retry ─────────────────────────────
  const callGemini = async (opts) => {
    try {
      return await genAi.models.generateContent(opts);
    } catch (firstErr) {
      const msg = String(firstErr?.message || '');
      const isUnavailable =
        msg.includes('"code":503') ||
        msg.includes('UNAVAILABLE') ||
        msg.toLowerCase().includes('high demand');
      if (!isUnavailable) throw firstErr;
      console.warn('[ai-chat] Gemini high demand, retrying once...');
      await sleep(CHAT_RETRY_DELAY_MS);
      return await genAi.models.generateContent(opts);
    }
  };

  const genOpts = {
    model: CHAT_MODEL,
    systemInstruction,
    tools,
    generationConfig: { temperature: 0.4, maxOutputTokens: 350, topP: 0.85 }
  };

  // ── Step 5: Agentic loop — Gemini calls tools until it has a final reply ──
  let replyText;
  try {
    let genResult;
    const MAX_TOOL_ROUNDS = 3;

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      genResult = await callGemini({ ...genOpts, contents });
      const part = genResult?.candidates?.[0]?.content?.parts?.[0];

      // No function call → final text answer
      if (!part?.functionCall) break;

      if (round === MAX_TOOL_ROUNDS) {
        console.warn('[ai-chat] Tool round cap reached');
        break;
      }

      const { name, args } = part.functionCall;
      console.log(`[ai-chat] Tool call: ${name}`, args);
      const toolResult = await executeTool(name, args);

      // Append model function-call turn + tool result for next iteration
      contents.push({ role: 'model', parts: [{ functionCall: { name, args } }] });
      contents.push({
        role: 'user',
        parts: [{ functionResponse: { name, response: { result: toolResult } } }]
      });
    }

    replyText =
      genResult?.text ||
      genResult?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!replyText) {
      throw new Error('Gemini returned empty response');
    }
  } catch (genErr) {
    console.error('[ai-chat] Gemini generation error:', genErr.message);
    const genMsg = String(genErr?.message || '');

    if (genMsg.includes('429') || genMsg.toLowerCase().includes('quota')) {
      return res.status(503).json({
        error: 'AI temporarily unavailable',
        message: 'The AI service is at capacity. Please try again in a moment.'
      });
    }

    if (
      genMsg.includes('"code":503') ||
      genMsg.includes('UNAVAILABLE') ||
      genMsg.toLowerCase().includes('high demand')
    ) {
      return res.status(503).json({
        error: 'AI temporarily unavailable',
        message: 'The AI model is under high demand right now. Please retry in a few seconds.'
      });
    }

    return res.status(500).json({
      error: 'AI generation failed',
      details: genErr.message
    });
  }

  // ── Return success ───────────────────────────────────────────────────────
  return res.status(200).json({
    reply:     replyText.trim(),
    used,
    remaining,
    max:       DAILY_LIMIT,
    sources:   knowledgeChunks.map(c => ({ title: c.title, source: c.source }))
  });
};
