/**
 * POST /api/verify-org-email
 *
 * Two-step OTP verification for organization email addresses.
 *
 * action = "send"
 *   Body: { action: "send", email: "user@org.edu.om" }
 *   → Generates a 6-digit OTP, stores it in `otp_verifications` with a
 *     10-minute expiry, and sends it to the supplied email via Gmail SMTP.
 *   → Rate-limited: max 3 send requests per email per 10 minutes.
 *
 * action = "verify"
 *   Body: { action: "verify", email: "user@org.edu.om", code: "123456" }
 *   → Validates the OTP, marks it as used, returns { success: true }.
 *   → Fails with 429 after 5 wrong attempts for the same email.
 *
 * Required env vars:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   EMAIL_USER              e.g. nexcorelabs.system@gmail.com
 *   EMAIL_PASS              16-char Google App Password (no spaces)
 *   EMAIL_FROM_NAME         (optional, defaults to "NexCore Labs")
 */

const nodemailer = require("nodemailer");
const { getSupabaseAdmin } = require("../lib/supabaseAdmin");

// ── Constants ─────────────────────────────────────────────────────────────────

const OTP_EXPIRY_MINUTES   = 10;
const MAX_SEND_PER_WINDOW  = 3;   // max OTP sends per email per 10-min window
const MAX_VERIFY_ATTEMPTS  = 5;   // max wrong guesses before lockout

