/**
 * POST /api/submit-subscription
 *
 * Accepts a flexible feature order from an external user,
 * stores it in Supabase, and sends a confirmation email via Gmail SMTP.
 *
 * Required env vars (set in Vercel dashboard):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   EMAIL_USER              e.g. nexcorelabs.system@gmail.com
 *   EMAIL_PASS              16-char Google App Password (no spaces)
 *   EMAIL_FROM_NAME         (optional, defaults to "NexCore Labs")
 */

const nodemailer = require("nodemailer");
const { getSupabaseAdmin } = require("../lib/supabaseAdmin");

// ── Mailer ────────────────────────────────────────────────────────────────────
function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

// ── Feature catalog ─────────────────────────────────────────────────────────
// Server-side source of truth. Prices must match the frontend display.
const FEATURE_CATALOG = {
  support_1week:  { label: "Support — 1 Week",    price: 0.250 },
  support_1month: { label: "Support — 1 Month",   price: 0.500 },
  support_3months:{ label: "Support — 3 Months",  price: 1.000 },
  support_6months:{ label: "Support — 6 Months",  price: 1.500 },
  support_1year:  { label: "Support — 1 Year",    price: 2.500 },
  lifetime:       { label: "Lifetime Access",     price: 0.950 },
  setup:          { label: "Professional Setup",  price: 0.450 },
  priority:       { label: "Priority Review",     price: 0.300 },
  spotlight:      { label: "Featured Spotlight",  price: 0.750 },
  badge:          { label: "Custom Badge",        price: 0.200 },
};

const OMR_TO_USD = 2.60;

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateBillId() {
  const year = new Date().getFullYear();
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `NXC-${year}-${rand}`;
}

function buildConfirmationEmail(billId, name, features, totalOmr, totalUsd, paymentMethod) {
  const featureRows = features
    .map(
      (f) =>
        `<tr>
          <td style="padding:8px 14px;color:#cbd5e0;border-bottom:1px solid rgba(255,255,255,0.05);">${f.label}</td>
          <td style="padding:8px 14px;text-align:right;color:#6ee7f3;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.05);">${f.price.toFixed(3)} OMR</td>
        </tr>`
    )
    .join("");

  const paymentBlock =
    paymentMethod === "whatsapp"
      ? `<div style="background:rgba(37,211,102,0.1);border:1px solid rgba(37,211,102,0.3);border-radius:8px;padding:16px;margin:20px 0;">
           <p style="margin:0;color:#25d366;font-weight:700;font-size:15px;">Next Step — WhatsApp Payment</p>
           <p style="margin:8px 0 0;color:#cbd5e0;">Send your <strong style="color:#fff;">Bill ID</strong> and payment confirmation to:</p>
           <p style="margin:6px 0 0;font-size:22px;font-weight:800;color:#fff;">+968 93281000</p>
         </div>`
      : `<div style="background:rgba(0,112,186,0.1);border:1px solid rgba(0,112,186,0.3);border-radius:8px;padding:16px;margin:20px 0;">
           <p style="margin:0;color:#0070ba;font-weight:700;font-size:15px;">PayPal Payment</p>
           <p style="margin:8px 0 0;color:#cbd5e0;">Amount charged via PayPal: <strong style="color:#fff;">$${totalUsd.toFixed(2)} USD</strong></p>
         </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Inter,Arial,sans-serif;background:#0a0b1c;color:#eaf6fb;margin:0;padding:0;">
  <div style="max-width:580px;margin:0 auto;padding:36px 20px;">

    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#6ee7f3;font-size:26px;margin:0;letter-spacing:-0.5px;">NexCore Labs</h1>
      <p style="color:#9aa3b2;margin:6px 0 0;font-size:14px;">Order Confirmation</p>
    </div>

    <div style="background:rgba(110,231,243,0.04);border:1px solid rgba(110,231,243,0.18);border-radius:14px;padding:28px;">
      <p style="margin:0 0 16px;font-size:16px;">Hi <strong>${name}</strong>,</p>
      <p style="margin:0 0 20px;color:#cbd5e0;">Your NexCore order has been received and is under review. Here are your details:</p>

      <div style="background:rgba(0,0,0,0.35);border-radius:10px;padding:18px;margin-bottom:20px;text-align:center;">
        <p style="margin:0;color:#9aa3b2;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Your Bill ID</p>
        <p style="margin:8px 0 0;font-size:26px;font-weight:800;color:#6ee7f3;letter-spacing:3px;">${billId}</p>
        <p style="margin:6px 0 0;font-size:12px;color:#9aa3b2;">Keep this safe — you'll need it when following up.</p>
      </div>

      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="padding:10px 14px;text-align:left;color:#6ee7f3;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid rgba(110,231,243,0.2);">Feature</th>
            <th style="padding:10px 14px;text-align:right;color:#6ee7f3;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid rgba(110,231,243,0.2);">Price</th>
          </tr>
        </thead>
        <tbody>${featureRows}</tbody>
        <tfoot>
          <tr>
            <td style="padding:14px;font-weight:700;color:#eaf6fb;font-size:15px;">Total</td>
            <td style="padding:14px;text-align:right;font-weight:800;color:#6ee7f3;font-size:20px;">${totalOmr.toFixed(3)} OMR</td>
          </tr>
        </tfoot>
      </table>

      ${paymentBlock}

      <div style="background:rgba(255,180,50,0.07);border:1px solid rgba(255,180,50,0.22);border-radius:8px;padding:14px;margin-top:4px;">
        <p style="margin:0;font-size:14px;line-height:1.6;">
          <strong style="color:#ffb432;">⏱ Activation Time</strong><br>
          <span style="color:#cbd5e0;">Your subscription will be activated within approximately <strong>48 hours</strong> after payment is confirmed.</span>
        </p>
      </div>
    </div>

    <div style="text-align:center;margin-top:24px;color:#9aa3b2;font-size:12px;line-height:1.6;">
      <p style="margin:0;">NexCore Labs &middot; <a href="https://nexcorelabs.vercel.app" style="color:#6ee7f3;text-decoration:none;">nexcorelabs.vercel.app</a></p>
      <p style="margin:4px 0 0;">If you didn't submit this order, please ignore this email.</p>
    </div>
  </div>
</body>
</html>`;
}

