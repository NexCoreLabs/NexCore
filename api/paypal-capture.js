/**
 * POST /api/paypal-capture
 *
 * 1. Captures a PayPal order that was approved by the buyer in the browser.
 * 2. Validates the captured amount matches what we expect (server-side).
 * 3. Saves the subscription order to Supabase.
 * 4. Sends a confirmation email via Gmail SMTP.
 *
 * Required env vars:
 *   PAYPAL_CLIENT_ID          Sandbox or Live client ID
 *   PAYPAL_SECRET             Sandbox or Live secret
 *   PAYPAL_ENV                "sandbox" (default) | "live"
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   EMAIL_USER
 *   EMAIL_PASS
 *   EMAIL_FROM_NAME           (optional)
 *
 * Body:
 *   { paypal_order_id, user_name, user_email, whatsapp_number?,
 *     selected_features, notes? }
 */

const nodemailer = require("nodemailer");
const { getSupabaseAdmin } = require("../lib/supabaseAdmin");

// ── Constants ─────────────────────────────────────────────────────────────────

const OMR_TO_USD = 2.60;

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

// ── PayPal helpers ────────────────────────────────────────────────────────────

function getPayPalBase() {
  return process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret   = process.env.PAYPAL_SECRET;

  if (!clientId || !secret) {
    throw new Error("PayPal credentials not configured.");
  }

  const credentials = Buffer.from(`${clientId}:${secret}`).toString("base64");

  const resp = await fetch(`${getPayPalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type":  "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`PayPal token error: ${resp.status} ${body}`);
  }

  const json = await resp.json();
  return json.access_token;
}

async function capturePayPalOrder(paypalOrderId, accessToken) {
  const resp = await fetch(
    `${getPayPalBase()}/v2/checkout/orders/${paypalOrderId}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type":  "application/json",
        "Prefer":        "return=representation",
      },
    }
  );

  const json = await resp.json();

  if (!resp.ok) {
    const msg = json?.details?.[0]?.description || json?.message || "Capture failed.";
    throw new Error(`PayPal capture error: ${msg}`);
  }

  return json;
}

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

