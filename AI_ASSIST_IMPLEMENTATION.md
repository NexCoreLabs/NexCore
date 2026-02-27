# AI Assist Feature - Implementation Guide

## Overview

The AI Assist feature has been successfully added to NexCore Labs dashboard. It provides two AI-powered capabilities:

1. **AI Improve Page Description** - Refines and enhances project descriptions with style options (Professional, Shorter, Technical, Inspiring)
2. **AI Generate Card Summary** - Creates concise 1-2 sentence summaries for project cards

**Daily Limit:** 3 AI actions per user per day (enforced server-side)

## Files Created/Modified

### ✅ Created Files

1. **`/api/ai.js`** - Vercel serverless function
   - Handles AI generation requests
   - Calls Google Gemini API
   - Enforces 3/day limit via Supabase RPC
   - Validates JWT tokens server-side

2. **`supabase_ai_migration.sql`** - Database setup
   - Creates `ai_usage` table
   - Implements `consume_ai_use()` RPC function
   - Implements `get_ai_usage()` helper function (optional)
   - Includes RLS policies for security
   - Includes cleanup function for old records

### ✅ Modified Files

1. **`dashboard.html`**
   - Added AI UI blocks under `#pageDescription`
   - Added AI UI blocks under `#cardDescription`
   - Added JavaScript event handlers with initialization guard

## Setup Instructions

### Step 1: Configure Vercel Environment Variables

