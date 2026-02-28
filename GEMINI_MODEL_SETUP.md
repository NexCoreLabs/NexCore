# Gemini Model Configuration & Discovery

## 🔧 What Changed

### 1. Dynamic Model Support in `/api/ai.js`
- Added `GEMINI_MODEL` environment variable support
- Defaults to `gemini-1.5-flash` if not specified
- Builds endpoint URL dynamically: `https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent`

### 2. Enhanced Error Logging
```
🤖 Using Gemini model: gemini-1.5-flash
📍 Gemini endpoint: https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent
📊 AI fetch status: 404
```

If there's a 404 error, the log now shows:
```
❌ Gemini error: {
  "status": 404,
  "model": "gemini-1.5-flash",
  "endpoint": "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
  "error": "Model not found..."
}
```

### 3. New `/api/models` Endpoint (Temporary)
Lists all available Gemini models from the API without needing local curl.

## 🚀 How to Use

### Step 1: Discover Available Models

**Option A: Via Browser (Easiest)**
```
https://nexcorelabs.vercel.app/api/models
```

**Response:**
```json
{
  "success": true,
  "count": 15,
  "models": [
    {
      "name": "models/gemini-1.5-pro",
      "displayName": "Gemini 1.5 Pro",
      "description": "..."
    },
    {
      "name": "models/gemini-1.5-flash",
      "displayName": "Gemini 1.5 Flash",
      "description": "..."
    },
    ...
  ],
  "recommended": ["models/gemini-1.5-pro", "models/gemini-1.5-flash"],
  "suggestions": [
    "Use GEMINI_MODEL env var in /api/ai with one of these values:",
    "models/gemini-1.5-pro",
    "models/gemini-1.5-flash",
    ...
  ]
}
```

**Option B: Direct curl**
```bash
curl "https://nexcorelabs.vercel.app/api/models"

# Or with your Gemini API key locally
curl "https://generativelanguage.googleapis.com/v1beta/models" \
  -H "x-goog-api-key: YOUR_KEY"
```

### Step 2: Choose a Model

Look at the response and pick a model name. The format is:
```
models/gemini-1.5-flash
models/gemini-1.5-pro
models/gemini-2.0-flash-exp
models/gemini-pro
etc.
```

**Currently working models (as of Feb 2026):**
- ✅ `models/gemini-1.5-flash` (Fast, efficient, recommended)
- ✅ `models/gemini-1.5-pro` (Larger, more capable)
- ✅ `models/gemini-pro` (Older, still works)

### Step 3: Set Environment Variable in Vercel

Go to Vercel Project Settings → Environment Variables:

**Add:**
```
GEMINI_MODEL=models/gemini-1.5-flash
```

**Or use a different model:**
```
GEMINI_MODEL=models/gemini-1.5-pro
GEMINI_MODEL=models/gemini-2.0-flash-exp
```

### Step 4: Redeploy

```bash
git add .
git commit -m "Update Gemini model to gemini-1.5-flash"
git push origin dev
```

Wait for Vercel deployment to complete, then test dashboard.

## 🧪 Testing

### Check Current Model in Use

Look at DevTools Console or Vercel Function Logs:
```
🤖 Using Gemini model: models/gemini-1.5-flash
📍 Gemini endpoint: https://generativelanguage.googleapis.com/v1beta/models/models/gemini-1.5-flash:generateContent
```

### Successful Response
```
🤖 Using Gemini model: models/gemini-1.5-flash
📍 Gemini endpoint: https://...
📊 AI fetch status: 200
📦 AI response data: {result: "Generated text...", used: 1, remaining: 2}
✅ AI generation successful
```

### 404 Error (Model Not Found)
```
❌ Gemini error: {
  "status": 404,
  "model": "models/gemini-1.5-flash",
  "endpoint": "https://...:generateContent",
  "error": "Resource not found..."
}
```

**Solution:** Check `/api/models` endpoint to find available models.

## 📝 Configuration Reference