function buildActivationEmail(billId, name, features, totalOmr, totalUsd, paypalOrderId) {
  const featureRows = features
    .map(
      (f) =>
        `<tr>
          <td style="padding:8px 14px;color:#cbd5e0;border-bottom:1px solid rgba(255,255,255,0.05);">${f.label}</td>
          <td style="padding:8px 14px;text-align:right;color:#6ee7f3;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.05);">${f.price.toFixed(3)} OMR</td>
        </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Inter,Arial,sans-serif;background:#0a0b1c;color:#eaf6fb;margin:0;padding:0;">
  <div style="max-width:580px;margin:0 auto;padding:36px 20px;">

    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#6ee7f3;font-size:26px;margin:0;letter-spacing:-0.5px;">NexCore Labs</h1>
      <p style="color:#9aa3b2;margin:6px 0 0;font-size:14px;">Subscription Activated ✅</p>
    </div>

    <div style="background:rgba(110,231,243,0.04);border:1px solid rgba(110,231,243,0.18);border-radius:14px;padding:28px;">
      <p style="margin:0 0 16px;font-size:16px;">Hi <strong>${name}</strong>,</p>
      <p style="margin:0 0 20px;color:#cbd5e0;">Your PayPal payment was confirmed and your NexCore subscription is now <strong style="color:#6ee7f3;">active</strong>!</p>

      <div style="background:rgba(110,231,243,0.08);border:1px solid rgba(110,231,243,0.3);border-radius:10px;padding:18px;margin-bottom:20px;text-align:center;">
        <p style="margin:0;color:#9aa3b2;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Your Bill ID</p>
        <p style="margin:8px 0 0;font-size:26px;font-weight:800;color:#6ee7f3;letter-spacing:3px;">${billId}</p>
      </div>

      <div style="background:rgba(37,211,102,0.08);border:1px solid rgba(37,211,102,0.3);border-radius:10px;padding:20px;margin-bottom:20px;text-align:center;">
        <p style="margin:0;color:#25d366;font-weight:700;font-size:15px;">🎉 You're Ready to Sign In!</p>
        <p style="margin:10px 0;color:#cbd5e0;font-size:14px;">Your email has been added to the NexCore access list. Sign in with your Google account to access your dashboard.</p>
        <a href="https://nexcorelabs.vercel.app/auth" style="display:inline-block;padding:12px 32px;background:rgba(110,231,243,0.15);border:1px solid #6ee7f3;border-radius:8px;color:#6ee7f3;text-decoration:none;font-weight:700;font-size:15px;margin-top:4px;">Sign In with Google →</a>
        <p style="margin:10px 0 0;color:#9aa3b2;font-size:12px;">Use the same email address: <strong style="color:#eaf6fb;">${name}</strong></p>
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
            <td style="padding:14px;font-weight:700;color:#eaf6fb;font-size:15px;">Total Paid</td>
            <td style="padding:14px;text-align:right;font-weight:800;color:#6ee7f3;font-size:20px;">${totalOmr.toFixed(3)} OMR <span style="font-size:13px;color:#9aa3b2;">($${totalUsd.toFixed(2)} USD)</span></td>
          </tr>
        </tfoot>
      </table>

      <div style="background:rgba(0,112,186,0.1);border:1px solid rgba(0,112,186,0.3);border-radius:8px;padding:12px 14px;margin-top:14px;">
        <p style="margin:0;color:#9aa3b2;font-size:12px;">PayPal Transaction ID</p>
        <p style="margin:4px 0 0;color:#cbd5e0;font-size:12px;word-break:break-all;">${paypalOrderId}</p>
      </div>
    </div>

    <div style="text-align:center;margin-top:24px;color:#9aa3b2;font-size:12px;line-height:1.6;">
      <p style="margin:0;">NexCore Labs &middot; <a href="https://nexcorelabs.vercel.app" style="color:#6ee7f3;text-decoration:none;">nexcorelabs.vercel.app</a></p>
      <p style="margin:4px 0 0;">If you didn't make this payment, contact us immediately on WhatsApp: +968 93281000</p>
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

// ── Bill ID generator ─────────────────────────────────────────────────────────

function generateBillId() {
  const year = new Date().getFullYear();
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `NXC-${year}-${rand}`;
}

// ── Handler ───────────────────────────────────────────────────────────────────

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const {
    paypal_order_id,
    user_name,
    user_email,
    whatsapp_number,
    selected_features,
    notes,
  } = req.body || {};

  // ── Input validation ────────────────────────────────────────────────────────
  if (!paypal_order_id || !String(paypal_order_id).trim())
    return res.status(400).json({ error: "paypal_order_id is required." });

  if (!user_name || !String(user_name).trim())
    return res.status(400).json({ error: "Name is required." });

  const email = String(user_email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ error: "Email is required." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: "Invalid email address." });

  if (!Array.isArray(selected_features) || selected_features.length === 0)
    return res.status(400).json({ error: "At least one feature must be selected." });

  // ── Validate features & compute expected total ──────────────────────────────
  const validatedFeatures = [];
  let computedTotal = 0;

  for (const f of selected_features) {
    const item = FEATURE_CATALOG[f.id];
    if (!item) return res.status(400).json({ error: `Unknown feature: ${f.id}` });
    validatedFeatures.push({ id: f.id, label: item.label, price: item.price });
    computedTotal += item.price;
  }

  const supportCount = validatedFeatures.filter((f) => f.id.startsWith("support_")).length;
  if (supportCount > 1)
    return res.status(400).json({ error: "Only one support duration can be selected." });

  computedTotal = Math.round(computedTotal * 1000) / 1000;
  const expectedUsd = Math.round(computedTotal * OMR_TO_USD * 100) / 100;

  // ── Duplicate order check ───────────────────────────────────────────────────
  const supabase = getSupabaseAdmin();

  const { data: existingOrder } = await supabase
    .from("subscription_orders")
    .select("bill_id, status")
    .eq("user_email", email)
    .in("status", ["pending", "active"])
    .limit(1)
    .maybeSingle();

  if (existingOrder) {
    const msg =
      existingOrder.status === "active"
        ? `This email already has an active NexCore subscription. Sign in at nexcorelabs.vercel.app/auth with your Google account.`
        : `You already have a pending order (${existingOrder.bill_id}). Check your inbox for the confirmation email.`;
    return res.status(409).json({ error: msg });
  }

  // ── Capture PayPal order ────────────────────────────────────────────────────
  let captureData;
  try {
    const accessToken = await getPayPalAccessToken();
    captureData = await capturePayPalOrder(String(paypal_order_id).trim(), accessToken);
  } catch (err) {
    console.error("PayPal capture failed:", err.message);
    return res.status(502).json({ error: err.message || "PayPal payment capture failed." });
  }

  // ── Verify capture status ───────────────────────────────────────────────────
  if (captureData.status !== "COMPLETED") {
    return res.status(402).json({
      error: `Payment not completed. Status: ${captureData.status}`,
    });
  }

  // ── Verify amount (guard against price tampering) ───────────────────────────
  const capturedUnit = captureData.purchase_units?.[0]?.payments?.captures?.[0];
  if (capturedUnit) {
    const capturedUsd = parseFloat(capturedUnit.amount?.value || "0");
    if (Math.abs(capturedUsd - expectedUsd) > 0.02) {
      // Allow ±$0.02 for floating-point drift
      console.error(`Amount mismatch: expected $${expectedUsd}, captured $${capturedUsd}`);
      return res.status(402).json({
        error: `Payment amount mismatch. Expected $${expectedUsd} USD, received $${capturedUsd} USD.`,
      });
    }
  }

  // ── Save to Supabase ────────────────────────────────────────────────────────
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

  const { error: dbError } = await supabase.from("subscription_orders").insert({
    bill_id:           billId,
    user_name:         String(user_name).trim(),
    user_email:        email,
    whatsapp_number:   whatsapp_number ? String(whatsapp_number).trim() : null,
    selected_features: validatedFeatures,
    total_omr:         computedTotal,
    total_usd:         expectedUsd,
    payment_method:    "paypal",
    paypal_order_id:   String(paypal_order_id).trim(),
    status:            "active",
    activated_at:      new Date().toISOString(),
    notes:             notes ? String(notes).trim() : null,
  });

  if (dbError) {
    console.error("DB insert error:", dbError);
    return res.status(500).json({ error: "Payment was captured but order could not be saved. Contact us with your PayPal transaction ID: " + String(paypal_order_id).trim() });
  }

  // ── Whitelist email in approved_users (idempotent) ──────────────────────────
  await supabase.from("approved_users").upsert(
    { email, reason: `PayPal order ${billId}`, approved_by: "system" },
    { onConflict: "email", ignoreDuplicates: true }
  );

  // ── Send activation email (non-fatal) ───────────────────────────────────────
  try {
    const html = buildActivationEmail(
      billId,
      String(user_name).trim(),
      validatedFeatures,
      computedTotal,
      expectedUsd,
      String(paypal_order_id).trim()
    );
    await sendEmail(email, `🎉 Your NexCore Subscription is Active — Bill #${billId}`, html);
  } catch (emailErr) {
    console.error("Email send error:", emailErr);
  }

  console.log(`[paypal-capture] Order ACTIVATED: ${billId} | PayPal: ${paypal_order_id} | $${expectedUsd} USD | email: ${email}`);

  return res.status(200).json({ success: true, bill_id: billId, auto_activated: true });
};
