# Approved Users Whitelist Guide

This guide explains how to allow specific non-SQU users to access the NexCore platform.

---

## Overview

By default, NexCore allows:
- ✅ `@squ.edu.om` (SQU staff/faculty)
- ✅ `@student.squ.edu.om` (SQU students)

You can add approved non-SQU users using two methods:

---

## Option 1: Code-Based Whitelist ⚡ (Already Implemented!)

**Best for:** Small number of users, quick setup

### How to Add Users

Edit these 3 files and add email addresses to the `APPROVED_EMAILS` array:

#### 1. `assets/js/auth-ui.js`
```javascript
const APPROVED_EMAILS = [
    'johndoe@example.com',
    'partner@company.com',
    'collaborator@gmail.com',
];
```

#### 2. `auth.html` (around line 250)
```javascript
const APPROVED_EMAILS = [
    'johndoe@example.com',
    'partner@company.com',
    'collaborator@gmail.com',
];
```

#### 3. `ai-chat.html` (around line 840)
```javascript
const APPROVED_EMAILS = [
    'johndoe@example.com',
    'partner@company.com',
];
```

### Example
```javascript
const APPROVED_EMAILS = [
    // External collaborators
    'researcher@stanford.edu',
    'partner@microsoft.com',

    // Industry partners
    'engineer@omantel.om',
    'contact@pdooman.com',

    // Individual approvals
    'john.smith@gmail.com',
];
```

### Pros & Cons
✅ **Pros:**
- Simple and fast
- No database changes needed
- Already implemented!

❌ **Cons:**
- Requires code deployment to add/remove users
- Must update 3 files manually
- Not ideal for many users

---

## Option 2: Database-Driven Whitelist 🗄️

**Best for:** Many users, dynamic management, admin dashboard

### Setup Instructions

#### Step 1: Create Database Table

Run this SQL in your Supabase SQL Editor:
```bash
# File location: sql/create_approved_users_table.sql
```

Or copy this SQL:
```sql
CREATE TABLE approved_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    approved_by TEXT,
    reason TEXT,
    approved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_approved_users_email ON approved_users(email);
ALTER TABLE approved_users ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read (needed for auth checks)
CREATE POLICY "Anyone can read approved users"
    ON approved_users FOR SELECT USING (true);
```

#### Step 2: Switch to Database-Driven Auth

Replace `auth-ui.js` with `auth-ui-db.js` in your HTML files:

**Before:**
```html
<script src="assets/js/auth-ui.js"></script>
```

**After:**
```html
<script src="assets/js/auth-ui-db.js"></script>
```

#### Step 3: Add Approved Users

##### Method A: Direct SQL
```sql
INSERT INTO approved_users (email, approved_by, reason) VALUES
('johndoe@example.com', 'admin@squ.edu.om', 'External researcher'),
('partner@company.com', 'admin@squ.edu.om', 'Industry partner');
```

##### Method B: JavaScript Console (in browser)
```javascript
// Add a user
await addApprovedUser(
    'johndoe@example.com',
    'admin@squ.edu.om',
    'External collaborator'
);

// Remove a user
await removeApprovedUser('johndoe@example.com');
```

##### Method C: Via Admin Dashboard (create this UI)
```javascript
// In your dashboard.html, add a form that calls:
document.getElementById('approveUserBtn').addEventListener('click', async () => {
    const email = document.getElementById('emailInput').value;
    const reason = document.getElementById('reasonInput').value;

    const result = await window.addApprovedUser(
        email,
        currentUser.email, // who approved it
        reason
    );

    if (result.success) {
        alert('User approved!');
    } else {
        alert('Error: ' + result.error);
    }
});
```

### Pros & Cons
✅ **Pros:**
- Add/remove users without code changes
- Scalable for many users
- Audit trail (who approved, when, why)
- Can build admin UI

❌ **Cons:**
- Requires database setup
- Slightly more complex
- Need to update HTML files to use new JS

---

## Current Implementation

✅ **Option 1 (Code-Based) is ALREADY ACTIVE!**

You can add approved users right now by editing:
1. `assets/js/auth-ui.js`
2. `auth.html`
3. `ai-chat.html`

---

## Quick Start: Add Your First Approved User

### Step 1: Edit `assets/js/auth-ui.js`

Find line ~13 and add the email:
```javascript
const APPROVED_EMAILS = [
    'yourpartner@example.com',  // ← Add here
];
```

### Step 2: Edit `auth.html`

Find line ~250 and add the same email:
```javascript
const APPROVED_EMAILS = [
    'yourpartner@example.com',  // ← Add here
];
```

### Step 3: Edit `ai-chat.html`

Find line ~840 and add the same email:
```javascript
const APPROVED_EMAILS = [
    'yourpartner@example.com',  // ← Add here
];
```

### Step 4: Deploy

Commit and push your changes. The user can now sign in!

---

## Testing

1. **Try signing in** with an approved email
2. **Check the browser console** for any errors
3. **Verify in Supabase** that the user profile was created

---

## Security Notes

⚠️ **Important:**
- Emails are case-insensitive (converted to lowercase)
- Exact match only (no wildcards)
- Always use lowercase when adding emails
- Keep the whitelist private (don't commit sensitive emails to public repos)

---

## Migration Path

**Start with Option 1** (already done!) → Later migrate to Option 2 when you have many users:

1. Export current `APPROVED_EMAILS` arrays
2. Set up database (Step 1 of Option 2)
3. Import emails to database
4. Switch JS files
5. Remove old `APPROVED_EMAILS` arrays

---

## FAQ

**Q: Can I use both options together?**
A: Yes! The database version will check both the whitelist AND the database.

**Q: What happens if I remove a user?**
A: They'll be signed out on next page load and can't sign back in.

**Q: Can approved users access everything?**
A: Yes, they have the same permissions as SQU users. Use Supabase RLS for fine-grained control.

**Q: How do I bulk import users?**
A: Use the SQL INSERT with multiple rows or create a CSV import script.

---

## Next Steps

- [ ] Add your first approved user
- [ ] Test authentication with non-SQU email
- [ ] (Optional) Create admin dashboard for managing approved users
- [ ] (Optional) Migrate to database-driven approach

---

**Questions?** Check the implementation in:
- `assets/js/auth-ui.js` (code-based, current)
- `assets/js/auth-ui-db.js` (database-driven, optional)
- `sql/create_approved_users_table.sql` (database setup)