async function sendEmail(to, subject, html) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return; // non-fatal

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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const {
    user_name,
    user_email,
    whatsapp_number,
    selected_features,
    payment_method,
    notes,
    paypal_order_id,
  } = req.body || {};

  // ── Input validation ────────────────────────────────────────────────────────
  if (!user_name || !String(user_name).trim())
    return res.status(400).json({ error: "Name is required." });

  const email = String(user_email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ error: "Email is required." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: "Invalid email address." });

  if (!Array.isArray(selected_features) || selected_features.length === 0)
    return res.status(400).json({ error: "At least one feature must be selected." });

  if (!["whatsapp", "paypal"].includes(payment_method))
    return res.status(400).json({ error: "Invalid payment method." });

  // ── Validate features against catalog ──────────────────────────────────────
  const validatedFeatures = [];
  let computedTotal = 0;

  for (const f of selected_features) {
    const item = FEATURE_CATALOG[f.id];
    if (!item) return res.status(400).json({ error: `Unknown feature: ${f.id}` });
    validatedFeatures.push({ id: f.id, label: item.label, price: item.price });
    computedTotal += item.price;
  }

  // Only one support duration allowed
  const supportCount = validatedFeatures.filter((f) =>
    f.id.startsWith("support_")
  ).length;
  if (supportCount > 1)
    return res.status(400).json({ error: "Only one support duration can be selected." });

  computedTotal = Math.round(computedTotal * 1000) / 1000;
  const totalUsd = Math.round(computedTotal * OMR_TO_USD * 100) / 100;

  // ── Generate unique Bill ID ─────────────────────────────────────────────────
  const supabase = getSupabaseAdmin();
  let billId;
  for (let i = 0; i < 5; i++) {
    const candidate = generateBillId();
    const { data } = await supabase
      .from("subscription_orders")
      .select("id")
      .eq("bill_id", candidate)
      .maybeSingle();
    if (!data) { billId = candidate; break; }
  }
  if (!billId)
    return res.status(500).json({ error: "Failed to generate a unique Bill ID. Please try again." });

  // ── Insert order ────────────────────────────────────────────────────────────
  const { error: dbError } = await supabase.from("subscription_orders").insert({
    bill_id: billId,
    user_name: String(user_name).trim(),
    user_email: email,
    whatsapp_number: whatsapp_number ? String(whatsapp_number).trim() : null,
    selected_features: validatedFeatures,
    total_omr: computedTotal,
    total_usd: totalUsd,
    payment_method,
    status: "pending",
    paypal_order_id: paypal_order_id ? String(paypal_order_id).trim() : null,
    notes: notes ? String(notes).trim() : null,
  });

  if (dbError) {
    console.error("DB insert error:", dbError);
    return res.status(500).json({ error: "Failed to save your order. Please try again." });
  }

  // ── Send confirmation email (non-fatal) ─────────────────────────────────────
  try {
    const html = buildConfirmationEmail(
      billId,
      String(user_name).trim(),
      validatedFeatures,
      computedTotal,
      totalUsd,
      payment_method
    );
    await sendEmail(
      email,
      `NexCore Order Confirmed — Bill #${billId}`,
      html
    );
  } catch (emailErr) {
    console.error("Email send error:", emailErr);
  }

  return res.status(200).json({ success: true, bill_id: billId });
};
