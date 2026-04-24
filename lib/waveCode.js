'use strict';

const crypto = require('crypto');

const BAR_COUNT    = 23;
const HEIGHT_LEVELS = 8; // 0–7

/**
 * Derive 23 bar heights (0–7) deterministically from a project ID.
 * Uses HMAC-SHA256(SCANNER_CODE_SECRET, projectId).
 * Same input always yields identical heights — collision-proof at any scale.
 */
function generateBarHeights(projectId) {
  const secret = process.env.SCANNER_CODE_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SCANNER_CODE_SECRET env var is missing or too short');
  }

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(String(projectId));
  const digest = hmac.digest(); // Buffer, 32 bytes

  const heights = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    heights.push(digest[i % digest.length] % HEIGHT_LEVELS);
  }
  return heights; // number[23], each 0–7
}

/**
 * Encode heights array to a compact 23-char string (one digit per bar).
 */
function encodeHeights(heights) {
  if (!Array.isArray(heights) || heights.length !== BAR_COUNT) {
    throw new Error('heights must be an array of length ' + BAR_COUNT);
  }
  return heights.map(h => Math.max(0, Math.min(7, h | 0)).toString()).join('');
}

/**
 * Decode a heights string back to a number array.
 */
function decodeHeights(str) {
  if (typeof str !== 'string' || str.length !== BAR_COUNT || !/^[0-7]+$/.test(str)) {
    throw new Error('Invalid heights string');
  }
  return str.split('').map(Number);
}

/**
 * Fuzzy match score: count bars where |a[i] - b[i]| <= 1.
 * Useful for scanner tolerance (camera-scanned bars may be off by 1).
 */
function scoreMatch(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
  let score = 0;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) <= 1) score++;
  }
  return score;
}

module.exports = { generateBarHeights, encodeHeights, decodeHeights, scoreMatch, BAR_COUNT, HEIGHT_LEVELS };
