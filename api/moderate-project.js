const { createClient } = require('@supabase/supabase-js');
const { GoogleGenAI } = require('@google/genai');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'models/gemini-2.5-flash';

const ALLOWED_CATEGORIES = [
  'hate',
  'harassment',
  'sexual',
  'self_harm',
  'violence',
  'illegal',
  'extremism',
  'spam',
  'other'
];

const BLOCK_WORDS = [
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'bastard',
  'slut',
  'whore',
  'nigger',
  'faggot'
];

function setCors(res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
}

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function clampConfidence(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return 0;
  if (num < 0) return 0;
  if (num > 1) return 1;
  return num;
}

function parseJsonSafe(raw) {
  if (!raw || typeof raw !== 'string') return null;

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

function collectProjectText(project) {
  return [
    project?.name,
    project?.slug,
    project?.card_description,
    project?.page_description,
    project?.website,
    project?.x_url,
    project?.instagram_url,
    project?.github_url,
    project?.linkedin_url
  ]
    .filter(Boolean)
    .join('\n');
}

function runRuleModeration(projectText) {
  const normalized = normalizeText(projectText);
  const hitWords = BLOCK_WORDS.filter((word) => {
    const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'i');
    return re.test(normalized);
  });

  const urlMatches = normalized.match(/https?:\/\//g) || [];
  const repeatedPunct = /(.)\1{7,}/.test(normalized);
  const repeatedWords = /\b(\w+)\b(?:\W+\1\b){5,}/i.test(normalized);
  const excessiveCaps = (projectText || '').replace(/[^A-Z]/g, '').length > 80;

  const spamSignals = [];
  if (urlMatches.length >= 5) spamSignals.push('too_many_urls');
  if (repeatedPunct) spamSignals.push('repeated_characters');
  if (repeatedWords) spamSignals.push('repeated_words');
  if (excessiveCaps) spamSignals.push('excessive_caps');

  if (hitWords.length > 0) {
    return {
      decision: 'blocked',
      categories: ['other'],
      confidence: 0.99,
      reason: `Blocked by rules: prohibited language detected (${hitWords.slice(0, 5).join(', ')}).`,
      layer: 'rules',
      rule_hits: {
        bad_words: hitWords,
        spam_signals: spamSignals
      }
    };
  }

  if (spamSignals.length > 0) {
    return {
      decision: 'blocked',
      categories: ['spam'],
      confidence: 0.95,
      reason: `Blocked by rules: spam patterns detected (${spamSignals.join(', ')}).`,
      layer: 'rules',
      rule_hits: {
        bad_words: hitWords,
        spam_signals: spamSignals
      }
    };
  }

  return {
    decision: 'approved',
    categories: [],
    confidence: 0.5,
    reason: 'No rule violations detected.',
    layer: 'rules',
    rule_hits: {
      bad_words: [],
      spam_signals: []
    }
  };
}

function buildGeminiPrompt(project, action) {
  const payload = {
    action,
    project: {
      id: project?.id,
      name: project?.name || '',
      slug: project?.slug || '',
      card_description: project?.card_description || '',
      page_description: project?.page_description || '',
      website: project?.website || '',
      x_url: project?.x_url || '',
      instagram_url: project?.instagram_url || '',
      github_url: project?.github_url || '',
      linkedin_url: project?.linkedin_url || ''
    },
    allowed_categories: ALLOWED_CATEGORIES,
    output_contract: {
      decision: 'approved|blocked|review',
      categories: 'array of categories',
      confidence: 'number between 0 and 1',
      reason: 'short, user-facing reason'
    }
  };

  return [
    'You are a strict content moderation classifier for a public project platform.',
    'Evaluate safety/compliance risk and decide if this content should be publicly published.',
    'Return JSON ONLY. Do not include markdown, code fences, commentary, or extra keys.',
    'The response must be a single JSON object with exactly these keys:',
    '{"decision":"approved|blocked|review","categories":["hate|harassment|sexual|self_harm|violence|illegal|extremism|spam|other"],"confidence":0.0,"reason":"..."}',
    'Guidelines:',
    '- Use "blocked" for clearly disallowed harmful content.',
    '- Use "review" for borderline, ambiguous, or context-sensitive cases (including educational context around sensitive topics).',
    '- Use "approved" for benign content.',
    '- Keep reason concise and plain language.',
    '- confidence must be numeric from 0 to 1.',
    '',
    'Input:',
    JSON.stringify(payload)
  ].join('\n');
}

async function runGeminiModeration(project, action) {
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const prompt = buildGeminiPrompt(project, action);

  const result = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 250,
      responseMimeType: 'application/json'
    }
  });

  const rawText = (result?.text || '').trim();
  const parsed = parseJsonSafe(rawText);

  if (!parsed || typeof parsed !== 'object') {
    return {
      decision: 'review',
      categories: ['other'],
      confidence: 0.3,
      reason: 'AI moderation response could not be parsed. Sent to review.',
      raw: rawText
    };
  }

  const decision = ['approved', 'blocked', 'review'].includes(parsed.decision)
    ? parsed.decision
    : 'review';

  const categories = Array.isArray(parsed.categories)
    ? parsed.categories.filter((c) => ALLOWED_CATEGORIES.includes(c))
    : [];

  return {
    decision,
    categories,
    confidence: clampConfidence(parsed.confidence),
    reason: String(parsed.reason || 'Reviewed by AI moderation.'),
    raw: rawText
  };
}

