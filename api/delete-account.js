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

// Owner column in projects table (no explicit owner column usage found; user_id is used in exports)
const OWNER_COL = "owner_user_id";

/**
 * Helper to safely return a JSON response
 */
function sendJson(res, statusCode, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(statusCode).end(JSON.stringify(payload));
}

module.exports = async (req, res) => {
  try {
    // Only allow POST
    if (req.method !== "POST") {
      return sendJson(res, 405, {
        ok: false,
        step: "method",
        error: "Method not allowed"
      });
    }

    // STEP 1: Validate environment variables
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing environment variables", {
        hasUrl: !!supabaseUrl,
        hasKey: !!serviceRoleKey
      });
      return sendJson(res, 500, {
        ok: false,
        step: "env",
        error: "Missing env vars",
        details: {
          SUPABASE_URL: !!supabaseUrl,
          SUPABASE_SERVICE_ROLE_KEY: !!serviceRoleKey
        }
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
      return sendJson(res, 500, {
        ok: false,
        step: "admin_client",
        error: error.message || String(error)
      });
    }

    // STEP 3: Parse token ONLY from Authorization header (case-insensitive)
    const authHeader = req.headers.authorization || req.headers.Authorization || "";
    console.log("AUTH HEADER:", req.headers.authorization ? "present" : "missing");
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      console.error("No token found in request");
      return sendJson(res, 401, {
        ok: false,
        step: "getUser",
        error: "Auth session missing!",
      });
    }

    console.log(`[delete-account] Received token, length: ${token.length}`);

    // STEP 4: Verify token and get user
    let userData, userError;
    try {
      const result = await admin.auth.getUser(token);
      userData = result.data;
      userError = result.error;
    } catch (error) {
      console.error("Error calling admin.auth.getUser:", error);
      return sendJson(res, 500, {
        ok: false,
        step: "getUser",
        error: error.message || String(error),
        code: error.code || null
      });
    }

    if (userError || !userData?.user) {
      console.error("Invalid token or getUser failed:", {
        error: userError,
        hasUserData: !!userData,
        hasUser: !!userData?.user
      });
      return sendJson(res, 401, {
        ok: false,
        step: "getUser",
        error: userError?.message || "Auth session missing!",
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
        .delete({ count: "exact" })
        .eq(OWNER_COL, uid);
      
      projectsDeleteError = result.error;
    } catch (error) {
      console.error("Exception during projects delete:", error);
      return sendJson(res, 500, {
        ok: false,
        step: "delete_projects",
        error: error.message || String(error),
        details: error.details || null,
        code: error.code || null,
        hint: error.hint || null
      });
    }

    if (projectsDeleteError) {
      console.error(`Failed to delete projects for user ${uid}:`, projectsDeleteError);
      return sendJson(res, 500, {
        ok: false,
        step: "delete_projects",
        error: projectsDeleteError.message || String(projectsDeleteError),
        details: projectsDeleteError.details || projectsDeleteError.message || String(projectsDeleteError),
        code: projectsDeleteError.code || null,
        hint: projectsDeleteError.hint || null
      });
    }

    // STEP 6: Delete auth user (LAST - after all data is cleaned)
    let deleteUserError;
    try {
      const result = await admin.auth.admin.deleteUser(uid);
      deleteUserError = result.error;
    } catch (error) {
      console.error("Exception during delete auth user:", error);
      return sendJson(res, 500, {
        ok: false,
        step: "delete_auth_user",
        error: error.message || String(error),
        details: error.details || null,
        code: error.code || null
      });
    }

    if (deleteUserError) {
      console.error(`Failed to delete auth user ${uid}:`, deleteUserError);
      return sendJson(res, 500, {
        ok: false,
        step: "delete_auth_user",
        error: deleteUserError.message || String(deleteUserError),
        details: deleteUserError.details || deleteUserError.message || String(deleteUserError),
        code: deleteUserError.code || null
      });
    }

    // Success
    console.log(`[delete-account] Successfully deleted user: ${uid}`);
    return sendJson(res, 200, {
      ok: true,
      uid,
    });

  } catch (error) {
    console.error("Unexpected error in delete-account:", error);
    return sendJson(res, 500, {
      ok: false,
      step: "unexpected_error",
      error: error.message || "Internal server error",
      details: error.stack || null
    });
  }
};
