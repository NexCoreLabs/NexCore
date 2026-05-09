/**
 * NexCore AI — combined serverless endpoint
 *
 * AI Assist (project actions):
 *   GET  /api/ai?usage=1            → fetch daily assist quota (no consume)
 *   POST /api/ai                    → run action (improve_page | card_summary | project_insights)
 *
 * AI Chat (RAG conversational):
 *   GET  /api/ai?usage=1&chat=1     → fetch daily chat quota (no consume)
 *   POST /api/ai?chat=1             → RAG-powered chat reply
 */

const { createClient } = require('@supabase/supabase-js');
const { GoogleGenAI } = require('@google/genai');

// ─── Shared environment ────────────────────────────────────────────────────────
const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const GEMINI_API_KEY    = process.env.GEMINI_API_KEY;

// ─── Assist config ─────────────────────────────────────────────────────────────
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'models/gemini-2.5-flash';

// ─── Chat config ───────────────────────────────────────────────────────────────
// Feature flag — set to true to block all chat requests
const CHAT_DISABLED   = true;

const CHAT_API_KEY    = process.env.GEMINI_CHAT_API_KEY || GEMINI_API_KEY;
const CHAT_MODEL      = process.env.GEMINI_CHAT_MODEL   || 'models/gemini-2.5-flash';
const EMBED_MODEL     = process.env.GEMINI_EMBED_MODEL  || 'gemini-embedding-001';
const EMBED_DIMENSIONS = parseInt(process.env.GEMINI_EMBED_DIMENSIONS || '768', 10);
const DAILY_LIMIT     = parseInt(process.env.AI_CHAT_DAILY_LIMIT || '10', 10);
const CHAT_RETRY_DELAY_MS = parseInt(process.env.GEMINI_CHAT_RETRY_DELAY_MS || '1200', 10);
const ALLOWED_ORIGIN  = process.env.ALLOWED_ORIGIN || '*';
const MINUTE_LIMIT    = parseInt(process.env.AI_CHAT_MINUTE_LIMIT || '5', 10);
const MAX_CONTEXT_CHARS = 4000;
const MAX_MSG_CHARS     = 500;
const MAX_REPLY_WORDS   = parseInt(process.env.AI_CHAT_MAX_REPLY_WORDS || '75', 10);
const OUT_OF_SCOPE_REPLY = 'I can only help with NexCore Labs topics. Ask me about the platform, features, or student projects.';
const NO_EVIDENCE_REPLY  = 'I do not have verified NexCore data for that yet. Please ask about a specific feature or project, and I will use available records.';

// ─── Chat helpers ──────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeText(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function containsAny(text, words) {
  return words.some(w => text.includes(w));
}

function isFollowUpLike(text) {
  const short = text.length <= 60;
  const followUpTokens = [
    'this', 'that', 'it', 'they', 'them', 'those', 'these',
    'more', 'details', 'explain', 'how about', 'and what about', 'why'
  ];
  return short && containsAny(text, followUpTokens);
}

function inferScope(userMessage, rawHistory, hasProjectContext) {
  const text = normalizeText(userMessage);
  const nexcoreKeywords = [
    'nexcore', 'platform', 'project', 'publish', 'submission', 'student project',
    'feature', 'roadmap', 'hub', 'account', 'faq', 'release', 'labs'
  ];
  if (containsAny(text, nexcoreKeywords)) return 'nexcore_scope';
  if (hasProjectContext) return 'nexcore_scope';
  if (isFollowUpLike(text) && Array.isArray(rawHistory)) {
    const recentUserTexts = rawHistory
      .slice(-6)
      .filter(h => h && h.role === 'user' && typeof h.text === 'string')
      .map(h => normalizeText(h.text));
    if (recentUserTexts.some(t => containsAny(t, nexcoreKeywords))) return 'nexcore_scope';
  }
  return 'out_of_scope';
}

