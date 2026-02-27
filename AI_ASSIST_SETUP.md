# AI Assist - Quick Setup Guide

## 🎯 Overview
AI Assist has been added to dashboard.html with daily limits (3/day per user).

## 📁 Files Created
- ✅ `/api/ai.js` - Vercel serverless endpoint
- ✅ `supabase_ai_migration.sql` - Database setup
- ✅ `AI_ASSIST_IMPLEMENTATION.md` - Full documentation
- ✅ Modified `dashboard.html` - Added UI and handlers

## 🚀 Setup (3 Steps)

### 1. Configure Vercel Environment Variables

Add to your Vercel project settings:

```bash
GEMINI_API_KEY=<your_key>
NEXT_PUBLIC_SUPABASE_URL=<your_url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_key>
```

Get Gemini API key: https://ai.google.dev/

### 2. Run Database Migration

In Supabase SQL Editor, run `supabase_ai_migration.sql`:

```sql
-- Creates ai_usage table and consume_ai_use() RPC function
-- Copy and paste the entire file contents and execute
```

### 3. Deploy

```bash
git add .
git commit -m "Add AI Assist feature"
git push origin main
```

Or with Vercel CLI:
```bash
vercel --prod
```

## ✅ Test

1. Sign in to dashboard
2. Find "✨ AI Assist" sections (with BETA badge)
3. Try generating AI content
4. Check "AI uses left today: 2/3" counter
5. Use 3 times, 4th should show "Daily limit reached"

## 🔒 Security Verified

- ✅ GEMINI_API_KEY never exposed to browser
- ✅ JWT verification on every API call
- ✅ Server-side rate limiting
- ✅ RLS policies on database

## 📖 Full Docs

See `AI_ASSIST_IMPLEMENTATION.md` for complete details.

---

**Status:** Ready to deploy 🚀
