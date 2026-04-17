# 🔐 Admin Access Setup Guide

## Quick Setup: Make Yourself an Admin

### Step 1: Edit the SQL File

Open `sql/create_approved_users_table.sql` and find line ~125:

**Replace this:**
```sql
INSERT INTO admins (email, added_by, notes) VALUES
('your-email@squ.edu.om', 'system', 'Initial admin')
```

**With YOUR actual email:**
```sql
INSERT INTO admins (email, added_by, notes) VALUES
('YOUR_ACTUAL_EMAIL@squ.edu.om', 'system', 'Initial admin')
```

Example:
```sql
INSERT INTO admins (email, added_by, notes) VALUES
('john.smith@squ.edu.om', 'system', 'Initial admin')
```

### Step 2: Run the SQL in Supabase

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Paste the entire SQL file
3. Click **Run**
4. Both tables will be created AND you'll be added as admin

### Step 3: Verify You're an Admin

Run this query in Supabase SQL Editor:
```sql
SELECT * FROM admins WHERE email = 'your-email@squ.edu.om';
```

You should see your email listed!

---

## Access the Admin Page

Now you can access: **`/admin-users.html`**

✅ You're an admin - you can access it!  
❌ Non-admins will be redirected to dashboard

---

## Add More Admins (After Initial Setup)

### Method 1: Via SQL
```sql
INSERT INTO admins (email, added_by, notes) VALUES
('another-admin@squ.edu.om', 'your-email@squ.edu.om', 'Co-administrator');
```

### Method 2: Via Browser Console (on any NexCore page)
```javascript
const { data, error } = await window.supabaseClient
    .from('admins')
    .insert([{
        email: 'another-admin@squ.edu.om',
        added_by: 'your-email@squ.edu.om',
        notes: 'Co-administrator'
    }]);

if (error) console.error(error);
else console.log('Admin added!', data);
```

### Method 3: Create Admin Management UI (Advanced)

You can add an "Manage Admins" section to `admin-users.html` later!

---

## Remove an Admin

### Via SQL:
```sql
DELETE FROM admins WHERE email = 'admin-to-remove@squ.edu.om';
```

### Via Console:
```javascript
await window.supabaseClient
    .from('admins')
    .delete()
    .eq('email', 'admin-to-remove@squ.edu.om');
```

---

## Security Features

### ✅ Row Level Security (RLS):
- Only admins can add/update/delete other admins
- Anyone can read (needed for access checks)
- First admin is added manually via SQL

### ✅ Access Control:
- `admin-users.html` checks admin status
- Non-admins are blocked and redirected
- Alert shown: "Access Denied: You must be an administrator"

### ✅ Bootstrap Protection:
The first admin MUST be added via SQL (the `INSERT` in the SQL file).  
This prevents anyone from making themselves admin without database access.

---

## What Changed

### Files Updated:
1. ✅ `sql/create_approved_users_table.sql` - Added `admins` table
2. ✅ `admin-users.html` - Added admin check

### New Features:
- Admin-only access to user management
- Secure bootstrap (first admin via SQL)
- Admins can add other admins
- Full audit trail (who added whom, when)

---

## Database Schema

```sql
admins
├── id (UUID)
├── email (TEXT, UNIQUE)    ← Admin's email
├── added_by (TEXT)          ← Who added them
├── added_at (TIMESTAMP)     ← When they were added
└── notes (TEXT)             ← Optional notes
```

---

## Checklist

Before deploying:

- [ ] Edit SQL file with YOUR email
- [ ] Run SQL in Supabase
- [ ] Verify admin table created
- [ ] Verify your email is in admins table
- [ ] Deploy updated admin-users.html
- [ ] Test: access `/admin-users.html`
- [ ] Test: non-admin should be blocked

---

## Example: Complete Setup

### 1. Edit SQL (line ~125):
```sql
INSERT INTO admins (email, added_by, notes) VALUES
('john.smith@squ.edu.om', 'system', 'Initial admin')
```

### 2. Run in Supabase SQL Editor

### 3. Verify:
```sql
SELECT * FROM admins;
```

Output:
```
id                                   | email                  | added_by | added_at           | notes
-------------------------------------|------------------------|----------|--------------------|--------------
abc123...                            | john.smith@squ.edu.om  | system   | 2026-04-18 ...    | Initial admin
```

### 4. Access Admin Page:
```
https://your-domain.com/admin-users.html
```

✅ **You're in!**

---

## Troubleshooting

### "Access Denied" Error
**Problem:** You're not in the admins table  
**Solution:** 
1. Check your email in Supabase admins table
2. Email must match exactly (case-insensitive)
3. Re-run the INSERT query with correct email

### Can't Add More Admins
**Problem:** RLS policy prevents it  
**Solution:** 
- You must be logged in
- Your email must be in admins table
- Use SQL for first admin, then UI/console for others

### Table Doesn't Exist
**Problem:** SQL wasn't run correctly  
**Solution:**
1. Go to Supabase → SQL Editor
2. Run entire SQL file
3. Check Table Editor for `admins` table

---

## Quick Commands

### List all admins:
```sql
SELECT email, added_by, added_at, notes FROM admins ORDER BY added_at;
```

### Check if specific email is admin:
```sql
SELECT EXISTS (
    SELECT 1 FROM admins WHERE email = 'user@squ.edu.om'
) AS is_admin;
```

### Count admins:
```sql
SELECT COUNT(*) FROM admins;
```

---

**Next Step:** Edit the SQL file with YOUR email and run it in Supabase! 🚀
