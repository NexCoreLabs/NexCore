// Vercel serverless endpoint for AI Assist powered by Google Gemini
// Enforces 3 AI actions per user per day via Supabase RPC

const { createClient } = require('@supabase/supabase-js');
const { GoogleGenAI } = require('@google/genai');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

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

    // Only POST method is supported
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
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

    console.log('AI user:', user.id);

    // Parse request body
    const { action, text, style } = req.body;

    if (!action || !text) {
      return res.status(400).json({ error: 'Missing required fields: action, text' });
    }

    // Validate action
    if (!['improve_page', 'card_summary'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be improve_page or card_summary' });
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
    }

    // Initialize GoogleGenAI client
    const ai = new GoogleGenAI({
      apiKey: GEMINI_API_KEY
    });

    console.log('Using Gemini model:', GEMINI_MODEL);

    // Call Gemini API using SDK
    const result = await ai.models.generateContent({
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

    // Extract generated text safely
    const generatedText = result?.text || '';

    if (!generatedText) {
      console.error('No result from Gemini');
      return res.status(500).json({ error: 'No response generated from AI' });
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
    return res.status(500).json({
      error: 'Gemini API failed',
      details: err?.message || String(err)
    });
  }
};
