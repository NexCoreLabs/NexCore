# 🧾 Changelog

## v2.5.0 - 14 Mar 2026
### UI Overhaul:
- Added styling for project categories, filters, and explorer components.
- Implemented category chips for project filtering.
- Added comprehensive styling for project detail pages, including sections for stats, social links, QR codes, and creator profiles.


### New Components & Features:

- Implemented a custom-styled dropdown component for version selection, replacing the native select element.
- Introduced a new granular cookie consent manager and authentication UI components.
- Added a dedicated releases page to track project history.
- Added Apple Touch Icon and social media meta tags for better platform integration.


### Core & Performance:

- Introduced core JavaScript functionalities and styling for the NexCore website.
- Minified CSS and JS main files to improve loading performance.
- Improved link security by adding rel="noopener" to external links.


### Refactoring & Fixes:

- Removed BOM (Byte Order Mark) characters and fixed string interpolation issues.
- Updated icons (e.g., switched fa-sparkles to fa-wand-magic-sparkles) across the releases page.
- General code formatting and layout improvements for consistency.

---

## v2.4.1 - 7 Mar 2026
- Fixing known problems.
- Update service worker.

---

## v2.4.0 - 7 Mar 2026
### Account Management
- Added **Contact Information section** in account page with email & phone number fields
- Contact info is public (shown on project pages) while Google sign-in email remains private
- Implemented contact info validation (email pattern & phone format checks)
- Added load/save functionality for contact details in Supabase
- Updated data export to include contact email and phone number


### Project Categories

- Introduced **16 project categories** with color-coded badges:
  - Technology, Business, Education, Finance, Healthcare, Environment, Agriculture, Food, Travel, Transportation, Real Estate, Media & Entertainment, Art & Design, Sports & Fitness, Community, Lifestyle
- Created new `project-categories.js` module with category management & normalization
- Added category field to project creation form (dashboard & hub)
- Implemented category filtering in project hub with statistics display
- Generated SVG icons for each category type


### UI/UX Improvements

- Enhanced tooltip styling (added backdrop-filter & box-shadow)
- Refactored custom dropdowns to support multiple select types with icon support
- Improved input field styling (color consistency for text & borders)
- Cleaned up footer by removing privacy policy links from several pages
- Updated team member roles and titles (index.html)
- Increased task count from 120+ to 360+ on homepage


### Developer Files

- Added `.gitignore` entry for `sql` directory
- Started changelog for next version (v marked in CHANGELOG.md)
- Converted cookie icons from emoji to SVG for better rendering


### Code Refactoring

- Extracted dropdown functionality into reusable `initPortalSelect()` function
- Removed unnecessary CSS (deleted `cookie-consent.css`)
- Optimized hub.js project loading logic with filter/search integration
- Updated version.js from `v2.0.0` to `v2.4.0`

---

## v2.3.0 - 7 Mar 2026
### Account & User Profile Management
Added user display name field to account settings page (showing full name, username, or email prefix)
Implemented user metadata extraction supporting multiple name formats (full_name, name, user_name, preferred_username)
Added user profile syncing to database on login with avatar URL support
Created helper functions getUserDisplayName() and getUserAvatar() across multiple pages


### AI Features Expansion

New AI Action: Added project_insights action to the AI API endpoint
Generates project summaries with insights array based on project description
Implemented AI insights section on project pages with on-demand generation
Added "Generate insights" button with loading state and error handling
Added AI usage tracking feedback to users (remaining actions per day)


### Project Display Enhancements

Redesigned project cards with new structure using .project-card-link wrapper
Added project metadata section showing creation date and view count
Implemented view count tracking from page_visits_daily table
Changed project listing order from ascending to descending (newest first)
Added external link icon with hover animation on project titles
Improved responsive design for project cards on mobile devices


### Creator/Author Profile Display

Added creator section showing project creator information
Implemented avatar display with fallback to initials placeholder
Added contact creator functionality with email mailto links
Auto-backfill creator identity for legacy projects missing creator metadata
Stores creator name and avatar URL in project records


### Project Page Features

Added creation date badge to project stats
Implemented QR code download functionality
Added social sharing buttons (X/Twitter, LinkedIn, WhatsApp) setup
Improved QR code section layout with wrapper styling


### Navigation & Auth UI

Enhanced navbar user display with avatar image support
Switched from showing email to display name in navigation
Added user avatar to dropdown menu with icon fallback


### Database Improvements

Deleted legacy supabase_ai_migration.sql file (no longer needed)
Added support for creator_name and creator_avatar_url project fields
Project queries now support slug-based filtering in dashboard


### Code Quality

Fixed dashboard slug-based project loading from URL parameters
Improved HTML closing tag formatting in multiple files
Enhanced CSS minification with new responsive media queries

---

## v2.2.0 - 6 Mar 2026
### Cookie Consent Manager upgraded to v2 across the site

Replaced old assets/css/cookie-consent.css + assets/js/cookie-consent.js with new assets/css/cookies.css + assets/js/cookies.js in multiple pages (e.g., index.html, auth.html, dashboard.html, faq.html, hub.html, privacy-policy.html, terms.html, etc.).
Removed the old inline cookie banner HTML from pages like index.html, hub.html, faq.html, how-to-use.html, privacy-policy.html.


### New cookie consent implementation

Added assets/css/cookies.css (new file): full UI styling for the new consent modal + floating “Cookie Settings” button.
Added assets/js/cookies.js (new file): granular consent prefs, migration from old key, GA load/clear behavior, focus trap + a11y, floating settings button.