Add these environment variables in your Vercel project settings:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Getting a Gemini API Key:**
1. Go to [Google AI Studio](https://ai.google.dev/)
2. Sign in with your Google account
3. Click "Get API Key"
4. Create a new API key
5. Copy and add to Vercel environment variables

### Step 2: Run Supabase Migration

Execute the SQL migration in your Supabase SQL Editor:

1. Open Supabase Dashboard → SQL Editor
2. Open `supabase_ai_migration.sql`
3. Copy the entire contents
4. Paste and run in SQL Editor
5. Verify success (should create table and functions)

**What the migration does:**
- Creates `ai_usage` table to track daily limits
- Creates `consume_ai_use(max_uses)` RPC function
- Creates `get_ai_usage(max_uses)` helper function
- Sets up Row Level Security (RLS) policies
- Creates indexes for performance

### Step 3: Deploy to Vercel

```bash
# If you have Vercel CLI installed:
vercel --prod

# Or push to your GitHub repository (if auto-deploy is configured)
git add .
git commit -m "Add AI Assist feature with Gemini integration"
git push origin main
```

### Step 4: Verify Deployment

1. Visit your dashboard: `https://nexcorelabs.vercel.app/dashboard.html`
2. Sign in with your Google account
3. Look for the "✨ AI Assist" sections with BETA badge
4. Test functionality (see Testing section below)

## Features & UI Elements

### 1. AI Improve Page Description

**Location:** Under "Detailed Description (Page)" textarea

**UI Components:**
- Style dropdown with options:
  - Professional
  - Shorter
  - Technical
  - Inspiring
- "Generate" button
- Read-only output preview
- "Replace page description" button
- "Copy" button
- Status message area
- Remaining uses counter: "AI uses left today: X/3"

**Behavior:**
- Reads content from `#pageDescription`
- Applies selected style transformation
- Shows output in preview area
- Updates remaining uses counter
- Can replace or copy generated text

### 2. AI Generate Card Summary

**Location:** Under "Short Description" input

**UI Components:**
- "✨ Generate from page description" button
- Read-only output preview
- "Replace card description" button
- "Copy" button
- Status message area
- Remaining uses counter

**Behavior:**
- Reads content from `#pageDescription` as source
- Generates 1-2 sentence summary (60-80 words)
- Suitable for project card display on hub
- Can replace or copy generated text

## API Endpoint Specification

### POST `/api/ai`

**Authentication:** Required (Bearer token in Authorization header)

**Request Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <user_access_token>"
}
```

**Request Body:**

For page improvement:
```json
{
  "action": "improve_page",
  "style": "Professional|Shorter|Technical|Inspiring",
  "text": "Original page description..."
}
```

For card summary:
```json
{
  "action": "card_summary",
  "text": "Source page description..."
}
```

**Success Response (200):**
```json
{
  "result": "Generated text...",
  "used": 1,
  "remaining": 2
}
```

**Error Responses:**

- **401 Unauthorized:** Invalid or missing token
- **429 Too Many Requests:** Daily limit reached
  ```json
  {
    "error": "AI daily limit reached",
    "remaining": 0,
    "message": "You have reached your daily limit of 3 AI actions. Try again tomorrow."
  }
  ```
- **400 Bad Request:** Missing or invalid parameters
- **500 Internal Server Error:** Server or API error

## Testing Checklist

### ✅ Signed In Tests

1. **First AI call:**
   - Click "Generate" on either feature
   - Should show "AI uses left today: 2/3"
   - Output should appear

2. **Second AI call:**
   - Use another AI feature
   - Should show "AI uses left today: 1/3"

3. **Third AI call:**
   - Use AI feature again
   - Should show "AI uses left today: 0/3"

4. **Fourth AI call (rate limited):**
   - Try to use AI again
   - Should display error: "AI daily limit reached"
   - Should show "AI uses left today: 0/3"
   - HTTP 429 status in network tab

5. **Replace functionality:**
   - Generate AI output
   - Click "Replace" button
   - Should copy text to source field
   - Should show reminder to save changes

6. **Copy functionality:**
   - Generate AI output
   - Click "Copy" button
   - Should show "Copied!" feedback
   - Should be in clipboard

### ✅ Signed Out Test

1. Sign out
2. Try to access dashboard
3. Should redirect to auth page

### ✅ Security Tests

1. **Check browser console:**
   - GEMINI_API_KEY should NEVER appear
   - All API calls should go to `/api/ai`

2. **Check Network tab:**
   - API calls should include `Authorization: Bearer <token>`
   - 401 errors if token is invalid/expired

## Security Features

### ✅ Server-Side Only
- ❌ GEMINI_API_KEY never exposed to browser
- ✅ API calls only from Vercel serverless function
- ✅ Environment variable protection

### ✅ Authentication & Authorization
- ✅ JWT validation on every API call
- ✅ Supabase `auth.getUser()` verification
- ✅ User-specific rate limiting
- ✅ RLS policies on `ai_usage` table

### ✅ Rate Limiting
- ✅ 3 actions per user per day
- ✅ Atomic counter increment (race condition safe)
- ✅ Database-level enforcement
- ✅ Daily reset at midnight (UTC)

### ✅ Data Integrity
- ✅ No prompt injection protection (input used as-is)
- ✅ Output length limits (via Gemini config)
- ✅ No data invented (prompts enforce accuracy)

## Troubleshooting

### Issue: "Failed to generate AI response"

**Possible causes:**
1. Invalid GEMINI_API_KEY
2. Gemini API quota exceeded
3. Network connectivity issues

**Solution:**
- Check Vercel environment variables
- Verify Gemini API key is active
- Check Gemini API quotas in Google AI Studio

### Issue: "AI daily limit reached" too early

**Possible causes:**
1. Testing with multiple calls
2. Counter not reset (different timezone)

**Solution:**
- Check `ai_usage` table in Supabase:
  ```sql
  SELECT * FROM ai_usage WHERE user_id = '<your_user_id>';
  ```
- Manually reset for testing:
  ```sql
  UPDATE ai_usage 
  SET use_count = 0 
  WHERE user_id = '<your_user_id>' AND usage_date = CURRENT_DATE;
  ```

### Issue: Authentication errors (401)

**Possible causes:**
1. User not signed in
2. Token expired
3. Invalid Supabase configuration

**Solution:**
- Verify user is signed in
- Check Supabase URL and anon key in Vercel
- Try signing out and back in

### Issue: Button not responding

**Possible causes:**
1. JavaScript not loaded
2. Event handler initialization failed

**Solution:**
- Check browser console for errors
- Clear cache and reload
- Verify no JavaScript conflicts

## Database Schema

### Table: `ai_usage`

```sql
CREATE TABLE public.ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  use_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, usage_date)
);
```

### RPC Function: `consume_ai_use(max_uses INT)`

**Purpose:** Atomically increment AI usage and enforce daily limit

**Returns:**
```json
{
  "used": 1,
  "remaining": 2
}
```

**Throws:** Exception "AI daily limit reached" if limit exceeded

## Gemini API Configuration

**Model:** `gemini-2.0-flash-exp` (fast, efficient)

**Configuration:**
- Temperature: 0.7 (balanced creativity)
- Max tokens: 
  - Card summary: 150 tokens (~60-80 words)
  - Page improvement: 500 tokens (~200-300 words)

**Prompts:**
- Strict rules: No inventing facts
- Only rewrite/restructure provided text
- Output plain text (no markdown)

## Cost Estimates

### Gemini API (Free tier as of Feb 2026)
- 15 requests per minute
- 1,500 requests per day
- Free for moderate usage

**With 3/day limit per user:**
- 500 users max per day (free tier)
- Beyond that, consider paid tier or increase limits

### Supabase
- Database operations: Minimal (one INSERT/UPDATE per AI call)
- RPC calls: Very fast (<10ms typically)
- Storage: ~100 bytes per user per day

## Future Enhancements

Potential improvements (not included in V1):

1. **Admin analytics dashboard**
   - Track total AI usage across all users
   - View most popular features
   - Monitor API costs

2. **Premium tier**
   - Increase limit to 10/day for paid users
   - Add more AI features (title generation, etc.)

3. **Prompt templates**
   - Allow users to customize prompts
   - Save favorite styles

4. **Batch operations**
   - Generate multiple variations at once
   - A/B test different versions

5. **Usage history**
   - Show user's past AI generations
   - Allow regeneration with same input

## Support & Maintenance

### Monitoring

Check these regularly:
1. Vercel function logs for errors
2. Supabase logs for RPC failures
3. Gemini API quotas and usage

### Database Cleanup

Run periodically (recommended: monthly):
```sql
SELECT cleanup_old_ai_usage();
```

This removes records older than 90 days to keep table size manageable.

### Updating AI Prompts

Edit prompts in `/api/ai.js`:
- Lines ~80-95: improve_page prompts
- Lines ~97-106: card_summary prompts

Deploy changes with:
```bash
vercel --prod
```

## Questions or Issues?

- Check browser console for errors
- Check Vercel function logs
- Review Supabase logs
- Verify environment variables are set correctly

---

**Implementation completed:** February 28, 2026  
**Version:** 1.0 (Beta)  
**Status:** ✅ Ready for testing
