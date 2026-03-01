// Temporary endpoint to discover available Gemini models
// GET /api/models
// Lists all available models from Google Gemini API
// DELETE after confirming working model in /api/ai.js

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'Gemini API key not configured',
        details: 'Missing GEMINI_API_KEY environment variable'
      });
    }

    console.log('📋 Fetching available Gemini models...');

    // Call Gemini API to list models
    const modelsResponse = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models',
      {
        method: 'GET',
        headers: {
          'x-goog-api-key': GEMINI_API_KEY
        }
      }
    );

    if (!modelsResponse.ok) {
      const errText = await modelsResponse.text();
      console.error('Models API error:', {
        status: modelsResponse.status,
        error: errText.substring(0, 300)
      });
      return res.status(modelsResponse.status).json({
        error: 'Failed to fetch available models',
        status: modelsResponse.status,
        details: errText.substring(0, 200)
      });
    }

    const modelsData = await modelsResponse.json();
    
    console.log('✅ Available models:', {
      count: modelsData.models?.length || 0,
      models: modelsData.models?.map(m => ({
        name: m.name,
        displayName: m.displayName,
        description: m.description?.substring(0, 100) || 'N/A'
      })) || []
    });

    // Return models list with detailed info
    return res.status(200).json({
      success: true,
      count: modelsData.models?.length || 0,
      models: modelsData.models || [],
      // Helpful suggestions
      recommended: modelsData.models
        ?.filter(m => m.name.includes('gemini'))
        ?.slice(0, 5)
        ?.map(m => m.name) || [],
      // Format for env var (just the model names)
      suggestions: [
        'Use GEMINI_MODEL env var in /api/ai with one of these values:',
        ...(modelsData.models?.map(m => m.name) || []).slice(0, 10)
      ]
    });

  } catch (error) {
    console.error('❌ Models endpoint error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: String(error?.message || error)
    });
  }
};
