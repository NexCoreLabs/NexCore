/**
 * POST /api/receipt-url
 *
 * Admin-only endpoint. Returns a short-lived signed URL for a receipt
 * stored in the private "payment-receipts" Supabase Storage bucket.
 *
 * The browser anon key cannot generate signed URLs for private buckets,
 * so this endpoint uses the service role key server-side.
 *
 * Required env vars:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Body: { path }   — storage path, e.g. "2026/05/1234567890_a3f9c2.jpg"
 */

const { getSupabaseAdmin } = require("../lib/supabaseAdmin");

// Matches: YYYY/MM/timestamp_6hexchars.ext
const RECEIPT_PATH_RE = /^\d{4}\/\d{2}\/\d+_[a-f0-9]{6}\.[a-z0-9]+$/;

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  // ── Authenticate caller (must be an admin) ──────────────────────────────────
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer "))
    return res.status(401).json({ error: "Authentication required." });

  const token = authHeader.slice(7);
  const supabase = getSupabaseAdmin();

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user)
    return res.status(401).json({ error: "Invalid or expired token." });

  const { data: adminRecord } = await supabase
    .from("admins")
    .select("email")
    .eq("email", user.email)
    .maybeSingle();

  if (!adminRecord)
    return res.status(403).json({ error: "Admin access required." });

  // ── Validate path ───────────────────────────────────────────────────────────
  const { path } = req.body || {};

  if (!path || typeof path !== "string" || !RECEIPT_PATH_RE.test(path.trim()))
    return res.status(400).json({ error: "Invalid receipt path." });

  // ── Generate signed URL (service role — 10 minutes) ────────────────────────
  const { data, error } = await supabase.storage
    .from("payment-receipts")
    .createSignedUrl(path.trim(), 600);

  if (error || !data?.signedUrl) {
    console.error("Signed URL error:", error);
    return res.status(500).json({ error: "Could not generate receipt URL." });
  }

  return res.status(200).json({ url: data.signedUrl });
};
