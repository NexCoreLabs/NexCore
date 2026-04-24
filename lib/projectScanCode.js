'use strict';
const crypto = require('crypto');

function getScannerSecret() {
  const secret = process.env.SCANNER_CODE_SECRET;
  if (secret && secret.length >= 16) {
    return secret;
  }

  throw new Error('SCANNER_CODE_SECRET env var is missing or too short (min 16 chars).');
}

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64UrlDecode(str) {
  const padded = str + '==='.slice((str.length + 3) % 4);
  return Buffer.from(
    padded.replace(/-/g, '+').replace(/_/g, '/'),
    'base64'
  ).toString('utf8');
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, Buffer.alloc(bufA.length));
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Build a signed NexCore scan code for a project.
 * @param {{id: string, slug: string, public_id: string}} project
 * @returns {string} NXC1.<payload>.<signature>
 */
function buildProjectScanCode(project) {
  const secret = getScannerSecret();
  const payload = {
    v: 1,
    project_id: project.id,
    slug: project.slug,
    public_id: project.public_id,
    iat: Math.floor(Date.now() / 1000)
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const sig = crypto
    .createHmac('sha256', secret)
    .update(`NXC1.${encodedPayload}`)
    .digest('hex');
  return `NXC1.${encodedPayload}.${sig}`;
}

/**
 * Verify a NexCore scan code.
 * @param {string} token
 * @returns {{ok: boolean, payload?: object, error?: string}}
 */
function verifyProjectScanCode(token) {
  if (typeof token !== 'string') return { ok: false, error: 'invalid_token' };
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'NXC1') {
    return { ok: false, error: 'invalid_format' };
  }
  const [prefix, encodedPayload, sig] = parts;
  let secret;
  try {
    secret = getScannerSecret();
  } catch {
    return { ok: false, error: 'server_config_error' };
  }
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`${prefix}.${encodedPayload}`)
    .digest('hex');
  if (!timingSafeEqual(sig, expectedSig)) {
    return { ok: false, error: 'invalid_signature' };
  }
  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch {
    return { ok: false, error: 'invalid_payload' };
  }
  if (payload.v !== 1 || !payload.project_id || !payload.slug) {
    return { ok: false, error: 'invalid_payload' };
  }
  return { ok: true, payload };
}

module.exports = { buildProjectScanCode, verifyProjectScanCode };