function isTrustedKnowledgeSource(source) {
  const s = normalizeText(source);
  if (!s) return false;
  return [
    'nexcore', 'project', 'faq', 'roadmap', 'release', 'hub', 'policy',
    'privacy', 'terms', 'student'
  ].some(k => s.includes(k));
}

function relevanceScore(query, chunk) {
  const qTokens = normalizeText(query).split(/[^a-z0-9]+/).filter(t => t.length >= 3);
  if (qTokens.length === 0) return isTrustedKnowledgeSource(chunk?.source) ? 1 : 0;
  const hay = normalizeText(`${chunk?.title || ''} ${chunk?.content || ''} ${chunk?.source || ''}`);
  let score = 0;
  for (const tok of qTokens) {
    if (hay.includes(tok)) score++;
  }
  return score;
}

function trimReplyWords(text, maxWords) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return String(text || '').trim();
  return `${words.slice(0, maxWords).join(' ')}...`;
}

function pickLexicalChunks(query, rows, max = 5) {
  return (rows || [])
    .map(r => ({ ...r, _score: relevanceScore(query, r) }))
    .filter(r => r._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, max)
    .map(({ _score, ...rest }) => rest);
}

async function getChatUsageSnapshot(supabase) {
  const { data, error } = await supabase.rpc('get_ai_chat_usage', { max_uses: DAILY_LIMIT });
  if (error) {
    console.error('[ai-chat] get_ai_chat_usage error:', error.message);
    return { used: 0, remaining: 0, max: DAILY_LIMIT };
  }
  return {
    used:      data?.used      ?? 0,
    remaining: data?.remaining ?? 0,
    max:       data?.max       ?? DAILY_LIMIT
  };
}

// Per-minute burst limiter (in-memory; effective within a single serverless instance)
const minuteMap = new Map();

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