### Default Behavior
If `GEMINI_MODEL` is NOT set:
```javascript
const GEMINI_MODEL = 'gemini-1.5-flash';
```

### Override Example
If you set `GEMINI_MODEL=models/gemini-1.5-pro` in Vercel:
```
Endpoint will use: models/gemini-1.5-pro
URL becomes: https://generativelanguage.googleapis.com/v1beta/models/models/gemini-1.5-pro:generateContent
```

### All Settings Needed in Vercel
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL=models/gemini-1.5-flash (optional, defaults to gemini-1.5-flash)
```

## 📊 Error Response Format (Enhanced)

### Before
```json
{
  "error": "Gemini API failed",
  "details": "Error text..."
}
```

### After
```json
{
  "error": "Gemini API failed",
  "details": "Model: models/gemini-1.5-flash, Status: 404, Error: Resource not found...",
  "endpoint": "https://generativelanguage.googleapis.com/v1beta/models/models/gemini-1.5-flash:generateContent"
}
```

**Much easier to debug!** You can see exactly which model was used and what URL was called.

## 🔍 Vercel Function Logs

When deployment is live, check Vercel Logs → Select `/api/ai` function:

```
LOG  🤖 Using Gemini model: models/gemini-1.5-flash
LOG  📍 Gemini endpoint: https://generativelanguage.googleapis.com/v1beta/models/models/gemini-1.5-flash:generateContent
LOG  📊 AI fetch status: 200
LOG  ✅ Returned: {result: "...", used: 1, remaining: 2}
```

## 🗑️ Cleanup (Optional)

### Remove Temporary Models Endpoint

After confirming your model works, you can delete `/api/models.js` if desired:

```bash
rm api/models.js
git add .
git commit -m "Remove temporary models endpoint"
git push origin dev
```

**But keep it if you want:**
- Useful for future model testing
- Can be called from dashboard to show available models to admin
- No cost or side effects

## 💡 Recommendations

### Fastest Performance
```
GEMINI_MODEL=models/gemini-1.5-flash
```

### Best Quality
```
GEMINI_MODEL=models/gemini-1.5-pro
```

### Good Balance (Default)
```
GEMINI_MODEL=models/gemini-1.5-flash (or don't set, uses default)
```

## 📋 Troubleshooting

### Problem: Still Getting 404

1. Check `/api/models` endpoint to see available models
2. Verify `GEMINI_MODEL` env var is set correctly in Vercel
3. Wait for Vercel deployment to complete (check Deployments tab)
4. Clear browser cache and reload dashboard

### Problem: Model not showing in logs

1. Look at Vercel Function Logs → `/api/ai`
2. Should see: `🤖 Using Gemini model: ...`
3. If not showing, API might be crashing before that log

### Problem: Got a different error

1. Check full error in response JSON: `details` and `endpoint` fields
2. Verify API key is correct
3. Verify Supabase credentials are correct
4. Check Gemini API quota hasn't been exceeded

## 🎯 Summary

| Component | Location | Purpose |
|-----------|----------|---------|
| `/api/ai.js` | Main AI endpoint | Generate content (POST) |
| `/api/models.js` | New temporary endpoint | Discover available models (GET) |
| `GEMINI_MODEL` | Vercel env var | Configure which Gemini model to use |
| `GEMINI_ENDPOINT` | Dynamic in code | Built from model name |

## ✅ Deployment Checklist

- [ ] Run `/api/models` to see available models
- [ ] Choose a model (recommend: `gemini-1.5-flash`)
- [ ] Set `GEMINI_MODEL` env var in Vercel
- [ ] Commit code changes
- [ ] Push to dev branch
- [ ] Wait for Vercel deployment
- [ ] Test dashboard AI button
- [ ] Check console shows: `🤖 Using Gemini model: ...`
- [ ] Verify counter updates: "AI uses left today: 2/3"

---

**Version:** 1.3 (Model Support)  
**Status:** 🟢 Ready to test  
**Last Updated:** February 28, 2026