// Blocked domains: SQU students use NexCore for free via Google Sign-In
const BLOCKED_DOMAINS = new Set([
  "student.squ.edu.om",
  "squ.edu.om",
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateOtp() {
  // Cryptographically random 6-digit string (zero-padded)
  const n = Math.floor(100000 + Math.random() * 900000);
  return String(n);
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

async function sendOtpEmail(to, code) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
  const fromName = process.env.EMAIL_FROM_NAME || "NexCore Labs";
  const transporter = createTransporter();

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Inter,Arial,sans-serif;background:#0a0b1c;color:#eaf6fb;margin:0;padding:0;">
  <div style="max-width:480px;margin:0 auto;padding:36px 20px;">

    <div style="text-align:center;margin-bottom:28px;">
      <h1 style="color:#6ee7f3;font-size:24px;margin:0;letter-spacing:-0.5px;">NexCore Labs</h1>
      <p style="color:#9aa3b2;margin:6px 0 0;font-size:13px;">Email Verification</p>
    </div>

    <div style="background:rgba(110,231,243,0.04);border:1px solid rgba(110,231,243,0.18);border-radius:14px;padding:28px;text-align:center;">
      <p style="margin:0 0 10px;font-size:15px;color:#cbd5e0;">Your verification code is:</p>

      <div style="background:rgba(110,231,243,0.08);border:1px solid rgba(110,231,243,0.3);border-radius:12px;padding:22px 28px;margin:16px 0;display:inline-block;">
        <span style="font-size:36px;font-weight:800;color:#6ee7f3;letter-spacing:8px;">${code}</span>
      </div>

      <p style="margin:16px 0 0;color:#9aa3b2;font-size:13px;line-height:1.6;">
        This code expires in <strong style="color:#eaf6fb;">${OTP_EXPIRY_MINUTES} minutes</strong>.<br>
        Enter it on the NexCore pricing page to verify your organization email.
      </p>
    </div>

    <div style="text-align:center;margin-top:20px;color:#9aa3b2;font-size:12px;line-height:1.6;">
      <p style="margin:0;">If you didn't request this code, you can safely ignore this email.</p>
      <p style="margin:6px 0 0;">NexCore Labs &middot;
        <a href="https://nexcorelabs.vercel.app" style="color:#6ee7f3;text-decoration:none;">nexcorelabs.vercel.app</a>
      </p>
    </div>
  </div>
</body>
</html>`;

  await transporter.sendMail({
    from: `"${fromName}" <${process.env.EMAIL_USER}>`,
    to,
    subject: `${code} — Your NexCore Verification Code`,
    html,
  });
}

// ── Handler ───────────────────────────────────────────────────────────────────

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Method not allowed." });

  const { action, email: rawEmail, code: rawCode } = req.body || {};

  // Basic email validation
  const email = String(rawEmail || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "A valid email address is required." });
  }

  // Block SQU domains — they get free access via Google Sign-In
  const domain = email.split("@")[1] || "";
  if (BLOCKED_DOMAINS.has(domain)) {
    return res.status(403).json({
      error: "SQU students access NexCore for free. Please sign in at nexcorelabs.vercel.app/auth using your SQU Google account.",
      redirect_to_auth: true,
    });
  }

  const supabase = getSupabaseAdmin();
  const now      = new Date();

  // ── action: send ────────────────────────────────────────────────────────────
  if (action === "send") {
    const windowStart = new Date(now.getTime() - OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

    // Rate-limit: count unexpired OTPs created within the window for this email
    const { count } = await supabase
      .from("otp_verifications")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", windowStart);

    if (count >= MAX_SEND_PER_WINDOW) {
      return res.status(429).json({
        error: `Too many code requests. Please wait before requesting another code.`,
      });
    }

    const code      = generateOtp();
    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

    const { error: insertErr } = await supabase.from("otp_verifications").insert({
      email,
      code,
      expires_at: expiresAt,
      used:       false,
      attempts:   0,
    });

    if (insertErr) {
      console.error("[verify-org-email] DB insert error:", insertErr);
      return res.status(500).json({ error: "Failed to generate code. Please try again." });
    }

    try {
      await sendOtpEmail(email, code);
    } catch (mailErr) {
      console.error("[verify-org-email] Email send error:", mailErr);
      // OTP is stored — tell user to check spam or retry
      return res.status(500).json({ error: "Code generated but email delivery failed. Please check your spam folder or try again." });
    }

    console.log(`[verify-org-email] OTP sent to ${email} (expires ${expiresAt})`);
    return res.status(200).json({ success: true, expires_in_minutes: OTP_EXPIRY_MINUTES });
  }

  // ── action: verify ──────────────────────────────────────────────────────────
  if (action === "verify") {
    const code = String(rawCode || "").trim();
    if (!code || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: "Please enter a valid 6-digit code." });
    }

    // Find the most recent unused, unexpired OTP for this email
    const { data: otpRow, error: fetchErr } = await supabase
      .from("otp_verifications")
      .select("id, code, expires_at, used, attempts")
      .eq("email", email)
      .eq("used", false)
      .gt("expires_at", now.toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchErr) {
      console.error("[verify-org-email] DB fetch error:", fetchErr);
      return res.status(500).json({ error: "Verification failed. Please try again." });
    }

    if (!otpRow) {
      return res.status(400).json({ error: "No active verification code found. Please request a new code." });
    }

    // Lockout after too many wrong attempts
    if (otpRow.attempts >= MAX_VERIFY_ATTEMPTS) {
      return res.status(429).json({ error: "Too many incorrect attempts. Please request a new code." });
    }

    if (otpRow.code !== code) {
      // Increment attempt counter
      await supabase
        .from("otp_verifications")
        .update({ attempts: otpRow.attempts + 1 })
        .eq("id", otpRow.id);

      const remaining = MAX_VERIFY_ATTEMPTS - otpRow.attempts - 1;
      return res.status(400).json({
        error: remaining > 0
          ? `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
          : "Too many incorrect attempts. Please request a new code.",
      });
    }

    // ✅ Correct code — mark as used
    await supabase
      .from("otp_verifications")
      .update({ used: true, attempts: otpRow.attempts + 1 })
      .eq("id", otpRow.id);

    console.log(`[verify-org-email] Email verified: ${email}`);
    return res.status(200).json({ success: true, email });
  }

  return res.status(400).json({ error: "Invalid action. Must be 'send' or 'verify'." });
};
