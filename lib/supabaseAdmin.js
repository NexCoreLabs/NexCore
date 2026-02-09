const { createClient } = require("@supabase/supabase-js");

function getSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Ensure environment variables are configured in Vercel.");
  }

  // Validate that we're using the service role key (not anon key)
  // Service role keys typically start with 'eyJ' and are longer than anon keys
  if (!serviceRoleKey.startsWith("eyJ") || serviceRoleKey.length < 200) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY appears to be invalid. Ensure you're using the service_role key, not the anon key.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

module.exports = { getSupabaseAdmin };