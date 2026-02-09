/**
 * Vercel Serverless Function: Delete User Account
 * 
 * Required environment variables (set in Vercel dashboard):
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * 
 * Deploy notes:
 * 1. Add the above env vars in Vercel project settings
 * 2. Redeploy after setting env vars
 * 
 * Security: SERVICE_ROLE_KEY is never exposed to browser.
 */

const { getSupabaseAdmin } = require("../lib/supabaseAdmin");

// Owner column in projects table (detected from codebase)
const OWNER_COL = "user_id";

module.exports = async (req, res) => {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Read Authorization header
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }

    const token = authHeader.substring(7); // Remove "Bearer "
    if (!token) {
      return res.status(401).json({ error: "No access token provided" });
    }

    // Initialize Supabase admin client
    const admin = getSupabaseAdmin();

    // Verify token and get user
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    
    if (userError || !userData?.user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const uid = userData.user.id;

    // Step 1: Delete user-owned projects first
    // IMPORTANT: Delete projects before deleting auth user to maintain referential integrity
    const { error: projectsDeleteError } = await admin
      .from("projects")
      .delete()
      .eq(OWNER_COL, uid);

    if (projectsDeleteError) {
      console.error("Failed to delete user projects:", projectsDeleteError);
      return res.status(500).json({ 
        error: "Failed to delete user data", 
        details: projectsDeleteError.message 
      });
    }

    // Step 2: Delete auth user
    const { error: deleteUserError } = await admin.auth.admin.deleteUser(uid);

    if (deleteUserError) {
      console.error("Failed to delete auth user:", deleteUserError);
      return res.status(500).json({ 
        error: "Failed to delete account", 
        details: deleteUserError.message 
      });
    }

    // Success
    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error("Unexpected error in delete-account:", error);
    return res.status(500).json({ 
      error: "Internal server error", 
      details: error.message 
    });
  }
};
