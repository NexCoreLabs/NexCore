# 🧾 Changelog

## v2.0.0 — 10 Feb 2026
**Note:** This is a major release graduating from v2.0.0-beta with additional UI polish.
### ✨ New Features (from beta)
- Complete Supabase integration for auth and database
- Account settings page with profile management
- Project management system (hub, dashboard, project pages)
- Dynamic navigation system
- Backend visit tracking
- Trustpilot review integration
- Added unified header/navbar across all pages
- Added site footer with support and license links
- Applied backdrop-filter blur effects to cards
- Updated auth UI messaging
- Removed standalone signup.html and login.html (use auth.html)
- New authentication flow using Supabase
- Requires Supabase configuration for backend functionality
- Refactored dashboard to Supabase project editor
- Added admin utilities for Supabase
- Improved auth client architecture


## v2.0.0-beta - 8 Feb 2026
### 1. Complete Authentication System (Supabase-based)

- New auth.html - Sign-in page with Google OAuth
- New dashboard.html - User dashboard for managing projects
- New account.html - Account settings and management
- New project.html - Individual project display page
- Authentication UI components (assets/js/auth-ui.js, assets/js/supabase-client.js)


### 2. Database Integration

- Integrated Supabase for backend data storage
- Projects now stored in database instead of data/projects.json
- Dynamic project loading from Supabase in hub
- User authentication with SQU email (@squ.edu.om, @student.squ.edu.om)


### 3. Analytics & Tracking

- New serverless function api/track-visit.js for page visit tracking
- Daily page visit analytics stored in Supabase


### 4. Project Management

- Users can create, edit, publish/unpublish their projects
- Project slug-based URLs (/project.html?slug=project-name)
- QR code generation for projects
- Project image support with preview
- Social media links (X/Twitter, GitHub, LinkedIn, etc.)


### 🗑️ Major Removals

- Removed signup.html - Replaced with new authentication system
- Removed data/projects.json - Moved to Supabase database
- Disabled pricing.html - Moved to pricing.html.disabled (currently free during beta)


### 🔄 Major Updates

_Navigation Changes_
- "Access the Core" now links to auth.html instead of signup.html
- Dynamic nav menu showing Dashboard/Account Settings when logged in
- Pricing link commented out (service is free during beta)

_Hub Improvements_
- Projects now load dynamically from Supabase
- Added "BETA" badge to projects section
- Real-time project data instead of static JSON

_Styling Updates_
- New authentication UI styles (tabs, Google sign-in button)
- Updated featured plan styling (gradient → subtle background)
- Fixed FAQ heading alignment
- Minor CSS refinements across pages


### 🔧 Technical Infrastructure

_Dependencies_

- Added @supabase/supabase-js package
- Added package.json and package-lock.json
- Added .gitignore for node_modules and .env.local

_Backend Functions_

- New lib/supabaseAdmin.js for server-side Supabase operations
- Vercel serverless function for analytics

_Documentation_

- Added repository structure document
- Updated README with new Vercel deployment URL


## v1.2.0 — 03 Feb 2026
- Rewrote Service Worker for robust precaching, runtime caching, navigation preload and offline fallback (`offline.html`)
- Added offline support and an `offline.html` fallback page
- Introduced cookie consent (styles & script) and updated related pages for consent handling
- Replaced the leader image with `ceopic.webp` and fixed image paths
- Refactored and cleaned up CSS (unminified CSS available), reduced backdrop blur and improved UI polish
- Updated meta tags site-wide and hardened the signup form
- Refactored pricing and terms styles; revised pricing UI and signup plan options
- Added Oman badge and Vercel asset; small UI tweaks across pages
- Reorganized menu order and navigation for better UX
- Added full documentation suite (implementation notes, quick reference, delivery summary, completion checklist and welcome docs)
- Misc: stylesheet, script, and content updates across `faq.html`, `how-to-use.html`, `hub.html`, `index.html`, `pricing.html`, `terms.html`, `signup.html`, `thanks.html`


## v1.1.1 — 02 Nov 2025
- Fixing broken pictures path in service-worker.js
- Deleted mobile-preview.html


## v1.1.0 — 01 Nov 2025
- Enabled image compression (WebP)
- Adding research.html
- More UI improvement
- Begin with Git VCS


## v1.0.0 — 27 Oct 2025 (Initial Release)
- NexCore Labs website launched