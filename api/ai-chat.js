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

// Max characters we pass as context to Gemini (approx 6 000 tokens)
const MAX_CONTEXT_CHARS = 4000;
// Max characters in a user message
const MAX_MSG_CHARS     = 500;

// ─── Main handler ─────────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  // Always return JSON
  res.setHeader('Content-Type', 'application/json');

  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
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

  // ── GET: usage check ─────────────────────────────────────────────────────
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
  let systemContext = `You are the NexCore AI Assistant — a helpful, knowledgeable assistant for the NexCore Labs platform. NexCore Labs is a project-showcasing platform for Sultan Qaboos University (SQU) students in Oman.

Your personality:
- Friendly, clear, and concise
- Always honest — if you don't know something, say so
- Focus on NexCore platform features, SQU information, and student projects
- Keep answers under 250 words unless a longer answer is clearly needed
- Use plain text (no markdown syntax like ** or ## in the body)`;

  if (projectContext) {
    systemContext += `\n\nThe user is currently viewing this project:
Title: ${projectContext.title}
Description: ${projectContext.description}
You may reference this project when answering questions about it.`;
  }

  const contextSection = contextBlock
    ? `\n\nRelevant knowledge retrieved for this question:\n---\n${contextBlock}\n---`
    : '';

  const fullPrompt = `${systemContext}${contextSection}

User question: ${userMessage}

Answer:`;

  // ── Step 5: Call Gemini for the final response ───────────────────────────
  let replyText;
  try {
    const genResult = await genAi.models.generateContent({
      model: CHAT_MODEL,
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature: 0.65,
        maxOutputTokens: 512,
        topP: 0.9
      }
    });

    replyText = genResult?.text || genResult?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!replyText) {
      throw new Error('Gemini returned empty response');
    }
  } catch (genErr) {
    console.error('[ai-chat] Gemini generation error:', genErr.message);

    if (genErr.message?.includes('429') || genErr.message?.includes('quota')) {
      return res.status(503).json({
        error: 'AI temporarily unavailable',
        message: 'The AI service is at capacity. Please try again in a moment.'
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
