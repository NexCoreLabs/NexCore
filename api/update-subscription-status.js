/**
 * POST /api/update-subscription-status
 *
 * Admin-only endpoint to approve, reject, or cancel a subscription order.
 * Caller must pass a valid Supabase JWT for a user in the `admins` table.
 *
 * Required env vars:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   EMAIL_USER              e.g. nexcorelabs.system@gmail.com
 *   EMAIL_PASS              16-char Google App Password (no spaces)
 *   EMAIL_FROM_NAME         (optional, defaults to "NexCore Labs")
 *
 * Body: { bill_id, status, admin_notes? }
 * status: 'active' | 'rejected' | 'cancelled' | 'pending'
 */

const nodemailer = require("nodemailer");
const { getSupabaseAdmin } = require("../lib/supabaseAdmin");

function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

// ── Email builder ─────────────────────────────────────────────────────────────

function buildStatusEmail(billId, name, status, adminNotes) {
  const isActive = status === "active";
  const accentRgb = isActive ? "110,231,243" : "255,120,120";
  const accentHex = isActive ? "#6ee7f3" : "#ff7878";
  const statusLabel = isActive ? "Activated ✅" : "Rejected ❌";

  const bodyContent = isActive
    ? `<p style="color:#cbd5e0;">Great news! Your NexCore subscription has been <strong style="color:#6ee7f3;">activated</strong>.</p>
       <p style="color:#cbd5e0;">You can now sign in with your Google account at:</p>
       <div style="text-align:center;margin:16px 0;">
         <a href="https://nexcorelabs.vercel.app/auth" style="display:inline-block;padding:12px 28px;background:rgba(110,231,243,0.15);border:1px solid #6ee7f3;border-radius:8px;color:#6ee7f3;text-decoration:none;font-weight:600;">Sign In to NexCore</a>
       </div>`
    : `<p style="color:#cbd5e0;">Unfortunately, your NexCore subscription order could not be processed at this time.</p>
       ${adminNotes ? `<div style="background:rgba(255,120,120,0.08);border:1px solid rgba(255,120,120,0.25);border-radius:8px;padding:14px;margin:12px 0;"><p style="margin:0;color:#cbd5e0;font-size:14px;"><strong style="color:#ff7878;">Reason:</strong> ${adminNotes}</p></div>` : ""}
       <p style="color:#cbd5e0;">If you have questions, reach us on WhatsApp: <strong style="color:#fff;">+968 93281000</strong></p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Inter,Arial,sans-serif;background:#0a0b1c;color:#eaf6fb;margin:0;padding:0;">
  <div style="max-width:580px;margin:0 auto;padding:36px 20px;">

    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#6ee7f3;font-size:26px;margin:0;letter-spacing:-0.5px;">NexCore Labs</h1>
      <p style="color:#9aa3b2;margin:6px 0 0;font-size:14px;">Order Update — ${statusLabel}</p>
    </div>

    <div style="background:rgba(110,231,243,0.04);border:1px solid rgba(${accentRgb},0.2);border-radius:14px;padding:28px;">
      <p style="margin:0 0 16px;">Hi <strong>${name}</strong>,</p>
      ${bodyContent}
      <div style="background:rgba(0,0,0,0.35);border-radius:10px;padding:14px;margin-top:20px;text-align:center;">
        <p style="margin:0;color:#9aa3b2;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Bill ID</p>
        <p style="margin:8px 0 0;font-size:22px;font-weight:800;color:${accentHex};letter-spacing:3px;">${billId}</p>
      </div>
    </div>

    <div style="text-align:center;margin-top:24px;color:#9aa3b2;font-size:12px;">
      <p style="margin:0;">NexCore Labs &middot; <a href="https://nexcorelabs.vercel.app" style="color:#6ee7f3;text-decoration:none;">nexcorelabs.vercel.app</a></p>
    </div>
  </div>
</body>
</html>`;
}

async function sendEmail(to, subject, html) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;

  const fromName = process.env.EMAIL_FROM_NAME || "NexCore Labs";
  const transporter = createTransporter();

  await transporter.sendMail({
    from: `"${fromName}" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
}

// ── Handler ───────────────────────────────────────────────────────────────────

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

  // ── Validate body ───────────────────────────────────────────────────────────
  const { bill_id, status, admin_notes } = req.body || {};

  if (!bill_id || !String(bill_id).trim())
    return res.status(400).json({ error: "bill_id is required." });

  if (!["active", "rejected", "cancelled", "pending"].includes(status))
    return res.status(400).json({ error: "Invalid status value." });

  const billId = String(bill_id).trim();

  // ── Fetch existing order ────────────────────────────────────────────────────
  const { data: order, error: fetchErr } = await supabase
    .from("subscription_orders")
    .select("*")
    .eq("bill_id", billId)
    .maybeSingle();

  if (fetchErr || !order)
    return res.status(404).json({ error: "Order not found." });

  // ── Update order ────────────────────────────────────────────────────────────
  const updatePayload = {
    status,
    admin_notes: admin_notes ? String(admin_notes).trim() : null,
  };
  if (status === "active") updatePayload.activated_at = new Date().toISOString();

  const { error: updateErr } = await supabase
    .from("subscription_orders")
    .update(updatePayload)
    .eq("bill_id", billId);

  if (updateErr) {
    console.error("DB update error:", updateErr);
    return res.status(500).json({ error: "Failed to update the order." });
  }

  // ── Send status notification email (non-fatal) ──────────────────────────────
  if (status === "active" || status === "rejected") {
    try {
      const html = buildStatusEmail(
        order.bill_id,
        order.user_name,
        status,
        admin_notes
      );
      const subjectMap = {
        active: `Your NexCore Subscription is Now Active — Bill #${order.bill_id}`,
        rejected: `Update on Your NexCore Order — Bill #${order.bill_id}`,
      };
      await sendEmail(order.user_email, subjectMap[status], html);
    } catch (e) {
      console.error("Status email error:", e);
    }
  }

  return res.status(200).json({ success: true, bill_id: billId, new_status: status });
};