function resolvePublishState({ requestPublish, decision, currentPublished }) {
  if (!requestPublish) {
    return !!currentPublished;
  }

  return decision === 'approved';
}

module.exports = async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !GEMINI_API_KEY || !GEMINI_MODEL) {
      return res.status(500).json({
        error: 'server_misconfigured',
        details: 'Missing one of: SUPABASE_URL, SUPABASE_ANON_KEY, GEMINI_API_KEY, GEMINI_MODEL'
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

    const { project_id, action = 'publish_check', request_publish = false } = req.body || {};

    if (!project_id) {
      return res.status(400).json({ error: 'missing_project_id' });
    }

    if (!['publish_check', 'edit_check'].includes(action)) {
      return res.status(400).json({ error: 'invalid_action' });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', project_id)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'project_not_found_or_forbidden' });
    }

    const projectText = collectProjectText(project);
    if (!projectText.trim()) {
      const nowIso = new Date().toISOString();
      const approvedPublished = resolvePublishState({
        requestPublish: !!request_publish,
        decision: 'approved',
        currentPublished: project.is_published
      });

      const { data: updatedEmpty, error: updateEmptyErr } = await supabase
        .from('projects')
        .update({
          moderation_status: 'approved',
          moderation_reason: 'No content provided; approved by default.',
          last_moderated_at: nowIso,
          is_published: approvedPublished,
          updated_at: nowIso
        })
        .eq('id', project.id)
        .select('*')
        .single();

      if (updateEmptyErr) {
        return res.status(500).json({ error: 'failed_to_update_project', details: updateEmptyErr.message });
      }

      return res.status(200).json({
        ok: true,
        decision: 'approved',
        categories: [],
        confidence: 0.7,
        reason: 'No content provided; approved by default.',
        is_published: updatedEmpty.is_published,
        moderation_status: updatedEmpty.moderation_status,
        moderation_reason: updatedEmpty.moderation_reason
      });
    }

    const ruleResult = runRuleModeration(projectText);

    let finalResult;
    let aiResult = null;

    if (ruleResult.decision === 'blocked') {
      finalResult = {
        decision: 'blocked',
        categories: ruleResult.categories,
        confidence: ruleResult.confidence,
        reason: ruleResult.reason
      };
    } else {
      try {
        aiResult = await runGeminiModeration(project, action);
        finalResult = {
          decision: aiResult.decision,
          categories: aiResult.categories,
          confidence: aiResult.confidence,
          reason: aiResult.reason
        };
      } catch (aiError) {
        finalResult = {
          decision: 'review',
          categories: ['other'],
          confidence: 0.2,
          reason: 'AI moderation unavailable. Sent to review.'
        };
      }
    }

    const nowIso = new Date().toISOString();
    const nextIsPublished = resolvePublishState({
      requestPublish: !!request_publish,
      decision: finalResult.decision,
      currentPublished: project.is_published
    });

    const { data: updatedProject, error: updateError } = await supabase
      .from('projects')
      .update({
        moderation_status: finalResult.decision,
        moderation_reason: finalResult.reason,
        last_moderated_at: nowIso,
        is_published: nextIsPublished,
        updated_at: nowIso
      })
      .eq('id', project.id)
      .select('*')
      .single();

    if (updateError || !updatedProject) {
      return res.status(500).json({
        error: 'failed_to_update_project',
        details: updateError?.message || 'Unknown update error'
      });
    }

    try {
      await supabase.from('moderation_logs').insert({
        project_id: project.id,
        user_id: user.id,
        action,
        decision: finalResult.decision,
        categories: finalResult.categories,
        confidence: finalResult.confidence,
        reason: finalResult.reason,
        request_publish: !!request_publish,
        rule_hits: ruleResult.rule_hits,
        ai_raw: aiResult?.raw || null,
        created_at: nowIso
      });
    } catch (logErr) {
      console.warn('moderation log insert failed:', logErr?.message || logErr);
    }

    return res.status(200).json({
      ok: true,
      decision: finalResult.decision,
      categories: finalResult.categories,
      confidence: finalResult.confidence,
      reason: finalResult.reason,
      is_published: updatedProject.is_published,
      moderation_status: updatedProject.moderation_status,
      moderation_reason: updatedProject.moderation_reason,
      last_moderated_at: updatedProject.last_moderated_at
    });
  } catch (err) {
    return res.status(500).json({
      error: 'moderation_failed',
      details: err?.message || String(err)
    });
  }
};
