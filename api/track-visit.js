// Vercel serverless function to track daily page visits in Supabase
const { getSupabaseAdmin } = require("../lib/supabaseAdmin");

function getTodayUTCDateString() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { page_path } = req.body || {};
    if (!page_path || typeof page_path !== "string" || page_path.length > 200) {
      return res.status(400).json({ error: "Invalid page_path" });
    }

    const day = getTodayUTCDateString();

    const { data: existing, error: selectErr } = await supabaseAdmin
      .from("page_visits_daily")
      .select("visits")
      .eq("day", day)
      .eq("page_path", page_path)
      .maybeSingle();

    if (selectErr) throw selectErr;

    if (!existing) {
      const { error: insertErr } = await supabaseAdmin
        .from("page_visits_daily")
        .insert({ day, page_path, visits: 1 });

      if (insertErr) throw insertErr;
      return res.status(200).json({ ok: true, visits: 1, day, page_path });
    }

    const newCount = Number(existing.visits || 0) + 1;

    const { error: updateErr } = await supabaseAdmin
      .from("page_visits_daily")
      .update({ visits: newCount, updated_at: new Date().toISOString() })
      .eq("day", day)
      .eq("page_path", page_path);

    if (updateErr) throw updateErr;

    return res.status(200).json({ ok: true, visits: newCount, day, page_path });
  } catch (e) {
    // send the message back so we can debug faster
    return res.status(500).json({ error: "Server error", details: String(e?.message || e) });
  }
};