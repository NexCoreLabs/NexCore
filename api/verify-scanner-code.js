const { getSupabaseAdmin } = require('../lib/supabaseAdmin');
const { verifyProjectScanCode } = require('../lib/projectScanCode');

// In-memory rate limiting: 60 requests per IP per 60-second window
const rateLimitMap = new Map();
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > RATE_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return false;
  }
  entry.count++;
  rateLimitMap.set(ip, entry);
  return entry.count > RATE_LIMIT;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ valid: false, error: 'Method not allowed' });
  }

  const clientIp = (
    req.headers['x-forwarded-for'] || req.socket?.remoteAddress || ''
  ).split(',')[0].trim();

  if (isRateLimited(clientIp)) {
    return res.status(429).json({ valid: false, error: 'Too many requests' });
  }

  const { scan_code } = req.body || {};
  if (!scan_code || typeof scan_code !== 'string') {
    return res.status(400).json({ valid: false, error: 'scan_code is required' });
  }

  const result = verifyProjectScanCode(scan_code);
  if (!result.ok) {
    return res.status(200).json({ valid: false, error: 'Invalid code' });
  }

  const { payload } = result;

  try {
    const supabase = getSupabaseAdmin();
    const { data: project, error } = await supabase
      .from('projects')
      .select('id, slug, public_id, name')
      .eq('id', payload.project_id)
      .eq('published', true)
      .single();

    if (error || !project) {
      return res.status(200).json({ valid: false, error: 'Project not found or not published' });
    }

    // Log scan event (best-effort — never block the response)
    supabase
      .from('project_scan_events')
      .insert({
        project_id: project.id,
        scanner_payload: JSON.stringify(payload),
        ip_address: clientIp,
        user_agent: req.headers['user-agent'] || null
      })
      .then(() => {})
      .catch(() => {});

    const redirect_url = `/project.html?slug=${encodeURIComponent(project.slug)}`;
    return res.status(200).json({
      valid: true,
      project: { id: project.id, slug: project.slug, public_id: project.public_id, name: project.name },
      redirect_url
    });
  } catch (err) {
    console.error('[verify-scanner-code] error:', err.message);
    return res.status(500).json({ valid: false, error: 'Internal server error' });
  }
};
