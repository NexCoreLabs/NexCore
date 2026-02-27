// Vercel serverless endpoint for AI Assist powered by Google Gemini
// Enforces 3 AI actions per user per day via Supabase RPC

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Gemini API endpoint
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

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
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('consume_ai_use', {
      max_uses: 3
    });

    if (rpcError) {
      // Check if it's the daily limit error
      if (rpcError.message && rpcError.message.includes('AI daily limit reached')) {
        return res.status(429).json({ 
          error: 'AI daily limit reached', 
          remaining: 0,
          message: 'You have reached your daily limit of 3 AI actions. Try again tomorrow.'
        });
      }
      
      console.error('RPC error:', rpcError);
      return res.status(500).json({ error: 'Failed to check AI usage limit' });
    }

    // rpcData contains { used: number, remaining: number }
    const { used, remaining } = rpcData || { used: 0, remaining: 3 };

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

    // Call Gemini API
    const geminiResponse = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: action === 'card_summary' ? 150 : 500
        }
      })
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      return res.status(500).json({ 
        error: 'Failed to generate AI response',
        details: 'The AI service is temporarily unavailable'
      });
    }

    const geminiData = await geminiResponse.json();
    
    // Extract generated text
    const result = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!result) {
      return res.status(500).json({ error: 'No response generated from AI' });
    }

    // Return success with usage stats
    return res.status(200).json({
      result: result.trim(),
      used,
      remaining
    });

  } catch (error) {
    console.error('AI endpoint error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}
