/**
 * NexCore — Knowledge Base Embedding Seed Script
 *
 * Usage:
 *   node scripts/seed-knowledge.js
 *
 * Prerequisites:
 *   - Run sql/ai-knowledge.sql in Supabase first (creates the table + sample rows)
 *   - Set the following env vars (or create a .env file):
 *       SUPABASE_URL
 *       SUPABASE_SERVICE_ROLE_KEY   (service role — can write embeddings)
 *       GEMINI_API_KEY
 *
 * What it does:
 *   1. Fetches all ai_knowledge rows where embedding IS NULL
 *   2. Generates a 768-dimensional embedding via Gemini text-embedding-004
 *   3. Updates the row with the computed embedding
 *
 * Re-run safely: only processes rows with missing embeddings.
 * To re-embed everything, set embedding = NULL on the rows first.
 */

'use strict';

// Load .env if present (optional — Vercel injects env vars automatically)
try { require('dotenv').config(); } catch (_) {}

const { createClient } = require('@supabase/supabase-js');
const { GoogleGenAI }  = require('@google/genai');

// ─── Config ──────────────────────────────────────────────────────────────────
const SUPABASE_URL          = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY        = process.env.GEMINI_API_KEY;
const EMBED_MODEL           = 'models/text-embedding-004'; // 768 dimensions

// Delay between Gemini API calls to avoid hitting rate limits (ms)
const RATE_DELAY_MS = 500;

// ─── Validate env ────────────────────────────────────────────────────────────
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !GEMINI_API_KEY) {
  console.error('❌  Missing required env vars:');
  if (!SUPABASE_URL)         console.error('   - SUPABASE_URL');
  if (!SUPABASE_SERVICE_KEY) console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  if (!GEMINI_API_KEY)       console.error('   - GEMINI_API_KEY');
  process.exit(1);
}

// ─── Clients ─────────────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// ─── Helpers ─────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generate a 768-dimensional embedding for a text string.
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function generateEmbedding(text) {
  const result = await ai.models.embedContent({
    model: EMBED_MODEL,
    contents: text
  });

  // Defensive extraction across SDK versions
  const values =
    result?.embeddings?.[0]?.values ||
    result?.embedding?.values       ||
    null;

  if (!values || !Array.isArray(values) || values.length === 0) {
    throw new Error(`Unexpected embedding response shape: ${JSON.stringify(result).slice(0, 200)}`);
  }

  return values;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀  NexCore knowledge base — embedding seed script');
  console.log(`    Model : ${EMBED_MODEL}`);
  console.log(`    Target: ${SUPABASE_URL}\n`);

  // Fetch rows that still need embeddings
  const { data: rows, error: fetchErr } = await supabase
    .from('ai_knowledge')
    .select('id, title, content, source')
    .is('embedding', null)
    .order('created_at', { ascending: true });

  if (fetchErr) {
    console.error('❌  Failed to fetch rows:', fetchErr.message);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.log('✅  All rows already have embeddings. Nothing to do.');
    return;
  }

  console.log(`📚  Found ${rows.length} row(s) without embeddings.\n`);

  let successCount = 0;
  let failCount    = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const label = `[${i + 1}/${rows.length}] "${row.title}"`;

    try {
      // Combine title + content for a richer embedding
      const textToEmbed = `${row.title}\n\n${row.content}`;
      const embedding   = await generateEmbedding(textToEmbed);

      // Update this row in Supabase
      const { error: updateErr } = await supabase
        .from('ai_knowledge')
        .update({ embedding })
        .eq('id', row.id);

      if (updateErr) throw new Error(updateErr.message);

      console.log(`  ✅  ${label}`);
      successCount++;
    } catch (err) {
      console.error(`  ❌  ${label} — ${err.message}`);
      failCount++;
    }

    // Respect Gemini free-tier rate limits
    if (i < rows.length - 1) await sleep(RATE_DELAY_MS);
  }

  console.log(`\n────────────────────────────────`);
  console.log(`Done.  ✅ ${successCount} embedded   ❌ ${failCount} failed`);

  if (failCount > 0) {
    console.log('Re-run the script to retry failed rows (they still have NULL embeddings).');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