### Account page destructive actions UI/UX & accessibility improvements (account.html)

Reworked “Delete account” modal behavior to be accessible and animated (ARIA attributes, focus/escape/outside click handling, open class instead of display:none).
Added a new “Delete Project” confirmation modal (instead of browser confirm() dialogs).
Improved modal visuals (layout, buttons order, mobile responsiveness, better “DELETE” confirmation styling).


### Dashboard improvements (dashboard.html)

Added moderation status UI (badge + popup with reason).
Added publish flow moderation checks (publish/edit now triggers moderation logic rather than just flipping a published flag).
Added delete-project confirmation modal (custom modal instead of native confirm).


### Improved AI UI/UX:

New “AI magic” button states (loading shimmer + sparkles).
Split remaining-quota UI into card/page elements and added shared helpers.
Added a custom “AI style” dropdown UI (portalled panel to body to avoid z-index issues).


### New moderation API endpoint

Added api/moderate-project.js (new file): rule-based + Gemini-based moderation, updates project moderation fields, optional logging to moderation_logs, controls publish state depending on moderation decision.


### AI API improvement (api/ai.js)

Added support for GET /api/ai?usage=1 to fetch AI usage stats via Supabase RPC (get_ai_usage).
Kept generation as POST-only (now POST-only is enforced after the GET usage path).


### Footer branding update

Updated the PayPal support link in footers to include the PayPal icon/logo (seen across many pages).


### Small content/UI tweaks

Removed “BETA” badges from some headers (e.g., account.html, dashboard.html, hub.html Projects heading).
hub.html: changed projects ordering from newest-first to oldest-first (created_at ascending).

---

## v2.1.0 - 1 Mar 2026
### 1. New “AI Assist” feature (major user-facing addition)

- Added AI-assisted writing inside dashboard.html:
- Enhance Content with AI for the full Page Description with style modes:
- Professional / Shorter / Technical / Inspiring
- AI Card Brief generator to create a concise card_description derived from the page description
- Includes UX actions: Generate, Replace, Copy, status messages, and remaining-uses counter UI.
- Added a new serverless endpoint /api/ai.js (Vercel function):
- Uses Google Gemini via @google/genai
- Requires Bearer token auth (Supabase JWT validation server-side)
- Enforces daily rate limiting (3 actions/day/user) via Supabase RPC (consume_ai_use)
- Has defensive error handling and returns JSON consistently.
- Added a helper endpoint /api/models.js:
- Lists available Gemini models (intended as a temporary “model discovery” debugging endpoint).


### 2. Supabase DB changes for AI usage limits (new migration)

- New SQL migration: supabase_ai_migration.sql
- Creates ai_usage table
- Adds RPC function consume_ai_use(max_uses) to atomically enforce daily limit
- Adds optional helper get_ai_usage(max_uses)
- Enables RLS + policies to ensure each user only accesses their own usage rows
- Adds optional cleanup function for old records.


### 3. Project data model / naming updates across pages (functional change)

- Introduced/standardized separate fields:
- card_description (for hub cards)
- page_description (for the full project page)
- Updated hub.html:
- Fetch now selects card_description instead of description
- Card rendering uses card_description
- Search filter logic appears commented out (behavior change: search may no longer filter cards).
- Updated project.html:
- “About” section now displays page_description
- Meta tags use card_description (important for social previews)
- Owner-check query tightened by adding .eq('owner_user_id', session.user.id) (security improvement).


### 4. Dashboard & Account improvements (UI/UX + correctness)

- Switched multiple pages from minified CSS to assets/css/unminified-css.css for styling consistency/debuggability:
- dashboard.html, account.html, index.html, project.html
- Dashboard UX improvements:
- Adds slug label/preview changes (now indicates slug is tied to [username])
- Adds “Copy Page Link” button
- Adds extra icon fonts (Flaticon sets)
- Account page safety/correctness:
- Project queries now explicitly filter by owner_user_id = session.user.id in multiple places (prevents accidental cross-user operations even if RLS is misconfigured).


### 5. Styling updates (visual polish)

- assets/css/unminified-css.css:
- New button styles: .btn.danger, .btn.logout, .btn.copy (+ copied state)
- Textarea color behavior changed (default vs hover/focus) which will affect perceived readability.


### 6. Marketing/home page additions

- index.html “Core Tools & Systems” adds new tool cards/images:
- Google Gemini, Google AI Studio, Google Cloud Console
- Social link update: StackOverflow link replaced with LinkedIn.


### 7. Dependencies & package metadata

- package.json adds dependency: @google/genai
- package-lock.json updated heavily (new dependency tree)
- Notable: package-lock shows version set to 2.0.0-beta in places—worth double-checking your release/versioning consistency.

---

## v2.0.0 — 10 Feb 2026
**Note:** This is a major release graduating from v2.0.0-beta with additional UI polish.
###  New Features (from beta)
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

---

## v2.0.0-beta - 7 Feb 2026
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

---

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

---

## v1.1.1 — 02 Nov 2025
- Fixing broken pictures path in service-worker.js
- Deleted mobile-preview.html

---

## v1.1.0 — 01 Nov 2025
- Enabled image compression (WebP)
- Adding research.html
- More UI improvement
- Begin with Git VCS

---

## v1.0.0 — 27 Oct 2025 (Initial Release)
- NexCore Labs website launched
