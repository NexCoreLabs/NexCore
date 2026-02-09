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

const { createClient } = require("@supabase/supabase-js");

// Owner column in projects table (detected from codebase - account.html uses user_id)
const OWNER_COL = "user_id";

/**
 * Helper to safely return a JSON error response
 */
function returnError(res, statusCode, step, errorObj, details = null) {
  return res.status(statusCode).json({
    ok: false,
    step,
    error: errorObj.message || String(errorObj),
    message: errorObj.message || String(errorObj),
    code: errorObj.code || null,
    hint: errorObj.hint || null,
    details: details || null
  });
}

module.exports = async (req, res) => {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      step: "method_not_allowed",
      error: "Method not allowed",
      message: "Only POST requests are supported"
    });
  }

  try {
    // STEP 1: Validate environment variables
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing environment variables", {
        hasUrl: !!supabaseUrl,
        hasKey: !!serviceRoleKey
      });
      return res.status(500).json({
        ok: false,
        step: "env",
        error: "Missing environment variables",
        message: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured",
        code: "env_missing"
      });
    }

    // STEP 2: Create admin client
    let admin;
    try {
      admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false }
      });
    } catch (error) {
      console.error("Failed to create Supabase admin client:", error);
      return returnError(res, 500, "admin_client", error);
    }

    // STEP 3: Read and validate Authorization header
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        ok: false,
        step: "auth_header",
        error: "Missing or invalid Authorization header",
        message: "Expected 'Authorization: Bearer <token>'"
      });
    }

    const token = authHeader.substring(7); // Remove "Bearer "
    if (!token || token.length === 0) {
      return res.status(401).json({
        ok: false,
        step: "auth_header",
        error: "No access token provided",
        message: "Token is empty"
      });
    }

    // STEP 4: Verify token and get user
    let userData, userError;
    try {
      const result = await admin.auth.getUser(token);
      userData = result.data;
      userError = result.error;
    } catch (error) {
      console.error("Error calling admin.auth.getUser:", error);
      return returnError(res, 500, "getUser", error);
    }

    if (userError || !userData?.user) {
      console.error("Invalid token or getUser failed:", userError);
      return res.status(401).json({
        ok: false,
        step: "getUser",
        error: userError?.message || "Invalid or expired token",
        message: userError?.message || "Token validation failed",
        code: userError?.code || null
      });
    }

    const uid = userData.user.id;
    console.log(`[delete-account] Deleting user: ${uid}`);

    // STEP 5: Delete user-owned projects first
    let projectsDeleteError;
    try {
      const result = await admin
        .from("projects")
        .delete()
        .eq(OWNER_COL, uid);
      
      projectsDeleteError = result.error;
    } catch (error) {
      console.error("Exception during projects delete:", error);
      return returnError(res, 500, "delete_projects", error);
    }

    if (projectsDeleteError) {
      console.error(`Failed to delete projects for user ${uid}:`, projectsDeleteError);
      return returnError(res, 500, "delete_projects", projectsDeleteError);
    }

    // STEP 6: Delete auth user (LAST - after all data is cleaned)
    let deleteUserError;
    try {
      const result = await admin.auth.admin.deleteUser(uid);
      deleteUserError = result.error;
    } catch (error) {
      console.error("Exception during delete auth user:", error);
      return returnError(res, 500, "delete_auth_user", error);
    }

    if (deleteUserError) {
      console.error(`Failed to delete auth user ${uid}:`, deleteUserError);
      return returnError(res, 500, "delete_auth_user", deleteUserError);
    }

    // Success
    console.log(`[delete-account] Successfully deleted user: ${uid}`);
    return res.status(200).json({
      ok: true,
      uid,
      message: "Account and all associated data deleted successfully"
    });

  } catch (error) {
    console.error("Unexpected error in delete-account:", error);
    return res.status(500).json({
      ok: false,
      step: "unexpected_error",
      error: error.message || "Internal server error",
      message: error.message || "An unexpected error occurred",
      code: error.code || "internal_error",
      details: error.stack || null
    });
  }
};
