# 🚀 Database-Driven Whitelist - Deployment Guide

## ✅ Setup Complete! Here's what was done:

### Files Modified:
- ✅ **13 HTML files** updated to use `auth-ui-db.js`
- ✅ All authentication now checks the database for approved users

### Files Created:
- ✅ `assets/js/auth-ui-db.js` - Database-driven auth handler
- ✅ `sql/create_approved_users_table.sql` - Database schema
- ✅ `admin-users.html` - Admin interface for managing users
- ✅ `APPROVED_USERS_GUIDE.md` - Complete documentation

---

## 📋 Deployment Steps

### Step 1: Create Database Table in Supabase

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard
   - Select your NexCore project

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Run the SQL Script**
   - Copy the contents of `sql/create_approved_users_table.sql`
   - Paste into the SQL editor
   - Click "Run" or press Ctrl+Enter

4. **Verify Table Creation**
   - Go to "Table Editor" in left sidebar
   - You should see `approved_users` table

**Quick Copy SQL:**
```sql
CREATE TABLE IF NOT EXISTS approved_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    approved_by TEXT,
    reason TEXT,
    approved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approved_users_email ON approved_users(email);

ALTER TABLE approved_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read approved users"
    ON approved_users FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert approved users"
    ON approved_users FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');
```

---

### Step 2: Deploy Code Changes

1. **Commit your changes:**
   ```bash
   git add .
   git commit -m "feat: switch to database-driven user whitelist with admin UI"
   git push
   ```

2. **Deploy to Vercel** (or your hosting platform)
   - Changes will deploy automatically if you have auto-deploy enabled
   - Or manually trigger a deployment

---

### Step 3: Add Your First Approved User

#### Option A: Using Admin Interface (Recommended) 🎨

1. **Navigate to the admin page:**
   ```
   https://your-domain.com/admin-users.html
   ```

2. **Sign in** with your SQU account

3. **Add a user:**
   - Enter email address
   - Add reason (optional)
   - Click "Approve User"

4. **Done!** The user can now sign in.

#### Option B: Using SQL (Direct)

In Supabase SQL Editor:
```sql
INSERT INTO approved_users (email, approved_by, reason) VALUES
('partner@example.com', 'your-email@squ.edu.om', 'External collaborator'),
('researcher@gmail.com', 'your-email@squ.edu.om', 'Research partner');
```

#### Option C: Using Browser Console

1. Open browser console (F12)
2. Navigate to any NexCore page
3. Run:
```javascript
await window.addApprovedUser(
    'user@example.com',
    'your-email@squ.edu.om',
    'Reason for approval'
);
```

---

### Step 4: Test Authentication

1. **Open incognito/private window**
2. **Navigate to:** https://your-domain.com/auth.html
3. **Sign in** with the approved email
4. **Should work!** ✨

---

## 🔍 Verification Checklist

Before going live, verify:

- [ ] Database table created successfully
- [ ] RLS policies applied
- [ ] All HTML files using `auth-ui-db.js`
- [ ] Code deployed to production
- [ ] Admin page accessible at `/admin-users.html`
- [ ] Can add users via admin interface
- [ ] Can remove users via admin interface
- [ ] Approved non-SQU user can sign in
- [ ] Non-approved user is blocked

---

## 🎯 How It Works

### Authentication Flow:

```
User signs in with Google
    ↓
Check email domain
    ↓
Is it @squ.edu.om or @student.squ.edu.om?
    ↓ YES                          ↓ NO
    ↓                              ↓
Allow access             Check database whitelist
                                   ↓
                         Is email in approved_users?
                                   ↓
                         YES ↓         ↓ NO
                             ↓         ↓
                      Allow access   Block access
```

### Database Schema:

```sql
approved_users
├── id (UUID)
├── email (TEXT, UNIQUE)      ← The approved email
├── approved_by (TEXT)         ← Who approved them
├── reason (TEXT)              ← Why they were approved
├── approved_at (TIMESTAMP)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)
```

---

## 🛠️ Managing Users

### Add User:
```javascript
await window.addApprovedUser(
    'user@example.com',
    'admin@squ.edu.om',
    'Industry partner'
);
```

### Remove User:
```javascript
await window.removeApprovedUser('user@example.com');
```

### List All Users:
```javascript
const { data } = await window.supabaseClient
    .from('approved_users')
    .select('*');
console.table(data);
```

---

## 📊 Admin Dashboard Features

The admin interface at `/admin-users.html` provides:

✅ **Add Users**
- Email validation
- Reason/notes field
- Automatic approver tracking

✅ **View Users**
- All approved users in table
- Shows email, reason, approver
- Real-time updates

✅ **Remove Users**
- One-click removal
- Confirmation dialog
- Instant feedback

✅ **Authentication Required**
- Only authenticated users can access
- Must be signed in with SQU email

---

## 🔐 Security Features

### Row Level Security (RLS):
- ✅ Anyone can READ approved users (needed for auth checks)
- ✅ Only authenticated users can INSERT
- ✅ Only approver can UPDATE/DELETE their entries

### Email Validation:
- ✅ Case-insensitive (all lowercase)
- ✅ Trimmed whitespace
- ✅ Unique constraint (no duplicates)

### Audit Trail:
- ✅ Who approved each user
- ✅ When they were approved
- ✅ Why they were approved
- ✅ Last updated timestamp

---

## 🚨 Troubleshooting

### Issue: "Cannot read approved_users table"
**Solution:** Make sure RLS policy for SELECT is set to `true`:
```sql
CREATE POLICY "Anyone can read approved users"
    ON approved_users FOR SELECT USING (true);
```

### Issue: User can't sign in after being added
**Solution:**
1. Clear browser cache/cookies
2. Sign out and sign in again
3. Check email is exactly correct (case-insensitive)
4. Verify entry exists in database

### Issue: Admin page shows "Loading..." forever
**Solution:**
1. Check browser console for errors
2. Verify table was created correctly
3. Check RLS policies are applied
4. Ensure user is authenticated

---

## 📝 Quick Commands

### Check if table exists:
```sql
SELECT * FROM approved_users LIMIT 1;
```

### Count approved users:
```sql
SELECT COUNT(*) FROM approved_users;
```

### Find user:
```sql
SELECT * FROM approved_users WHERE email = 'user@example.com';
```

### Bulk add users:
```sql
INSERT INTO approved_users (email, approved_by, reason) VALUES
('user1@example.com', 'admin@squ.edu.om', 'Partner'),
('user2@example.com', 'admin@squ.edu.om', 'Collaborator'),
('user3@example.com', 'admin@squ.edu.om', 'Research team');
```

---

## 🎉 You're All Set!

The database-driven whitelist is now active. You can:

1. ✅ Add/remove users dynamically
2. ✅ No code changes needed
3. ✅ Full audit trail
4. ✅ User-friendly admin interface

**Admin URL:** https://your-domain.com/admin-users.html

---

## 📚 Additional Resources

- **Full Guide:** `APPROVED_USERS_GUIDE.md`
- **SQL Schema:** `sql/create_approved_users_table.sql`
- **Auth Handler:** `assets/js/auth-ui-db.js`
- **Admin Interface:** `admin-users.html`

---

**Need help?** Check the troubleshooting section above or review the implementation files.
