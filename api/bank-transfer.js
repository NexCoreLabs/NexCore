/**
 * POST /api/bank-transfer
 *
 * Handles bank transfer payment orders:
 * 1. Validates input (name, email, features, transfer date, receipt/ref)
 * 2. Checks for duplicate orders
 * 3. Saves order to Supabase with status "pending_verification"
 * 4. Sends confirmation email via Gmail SMTP
 *
 * Required env vars (same as other API routes):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   EMAIL_USER
 *   EMAIL_PASS
 *   EMAIL_FROM_NAME   (optional — defaults to "NexCore Labs")
 *
 * Body:
 *   {
 *     user_name, user_email, selected_features, transfer_date,
 *     receipt_url?,          — Supabase Storage path (YYYY/MM/ts_hex.ext)
 *     bank_transaction_ref?, — Alphanumeric transaction reference
 *     notes?
 *   }
 *
 * At least one of receipt_url or bank_transaction_ref is required.
 */

const nodemailer = require("nodemailer");
const { getSupabaseAdmin } = require("../lib/supabaseAdmin");

// ── Constants ─────────────────────────────────────────────────────────────────

const OMR_TO_USD = 2.60;

// Server-side feature catalog — source of truth for prices
const FEATURE_CATALOG = {
  support_1week:   { label: "Support — 1 Week",    price: 0.250 },
  support_1month:  { label: "Support — 1 Month",   price: 0.500 },
  support_3months: { label: "Support — 3 Months",  price: 1.000 },
  support_6months: { label: "Support — 6 Months",  price: 1.500 },
  support_1year:   { label: "Support — 1 Year",    price: 2.500 },
  lifetime:        { label: "Lifetime Access",     price: 0.950 },
  setup:           { label: "Professional Setup",  price: 0.450 },
  priority:        { label: "Priority Review",     price: 0.300 },
  spotlight:       { label: "Featured Spotlight",  price: 0.750 },
  badge:           { label: "Custom Badge",        price: 0.200 },
};

// Valid storage path format: YYYY/MM/timestamp_6hexchars.ext
// Prevents storing arbitrary external URLs in the database
const RECEIPT_PATH_RE = /^\d{4}\/\d{2}\/\d+_[a-f0-9]{6}\.[a-z0-9]+$/;

// Allowed file extensions for receipts
const ALLOWED_RECEIPT_EXTS = ["jpg", "jpeg", "png", "pdf"];

// Transaction reference: alphanumeric, spaces, hyphens only
const TX_REF_RE = /^[a-zA-Z0-9\-\s]{1,100}$/;

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateBillId() {
  const year = new Date().getFullYear();
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `NXC-${year}-${rand}`;
}

function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
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

// ── Email template ────────────────────────────────────────────────────────────

