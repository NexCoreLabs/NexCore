'use strict';

const crypto = require('crypto');

const BAR_COUNT    = 23;
const HEIGHT_LEVELS = 8;

function generateCodeBytes(projectId) {
  const secret = process.env.SCANNER_CODE_SECRET;
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error('SCANNER_CODE_SECRET env var is missing or too short');
  }
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(String(projectId));
  return Array.from(hmac.digest());
}

function generateBarHeights(projectId) {
  const bytes = generateCodeBytes(projectId);
  return bytes.slice(0, BAR_COUNT).map(function(b) { return b % HEIGHT_LEVELS; });
}

function encodeHeights(heights) {
  if (!Array.isArray(heights) || heights.length !== BAR_COUNT) {
    throw new Error('heights must be an array of length ' + BAR_COUNT);
  }
  return heights.map(function(h) { return Math.max(0, Math.min(7, h | 0)).toString(); }).join('');
}

function decodeHeights(str) {
  if (typeof str !== 'string' || str.length !== BAR_COUNT) {
    throw new Error('Invalid heights string');
  }
  return str.split('').map(Number);
}

function scoreMatch(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
  var score = 0;
  for (var i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) <= 1) score++;
  }
  return score;
}

module.exports = { generateCodeBytes, generateBarHeights, encodeHeights, decodeHeights, scoreMatch, BAR_COUNT, HEIGHT_LEVELS };