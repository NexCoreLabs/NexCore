// Vercel serverless endpoint for AI Assist powered by Google Gemini
// Enforces 3 AI actions per user per day via Supabase RPC

const { createClient } = require('@supabase/supabase-js');
const { GoogleGenAI } = require('@google/genai');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'models/gemini-2.5-flash';

module.exports = async (req, res) => {
  // Top-level try/catch to ensure we always return JSON
  try {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Validate environment variables
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !GEMINI_API_KEY) {
      console.error('Missing env vars:', {
        hasSupabaseUrl: !!SUPABASE_URL,
        hasSupabaseKey: !!SUPABASE_ANON_KEY,
        hasGeminiKey: !!GEMINI_API_KEY
      });
      return res.status(500).json({
        error: 'Server misconfigured',
        details: 'Missing SUPABASE_URL, SUPABASE_ANON_KEY, or GEMINI_API_KEY'
      });
    }

    // Extract JWT from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization token' });
    }

    const token = authHeader.split(' ')[1];

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });

    // Verify user token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError?.message);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const usageQuery = String(req.query?.usage || '').trim();
    if (req.method === 'GET' && usageQuery === '1') {
      const { data: usageData, error: usageError } = await supabase.rpc('get_ai_usage', {
        max_uses: 3
      });

      if (usageError) {
        console.error('Usage RPC error:', usageError);
        return res.status(500).json({
          error: 'Failed to fetch AI usage',
          details: usageError.message
        });
      }

      const used = Number(
        usageData?.used ??
        usageData?.use_count ??
        0
      );
      const remaining = Number(
        usageData?.remaining ??
        Math.max(0, 3 - used)
      );

      return res.status(200).json({
        used: Number.isNaN(used) ? 0 : used,
        remaining: Number.isNaN(remaining) ? 0 : remaining,
        max: 3
      });
    }

    // Only POST method is supported for generation
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    console.log('AI user:', user.id);

    // Parse request body
    const { action, text, style } = req.body;

    if (!action || !text) {
      return res.status(400).json({ error: 'Missing required fields: action, text' });
    }

    // Validate action
    if (!['improve_page', 'card_summary', 'project_insights'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be improve_page, card_summary, or project_insights' });
    }

    // Consume AI usage (enforces 3/day limit)
    const { data: rpcData, error: rpcError } = await supabase.rpc('consume_ai_use', {
      max_uses: 3
    });

    if (rpcError) {
      console.error('RPC error:', rpcError);
      
      // Check if it's the daily limit error
      if (rpcError.message && rpcError.message.includes('AI daily limit reached')) {
        return res.status(429).json({ 
          error: 'AI daily limit reached', 
          remaining: 0,
          message: 'You have reached your daily limit of 3 AI actions. Try again tomorrow.'
        });
      }
      
      return res.status(500).json({ 
        error: 'Failed to check AI usage limit',
        details: rpcError.message 
      });
    }

    // RPC returns integer count of uses, calculate remaining
    const used = Number(rpcData || 0);
    const remaining = Math.max(0, 3 - used);

    console.log('AI used:', used, 'remaining:', remaining);

    // Build prompt based on action
    let prompt = '';
    
    if (action === 'improve_page') {
      const styleGuide = {
        Professional: 'Rewrite this in a professional, polished tone suitable for business and academic audiences.',
        Shorter: 'Make this more concise and to the point. Remove redundancy while keeping key information.',
        Technical: 'Rewrite this with a technical focus, emphasizing technical details and capabilities.',
        Inspiring: 'Make this more inspiring and motivational, highlighting vision and impact.'
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
      prompt = `Analyze the following project and return a JSON object with two fields:
1. "summary": A 2-3 sentence paragraph summarizing what this project is about (80-120 words).
2. "insights": An array of 3-5 short bullet strings, each starting with a label like "Focus area:", "Category:", "Potential impact:", "Tech stack:", or "Target audience:".

RULES:
- Do NOT invent information or facts not present in the description
- Be concise and informative
- Output ONLY valid JSON, no markdown, no code fences, no extra text

Project name: ${req.body.project_name || ''}
Project description:
${text}`;
    }

    // Initialize GoogleGenAI client
    const ai = new GoogleGenAI({
      apiKey: GEMINI_API_KEY
    });

    console.log('Using model:', GEMINI_MODEL);

    // Call Gemini API using SDK
    let result;
    try {
      result = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: action === 'card_summary' ? 150 : 500
        }
      });
    } catch (geminiErr) {
      console.error('Gemini API error:', geminiErr?.message || geminiErr);
      
      // Check for quota exceeded (429)
      if (geminiErr?.message?.includes('429') || geminiErr?.message?.includes('quota')) {
        return res.status(503).json({
          error: 'AI temporarily unavailable',
          details: 'Quota exceeded. Try later.',
          model: GEMINI_MODEL
        });
      }
      
      // Other Gemini errors
      return res.status(500).json({
        error: 'Gemini API failed',
        details: geminiErr?.message || String(geminiErr),
        model: GEMINI_MODEL
      });
    }

    // Extract generated text safely
    const generatedText = result?.text || '';

    if (!generatedText) {
      console.error('No result from Gemini');
      return res.status(500).json({ error: 'No response generated from AI' });
    }

    // For project_insights, parse and return structured JSON
    if (action === 'project_insights') {
      try {
        // Strip possible markdown code fences
        const cleaned = generatedText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
        const parsed = JSON.parse(cleaned);
        return res.status(200).json({
          summary: parsed.summary || '',
          insights: Array.isArray(parsed.insights) ? parsed.insights : [],
          used,
          remaining
        });
      } catch (parseErr) {
        console.error('Failed to parse project_insights JSON:', parseErr, generatedText);
        return res.status(500).json({ error: 'AI returned invalid JSON for project insights' });
      }
    }

    // Return success with usage stats
    return res.status(200).json({
      text: generatedText.trim(),
      used,
      remaining
    });

  } catch (err) {
    // Top-level error handler - ensures we always return JSON
    console.error('AI endpoint crash:', err);
    
    // Handle quota exceeded at top level
    if (err?.message?.includes('429') || err?.message?.includes('quota')) {
      return res.status(503).json({
        error: 'AI temporarily unavailable',
        details: 'Quota exceeded. Try later.'
      });
    }
    
    return res.status(500).json({
      error: 'Gemini API failed',
      details: err?.message || String(err)
    });
  }
};
