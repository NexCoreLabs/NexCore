const { createClient } = require('@supabase/supabase-js');
const { GoogleGenAI } = require('@google/genai');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODERATION_MODEL = process.env.GEMINI_MODEL || 'models/gemini-2.5-flash';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
}

function parseJsonSafe(raw) {
  if (typeof raw !== 'string') return null;

  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function clampRiskScore(value) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 0;
  if (numeric < 0) return 0;
  if (numeric > 1) return 1;
  return numeric;
}

function normalizeModerationResult(rawResult) {
  const safe = Boolean(rawResult?.safe);
  const riskScore = clampRiskScore(rawResult?.risk_score);
  const reason = String(rawResult?.reason || (safe ? 'clean academic project' : 'contains content that may violate guidelines'));

  return {
    safe,
    risk_score: riskScore,
    reason: reason.slice(0, 500)
  };
}

function buildModerationPrompt({ title, description }) {
  return `You are a strict content moderation AI for a university innovation platform.

Analyze the following project content and determine if it contains:

- hate speech
- harassment
- sexual content
- illegal activity
- unethical instructions
- dangerous activities
- spam or promotional abuse

Return ONLY JSON in this format:

{
 "safe": true,
 "risk_score": 0.0,
 "reason": "clean academic project"
}

If the content is inappropriate return:

{
 "safe": false,
 "risk_score": 0.8,
 "reason": "contains harassment or unethical instructions"
}

PROJECT TITLE:
${title}

PROJECT DESCRIPTION:
${description}`;
}

async function moderateWithGemini({ title, description }) {
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  const response = await ai.models.generateContent({
    model: MODERATION_MODEL,
    contents: [{ role: 'user', parts: [{ text: buildModerationPrompt({ title, description }) }] }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 200,
      responseMimeType: 'application/json'
    }
  });

  const rawText = (response?.text || '').trim();
  const parsed = parseJsonSafe(rawText);

  if (!parsed || typeof parsed !== 'object') {
    return {
      safe: false,
      risk_score: 1,
      reason: 'Malformed moderation response from AI'
    };
  }

  return normalizeModerationResult(parsed);
}

function validateModerationInput(body) {
  const title = String(body?.title || '').trim();
  const description = String(body?.description || '').trim();

  if (!title) {
    return { ok: false, error: 'missing_title' };
  }

  if (!description) {
    return { ok: false, error: 'missing_description' };
  }

  if (title.length > 200) {
    return { ok: false, error: 'title_too_long' };
  }

  if (description.length > 5000) {
    return { ok: false, error: 'description_too_long' };
  }

  return { ok: true, title, description };
}

module.exports = async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'server_misconfigured',
        details: 'Missing SUPABASE_URL, SUPABASE_ANON_KEY, or GEMINI_API_KEY'
      });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'missing_or_invalid_authorization' });
    }

    const token = authHeader.slice('Bearer '.length).trim();
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'invalid_or_expired_token' });
    }

    const validated = validateModerationInput(req.body || {});
    if (!validated.ok) {
      return res.status(400).json({ error: validated.error });
    }

    const { title, description } = validated;
    const projectId = req.body?.project_id || null;
    const requestPublish = Boolean(req.body?.request_publish);
    const nowIso = new Date().toISOString();

    let moderation;
    try {
      moderation = await moderateWithGemini({ title, description });
    } catch (geminiError) {
      console.error('Gemini moderation error:', geminiError?.message || geminiError);
      moderation = {
        safe: false,
        risk_score: 1,
        reason: 'Moderation service unavailable'
      };
    }

    const moderationStatus = moderation.safe ? 'approved' : 'flagged';

    if (projectId) {
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id, owner_user_id, published')
        .eq('id', projectId)
        .single();

      if (projectError || !project || project.owner_user_id !== user.id) {
        return res.status(404).json({ error: 'project_not_found_or_forbidden' });
      }

      const nextPublished = requestPublish ? moderation.safe : Boolean(project.published);

      const { error: projectUpdateError } = await supabase
        .from('projects')
        .update({
          moderation_status: moderationStatus,
          moderation_reason: moderation.reason,
          last_moderated_at: nowIso,
          published: nextPublished,
          updated_at: nowIso
        })
        .eq('id', projectId);

      if (projectUpdateError) {
        return res.status(500).json({
          error: 'failed_to_update_project',
          details: projectUpdateError.message
        });
      }

      const { error: moderationInsertError } = await supabase.from('project_moderation').insert({
        project_id: projectId,
        moderation_status: moderationStatus,
        flagged_reason: moderation.reason,
        ai_score: moderation.risk_score,
        created_at: nowIso
      });

      if (moderationInsertError) {
        return res.status(500).json({
          error: 'failed_to_save_moderation',
          details: moderationInsertError.message
        });
      }
    }

    return res.status(200).json({
      safe: moderation.safe,
      risk_score: moderation.risk_score,
      reason: moderation.reason
    });
  } catch (err) {
    return res.status(500).json({
      error: 'moderation_failed',
      details: err?.message || String(err)
    });
  }
};