function buildBankTransferEmail(billId, name, features, totalOmr, transferDate, txRef) {
  const featureRows = features
    .map(
      (f) =>
        `<tr>
          <td style="padding:8px 14px;color:#cbd5e0;border-bottom:1px solid rgba(255,255,255,0.05);">${f.label}</td>
          <td style="padding:8px 14px;text-align:right;color:#6ee7f3;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.05);">${f.price.toFixed(3)} OMR</td>
        </tr>`
    )
    .join("");

  const refRow = txRef
    ? `<div style="background:rgba(255,180,50,0.08);border:1px solid rgba(255,180,50,0.2);border-radius:8px;padding:12px 14px;margin-top:14px;">
        <p style="margin:0;color:#9aa3b2;font-size:12px;">Transaction Reference</p>
        <p style="margin:4px 0 0;color:#ffb432;font-weight:600;">${txRef}</p>
       </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Inter,Arial,sans-serif;background:#0a0b1c;color:#eaf6fb;margin:0;padding:0;">
  <div style="max-width:580px;margin:0 auto;padding:36px 20px;">

    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#6ee7f3;font-size:26px;margin:0;letter-spacing:-0.5px;">NexCore Labs</h1>
      <p style="color:#9aa3b2;margin:6px 0 0;font-size:14px;">Bank Transfer Received 🏦</p>
    </div>

    <div style="background:rgba(110,231,243,0.04);border:1px solid rgba(110,231,243,0.18);border-radius:14px;padding:28px;">
      <p style="margin:0 0 16px;font-size:16px;">Hi <strong>${name}</strong>,</p>
      <p style="margin:0 0 20px;color:#cbd5e0;">
        We've received your bank transfer order and it is currently
        <strong style="color:#ffb432;">awaiting verification</strong> by our team.
        We'll review your transfer and activate your subscription within approximately <strong>48 hours</strong>.
      </p>

      <div style="background:rgba(255,180,50,0.08);border:1px solid rgba(255,180,50,0.25);border-radius:10px;padding:18px;margin-bottom:20px;text-align:center;">
        <p style="margin:0;color:#9aa3b2;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Your Bill ID</p>
        <p style="margin:8px 0 0;font-size:26px;font-weight:800;color:#ffb432;letter-spacing:3px;">${billId}</p>
        <p style="margin:6px 0 0;color:#9aa3b2;font-size:12px;">Keep this safe — you'll need it when following up.</p>
      </div>

      <div style="background:rgba(255,180,50,0.05);border:1px solid rgba(255,180,50,0.15);border-radius:8px;padding:14px;margin-bottom:20px;">
        <p style="margin:0 0 4px;color:#9aa3b2;font-size:12px;">Transfer Date</p>
        <p style="margin:0;color:#eaf6fb;font-weight:600;">${transferDate}</p>
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
            <td style="padding:14px;font-weight:700;color:#eaf6fb;font-size:15px;">Total to Transfer</td>
            <td style="padding:14px;text-align:right;font-weight:800;color:#6ee7f3;font-size:20px;">${totalOmr.toFixed(3)} OMR</td>
          </tr>
        </tfoot>
      </table>

      ${refRow}

      <div style="background:rgba(255,180,50,0.07);border:1px solid rgba(255,180,50,0.2);border-radius:8px;padding:14px;margin-top:14px;">
        <p style="margin:0;font-size:13px;line-height:1.65;color:#cbd5e0;">
          <strong style="color:#ffb432;">⏱ What happens next?</strong><br>
          Our team will verify your bank transfer and activate your subscription.
          You'll receive a separate email once your account is live.
          If you haven't heard back within 48 hours, contact us on WhatsApp:
          <strong style="color:#fff;">+968 93281000</strong>
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
    selected_features,
    transfer_date,
    receipt_url,
    bank_transaction_ref,
    notes,
    organization,
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

  if (!transfer_date || !String(transfer_date).trim())
    return res.status(400).json({ error: "Transfer date is required." });

  // Validate date format (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(transfer_date).trim()))
    return res.status(400).json({ error: "Invalid transfer date format." });

  // Require at least receipt or transaction reference
  const receiptPath = receipt_url ? String(receipt_url).trim() : null;
  const txRef       = bank_transaction_ref ? String(bank_transaction_ref).trim() : null;

  if (!receiptPath && !txRef)
    return res.status(400).json({ error: "Please provide a receipt upload or transaction reference number." });

  // Validate receipt path format (must be our storage path, not an arbitrary URL)
  if (receiptPath) {
    if (!RECEIPT_PATH_RE.test(receiptPath))
      return res.status(400).json({ error: "Invalid receipt path format." });

    const ext = receiptPath.split(".").pop().toLowerCase();
    if (!ALLOWED_RECEIPT_EXTS.includes(ext))
      return res.status(400).json({ error: "Unsupported receipt file type." });
  }

  // Validate transaction reference (alphanumeric, hyphens, spaces only)
  if (txRef && !TX_REF_RE.test(txRef))
    return res.status(400).json({ error: "Transaction reference contains invalid characters." });

  // Sanitise notes
  const cleanNotes = notes ? String(notes).trim().slice(0, 500) : null;

  // Sanitise organization (informational only — no validation required)
  const cleanOrganization = organization ? String(organization).trim().slice(0, 200) : null;

  // ── Validate features against server-side catalog ───────────────────────────

  const validatedFeatures = [];
  let computedTotal = 0;

  for (const f of selected_features) {
    const item = FEATURE_CATALOG[f.id];
    if (!item) return res.status(400).json({ error: `Unknown feature: ${f.id}` });
    validatedFeatures.push({ id: f.id, label: item.label, price: item.price });
    computedTotal += item.price;
  }

  // Only one support duration allowed
  const supportCount = validatedFeatures.filter((f) => f.id.startsWith("support_")).length;
  if (supportCount > 1)
    return res.status(400).json({ error: "Only one support duration can be selected." });

  computedTotal = Math.round(computedTotal * 1000) / 1000;
  const totalUsd = Math.round(computedTotal * OMR_TO_USD * 100) / 100;

  // ── Duplicate order check ───────────────────────────────────────────────────

  const supabase = getSupabaseAdmin();

  const { data: existingOrder } = await supabase
    .from("subscription_orders")
    .select("bill_id, status")
    .eq("user_email", email)
    .in("status", ["pending", "active", "pending_verification"])
    .limit(1)
    .maybeSingle();

  if (existingOrder) {
    const msg =
      existingOrder.status === "active"
        ? `This email already has an active NexCore subscription. Sign in at nexcorelabs.vercel.app/auth with your Google account.`
        : `You already have a pending order (${existingOrder.bill_id}). Check your inbox for your confirmation email.`;
    return res.status(409).json({ error: msg });
  }

  // ── Generate unique Bill ID ─────────────────────────────────────────────────

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

  // ── Save to Supabase ────────────────────────────────────────────────────────

  const { error: dbError } = await supabase.from("subscription_orders").insert({
    bill_id:              billId,
    user_name:            String(user_name).trim(),
    user_email:           email,
    selected_features:    validatedFeatures,
    total_omr:            computedTotal,
    total_usd:            totalUsd,
    payment_method:       "bank_transfer",
    status:               "pending_verification",
    receipt_url:          receiptPath,
    bank_transaction_ref: txRef,
    transfer_date:        String(transfer_date).trim(),
    notes:                cleanNotes,
    organization:         cleanOrganization,
    activated_at:         null,
  });

  if (dbError) {
    console.error("[bank-transfer] DB insert error:", dbError);
    return res.status(500).json({ error: "Failed to save your order. Please try again or contact us on WhatsApp." });
  }

  // ── Send confirmation email (non-fatal — DB is already saved) ────────────────

  try {
    const html = buildBankTransferEmail(
      billId,
      String(user_name).trim(),
      validatedFeatures,
      computedTotal,
      String(transfer_date).trim(),
      txRef
    );
    await sendEmail(
      email,
      `Bank Transfer Received — Bill #${billId} | NexCore Labs`,
      html
    );
  } catch (emailErr) {
    console.error("[bank-transfer] Email send error:", emailErr);
    // Non-fatal: order is saved, just log the failure
  }

  console.log(
    `[bank-transfer] Order PENDING: ${billId} | email: ${email} | ` +
    `total: ${computedTotal} OMR | receipt: ${receiptPath || "none"} | ref: ${txRef || "none"}`
  );

  return res.status(200).json({ success: true, bill_id: billId });
};
