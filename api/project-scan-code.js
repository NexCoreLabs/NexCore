const { getSupabaseAdmin } = require('../lib/supabaseAdmin');
const { buildProjectScanCode } = require('../lib/projectScanCode');
const { generateBarHeights } = require('../lib/waveCode');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { slug } = req.body || {};
  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ ok: false, error: 'slug is required' });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: project, error } = await supabase
      .from('projects')
      .select('id, slug, public_id')
      .eq('slug', slug.trim())
      .eq('published', true)
      .single();

    if (error || !project) {
      return res.status(404).json({ ok: false, error: 'Project not found' });
    }

    const scan_code  = buildProjectScanCode(project);
    const bar_heights = generateBarHeights(project.id);
    return res.status(200).json({ ok: true, scan_code_version: 'NXC1', scan_code, bar_heights });
  } catch (err) {
    console.error('[project-scan-code] error:', err.message);
    const isSecretError = (err.message || '').includes('SCANNER_CODE_SECRET');
    return res.status(500).json({
      ok: false,
      error: isSecretError ? 'Scanner secret is not configured' : 'Internal server error'
    });
  }
};
