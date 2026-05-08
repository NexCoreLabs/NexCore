/**
 * GET /api/check-email-order?email=...
 *
 * Returns whether the given email already has a pending or active
 * subscription order. Used client-side to prevent duplicate submissions
 * before opening the PayPal popup or submitting the WhatsApp form.
 *
 * Required env vars:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Response:
 *   200 { has_order: boolean, status: string | null }
 */

const { getSupabaseAdmin } = require("../lib/supabaseAdmin");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });

  const email = String(req.query.email || "").trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "A valid email address is required." });
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("subscription_orders")
    .select("status")
    .eq("user_email", email)
    .in("status", ["pending", "active"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[check-email-order] DB error:", error);
    return res.status(500).json({ error: "Could not check order status." });
  }

  return res.status(200).json({
    has_order: !!data,
    status: data?.status ?? null,
  });
};