// ─── Chat handler ──────────────────────────────────────────────────────────────
async function handleChat(req, res, supabase, user) {
  if (CHAT_DISABLED) {
    return res.status(503).json({
      error: 'AI Chat is temporarily disabled',
      message: 'The NexCore AI Chat is currently paused. Please check back later.'
    });
  }

  // Per-minute burst check (POST only)
  if (req.method === 'POST' && !checkMinuteLimit(user.id)) {
    return res.status(429).json({
      error: 'Too many requests',
      message: 'You are sending messages too quickly. Please wait a moment.'
    });
  }

  // GET: usage check
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

  // Parse and validate body
  const body        = req.body || {};
  const rawMessage  = String(body.message || '').trim();
  if (!rawMessage) {
    return res.status(400).json({ error: 'Missing required field: message' });
  }

  const userMessage = rawMessage.replace(/\0/g, '').slice(0, MAX_MSG_CHARS);

  const projectContext = body.projectContext
    ? {
        title:       String(body.projectContext.title       || '').slice(0, 200),
        description: String(body.projectContext.description || '').slice(0, 800)
      }
    : null;

  const scope = inferScope(userMessage, body.history, Boolean(projectContext));
  if (scope === 'out_of_scope') {
    const usage = await getChatUsageSnapshot(supabase);
    return res.status(200).json({
      reply:     OUT_OF_SCOPE_REPLY,
      used:      usage.used,
      remaining: usage.remaining,
      max:       usage.max,
      sources:   [{ title: 'Scope Policy', source: 'nexcore_policy' }]
    });
  }

  const rawHistory = Array.isArray(body.history) ? body.history : [];
  const history = rawHistory
    .slice(-12)
    .filter(h => h && (h.role === 'user' || h.role === 'ai' || h.role === 'model') && typeof h.text === 'string')
    .map(h => ({
      role:  (h.role === 'ai' || h.role === 'model') ? 'model' : 'user',
      parts: [{ text: String(h.text).replace(/\0/g, '').slice(0, MAX_MSG_CHARS) }]
    }));

  // Rate limit
  const { data: usageData, error: usageError } = await supabase.rpc('consume_ai_chat_use', {
    max_uses: DAILY_LIMIT
  });

  if (usageError) {
    console.error('[ai-chat] consume_ai_chat_use error:', usageError.message);
    if (usageError.message?.includes('daily limit reached')) {
      return res.status(429).json({
        error:   'Daily chat limit reached',
        message: `You have used all ${DAILY_LIMIT} AI chat messages for today. Try again tomorrow.`,
        remaining: 0
      });
    }
    return res.status(500).json({ error: 'Failed to check usage limit', details: usageError.message });
  }

  const used      = usageData?.used      ?? 0;
  const remaining = usageData?.remaining ?? 0;

  // Gemini clients
  const genAi   = new GoogleGenAI({ apiKey: CHAT_API_KEY, httpOptions: { apiVersion: 'v1' } });
  const embedAi = new GoogleGenAI({ apiKey: CHAT_API_KEY, httpOptions: { apiVersion: 'v1beta' } });

  // Step 1: Generate query embedding
  let queryEmbedding = null;
  try {
    const embedResult = await embedAi.models.embedContent({
      model:    EMBED_MODEL,
      contents: userMessage,
      config: {
        outputDimensionality: EMBED_DIMENSIONS,
        taskType: 'RETRIEVAL_QUERY'
      }
    });
    queryEmbedding =
      embedResult?.embeddings?.[0]?.values ||
      embedResult?.embedding?.values       ||
      null;
    if (!queryEmbedding || !Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      throw new Error('Embedding values missing from Gemini response');
    }
  } catch (embedErr) {
    console.error('[ai-chat] Embedding error:', embedErr.message);
    queryEmbedding = null;
  }

  // Step 2: Semantic search
  let knowledgeChunks    = [];
  let usedLexicalFallback = false;
  try {
    if (queryEmbedding) {
      const { data: chunks, error: searchError } = await supabase.rpc('search_knowledge', {
        query_embedding: queryEmbedding,
        match_count: 5
      });
      if (searchError) throw new Error(searchError.message);
      knowledgeChunks = (chunks || [])
        .map(c => ({ ...c, _score: relevanceScore(userMessage, c) }))
        .filter(c => c._score >= 2 || (isTrustedKnowledgeSource(c.source) && c._score >= 1))
        .sort((a, b) => b._score - a._score)
        .slice(0, 5)
        .map(({ _score, ...rest }) => rest);
    }
  } catch (searchErr) {
    console.error('[ai-chat] Search error:', searchErr.message);
  }

  // Lexical fallback
  if (knowledgeChunks.length === 0) {
    try {
      const { data: rows, error: fallbackError } = await supabase
        .from('ai_knowledge')
        .select('title, content, source')
        .in('source', ['nexcore', 'project'])
        .limit(120);
      if (fallbackError) throw new Error(fallbackError.message);
      knowledgeChunks     = pickLexicalChunks(userMessage, rows, 5);
      usedLexicalFallback = knowledgeChunks.length > 0;
    } catch (fallbackErr) {
      console.error('[ai-chat] Lexical fallback error:', fallbackErr.message);
    }
  }

  // Step 3: Build context string
  let contextBlock = '';
  if (knowledgeChunks.length > 0) {
    contextBlock = knowledgeChunks
      .map(c => `[${c.source.toUpperCase()}] ${c.title}\n${c.content}`)
      .join('\n\n')
      .slice(0, MAX_CONTEXT_CHARS);
  }

  // Step 4: System instruction
  let systemInstruction = `You are the NexCore AI Assistant — a focused, concise assistant exclusively for NexCore Labs.

## STRICT SCOPE — topics you are allowed to answer:
- NexCore Labs: platform features, how to submit or view projects, accounts, AI tools, FAQs
- Student projects listed on NexCore Labs (use the search_projects or get_project_details tools for live data)
- Direct follow-up questions that relate to the above topics

## HARD RULES — never break these:
- Do NOT answer general coding help, world events, science, math, opinions, or anything unrelated
- Use only evidence from:
  1) [Relevant knowledge for this question] context
  2) Tool results from search_projects/get_project_details/get_platform_stats
  3) Explicit projectContext passed by the client
- If evidence is insufficient, reply EXACTLY: "${NO_EVIDENCE_REPLY}" (in the user's language if not English)
- Do NOT invent project names, numbers, dates, or features

## TOOL USAGE — use tools proactively:
- When asked about "projects", "list projects", "how many projects", "show projects" → ALWAYS use get_platform_stats or search_projects
- When asked about a specific project by name → use search_projects or get_project_details
- Never say "I don't have access" — try the tools first, they have database access
- If tools return no results, then say data is unavailable

## RESPONSE STYLE — be extremely concise:
- Answer in 1-2 direct sentences maximum
- No explanations of your limitations or what you can't access unless specifically asked
- No preambles like "I understand..." or "Let me explain..."
- If you need to use tools (search_projects, get_platform_stats), use them and give the direct answer
- When listing items, use proper markdown: start each item on a new line with "- " or use **bold** for emphasis
- Avoid inline asterisks like "can: * item" — use line breaks instead
- Be helpful but brief — every word counts

## LANGUAGE — multilingual support:
- Detect the language of the user's message
- Respond in the SAME language as the user's question
- If the user asks in Arabic, respond in Arabic; if English, respond in English
- Keep technical terms in English (e.g., "NexCore Labs", "Hub", "API", "GitHub")
- Keep product/feature names in English for consistency
- Support all major languages: Arabic, English, French, Spanish, etc.`;

  if (projectContext) {
    systemInstruction += `\n\nThe user is currently viewing this project:\nTitle: ${projectContext.title}\nDescription: ${projectContext.description}\nYou may reference this project when answering questions about it.`;
  }

  const userTurn = contextBlock
    ? `${userMessage}\n\n[Relevant knowledge for this question]\n${contextBlock}`
    : userMessage;

  const contents = [
    ...history,
    { role: 'user', parts: [{ text: userTurn }] }
  ];

  // Tool declarations
  const tools = [{
    functionDeclarations: [
      {
        name: 'search_projects',
        description: 'Search published student projects on NexCore Labs by keyword.',
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
        description: 'Get full public details of a specific project by its URL slug.',
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
        description: 'Get live NexCore Labs statistics: total published project count and the 3 most recent projects.',
        parameters: { type: 'OBJECT', properties: {} }
      }
    ]
  }];

  // Tool executor (RLS-enforced via user-auth Supabase client)
  const toolEvidence = [];
  const executeTool = async (name, args) => {
    try {
      if (name === 'search_projects') {
        const limit = Math.min(parseInt(args.limit || 5, 10), 8);
        let q = supabase
          .from('projects')
          .select('name, slug, description, category')
          .eq('published', true)
          .limit(limit);
        if (args.query)    q = q.or(`name.ilike.%${args.query}%,description.ilike.%${args.query}%`);
        if (args.category) q = q.ilike('category', `%${args.category}%`);
        const { data } = await q;
        if ((data || []).length > 0) toolEvidence.push(`search_projects:${(data || []).length}`);
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
        toolEvidence.push('get_project_details:1');
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
        toolEvidence.push('get_platform_stats:1');
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

  // Helper: single Gemini call with 503 retry
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

  // Step 5: Agentic loop
  let replyText;
  try {
    let genResult;
    const MAX_TOOL_ROUNDS = 3;
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      genResult = await callGemini({ ...genOpts, contents });
      const part = genResult?.candidates?.[0]?.content?.parts?.[0];
      if (!part?.functionCall) break;
      if (round === MAX_TOOL_ROUNDS) { console.warn('[ai-chat] Tool round cap reached'); break; }

      const { name, args } = part.functionCall;
      console.log(`[ai-chat] Tool call: ${name}`, args);
      const toolResult = await executeTool(name, args);
      contents.push({ role: 'model', parts: [{ functionCall: { name, args } }] });
      contents.push({ role: 'user', parts: [{ functionResponse: { name, response: { result: toolResult } } }] });
    }

    replyText =
      genResult?.text ||
      genResult?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!replyText) throw new Error('Gemini returned empty response');
  } catch (genErr) {
    console.error('[ai-chat] Gemini generation error:', genErr.message);
    const genMsg = String(genErr?.message || '');
    if (genMsg.includes('429') || genMsg.toLowerCase().includes('quota')) {
      return res.status(503).json({
        error:   'AI temporarily unavailable',
        code:    'quota_exhausted',
        message: 'The AI service is at capacity. Please try again in a moment.'
      });
    }
    if (genMsg.includes('"code":503') || genMsg.includes('UNAVAILABLE') || genMsg.toLowerCase().includes('high demand')) {
      return res.status(503).json({
        error:   'AI temporarily unavailable',
        code:    'model_busy',
        message: 'The AI model is under high demand right now. Please retry in a few seconds.'
      });
    }
    return res.status(500).json({ error: 'AI generation failed', details: genErr.message });
  }

  // Return success
  const hasEvidence = Boolean(projectContext) || knowledgeChunks.length > 0 || toolEvidence.length > 0;
  const finalReply  = hasEvidence ? trimReplyWords(replyText, MAX_REPLY_WORDS) : NO_EVIDENCE_REPLY;

  return res.status(200).json({
    reply:          finalReply,
    used,
    remaining,
    max:            DAILY_LIMIT,
    sources:        knowledgeChunks.map(c => ({ title: c.title, source: c.source })),
    retrieval_mode: usedLexicalFallback ? 'lexical_fallback' : 'vector'
  });
}

// ─── Assist handler ────────────────────────────────────────────────────────────
async function handleAssist(req, res, supabase, user) {
  const usageQuery = String(req.query?.usage || '').trim();
  if (req.method === 'GET' && usageQuery === '1') {
    const { data: usageData, error: usageError } = await supabase.rpc('get_ai_usage', { max_uses: 3 });
    if (usageError) {
      console.error('Usage RPC error:', usageError);
      return res.status(500).json({ error: 'Failed to fetch AI usage', details: usageError.message });
    }
    const used      = Number(usageData?.used ?? usageData?.use_count ?? 0);
    const remaining = Number(usageData?.remaining ?? Math.max(0, 3 - used));
    return res.status(200).json({
      used:      Number.isNaN(used)      ? 0 : used,
      remaining: Number.isNaN(remaining) ? 0 : remaining,
      max: 3
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('AI user:', user.id);

  const { action, text, style } = req.body;

  if (!action || !text) {
    return res.status(400).json({ error: 'Missing required fields: action, text' });
  }

  if (!['improve_page', 'card_summary', 'project_insights'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action. Must be improve_page, card_summary, or project_insights' });
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc('consume_ai_use', { max_uses: 3 });

  if (rpcError) {
    console.error('RPC error:', rpcError);
    if (rpcError.message && rpcError.message.includes('AI daily limit reached')) {
      return res.status(429).json({
        error:     'AI daily limit reached',
        remaining: 0,
        message:   'You have reached your daily limit of 3 AI actions. Try again tomorrow.'
      });
    }
    return res.status(500).json({ error: 'Failed to check AI usage limit', details: rpcError.message });
  }

  const used      = Number(rpcData || 0);
  const remaining = Math.max(0, 3 - used);
  console.log('AI used:', used, 'remaining:', remaining);

  let prompt = '';
  if (action === 'improve_page') {
    const styleGuide = {
      Professional: 'Rewrite this in a professional, polished tone suitable for business and academic audiences.',
      Shorter:      'Make this more concise and to the point. Remove redundancy while keeping key information.',
      Technical:    'Rewrite this with a technical focus, emphasizing technical details and capabilities.',
      Inspiring:    'Make this more inspiring and motivational, highlighting vision and impact.'
    };
    const styleInstruction = styleGuide[style] || styleGuide.Professional;
    prompt = `${styleInstruction}

RULES:
- Do NOT invent achievements, affiliations, or facts
- Only restructure and rewrite what is already provided
- Keep the output to 200-300 words maximum
- Maintain accuracy and authenticity
- Output plain text only, no markdown formatting

Original text:
${text}`;
  } else if (action === 'card_summary') {
    prompt = `Create a brief, engaging 1-2 sentence summary (60-80 words max) suitable for a project card display. 

RULES:
- Do NOT invent information
- Only summarize what is provided
- Focus on the most important aspects
- Make it concise and appealing
- Output plain text only, no markdown formatting

Source text:
${text}`;
  } else if (action === 'project_insights') {
    prompt = `Generate a short summary (1-2 sentences, 50-80 words) that describes the project's name and the core of what it provides, based on the description.

Return a JSON object with:
- "summary": the summary text
- "insights": [] (empty array)

RULES:
- Include the project's name in the summary
- Focus on what the project provides or its core functionality
- Be concise and informative
- Output ONLY valid JSON, no markdown, no code fences, no extra text

Project name: ${req.body.project_name || ''}
Project description:
${text}`;
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  console.log('Using model:', GEMINI_MODEL);

  let result;
  try {
    result = await ai.models.generateContent({
      model:    GEMINI_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature:     0.7,
        maxOutputTokens: action === 'card_summary' ? 150 : 500
      }
    });
  } catch (geminiErr) {
    console.error('Gemini API error:', geminiErr?.message || geminiErr);
    if (geminiErr?.message?.includes('429') || geminiErr?.message?.includes('quota')) {
      return res.status(503).json({ error: 'AI temporarily unavailable', details: 'Quota exceeded. Try later.', model: GEMINI_MODEL });
    }
    return res.status(500).json({ error: 'Gemini API failed', details: geminiErr?.message || String(geminiErr), model: GEMINI_MODEL });
  }

  const generatedText = result?.text || '';
  if (!generatedText) {
    console.error('No result from Gemini');
    return res.status(500).json({ error: 'No response generated from AI' });
  }

  if (action === 'project_insights') {
    try {
      const cleaned = generatedText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      const parsed  = JSON.parse(cleaned);
      return res.status(200).json({
        summary:  parsed.summary || '',
        insights: Array.isArray(parsed.insights) ? parsed.insights : [],
        used,
        remaining
      });
    } catch (parseErr) {
      console.error('Failed to parse project_insights JSON:', parseErr, generatedText);
      return res.status(500).json({ error: 'AI returned invalid JSON for project insights' });
    }
  }

  return res.status(200).json({ text: generatedText.trim(), used, remaining });
}

// ─── Main handler ──────────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  try {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // Validate env vars
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !GEMINI_API_KEY) {
      console.error('Missing env vars:', { hasSupabaseUrl: !!SUPABASE_URL, hasSupabaseKey: !!SUPABASE_ANON_KEY, hasGeminiKey: !!GEMINI_API_KEY });
      return res.status(500).json({ error: 'Server misconfigured', details: 'Missing SUPABASE_URL, SUPABASE_ANON_KEY, or GEMINI_API_KEY' });
    }

    // Auth
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
      console.error('Auth error:', authError?.message);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Route: ?chat=1 → chat handler, otherwise → assist handler
    if (String(req.query?.chat || '') === '1') {
      return await handleChat(req, res, supabase, user);
    }
    return await handleAssist(req, res, supabase, user);

  } catch (err) {
    console.error('AI endpoint crash:', err);
    if (err?.message?.includes('429') || err?.message?.includes('quota')) {
      return res.status(503).json({ error: 'AI temporarily unavailable', details: 'Quota exceeded. Try later.' });
    }
    return res.status(500).json({ error: 'Gemini API failed', details: err?.message || String(err) });
  }
};
