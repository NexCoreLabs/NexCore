# 🧾 Changelog

## v2.0.0-beta — 07 Feb 2026

### 🎉 Major Release - Complete Platform Overhaul

**This is a BETA RELEASE introducing authentication, database integration, and dynamic project management.**

#### 🚀 Major Features

**🔐 Authentication System**
- Supabase-based authentication with Google OAuth
- Email restrictions - Only @squ.edu.om and @student.squ.edu.om addresses
- New Sign-in page (`auth.html`)
- User Dashboard (`dashboard.html`) for project management
- Account Settings (`account.html`) for profile management

**🗄️ Database Integration**
- Supabase backend replacing static JSON files
- Dynamic project loading from database
- Real-time project data across the hub
- User-specific project management

**📊 Project Management**
- Create and edit projects with rich metadata
- Publish/Unpublish toggle for project visibility
- QR code generation for easy project sharing
- Project slugs for clean URLs (`/project.html?slug=project-name`)
- Image uploads with preview
- Social media links (X/Twitter, GitHub, LinkedIn, Instagram, YouTube, Website)
- Tags and categories for better organization

**📈 Analytics**
- Page visit tracking via serverless function (`api/track-visit.js`)
- Daily analytics stored in Supabase
- Foundation for future analytics dashboard

#### 🔄 Breaking Changes

⚠️ **Major version with breaking changes:**
1. Removed `signup.html` - Replaced with new `auth.html` authentication flow
2. Removed `data/projects.json` - Projects now stored in Supabase database
3. Disabled `pricing.html` - Platform is free during beta (file renamed to `pricing.html.disabled`)
4. Navigation links updated - "Access the Core" now points to authentication page

#### ✨ Improvements

**UI/UX Updates**
- Enhanced authentication UI with tabbed interface
- Google Sign-in button with official branding
- Dynamic navigation showing Dashboard/Account when logged in
- BETA badges across new features
- Improved featured plan styling with subtle backgrounds
- Fixed FAQ heading alignment

**Technical Infrastructure**
- Added `package.json` with `@supabase/supabase-js` dependency
- New `lib/supabaseAdmin.js` for server-side operations
- Vercel serverless functions for analytics
- Added `.gitignore` for `node_modules` and `.env.local`
- Repository structure documentation

**Hub Improvements**
- Projects load dynamically from Supabase
- Real-time project updates
- Better project discovery

#### 📦 New Files
- `auth.html`, `dashboard.html`, `account.html`, `project.html`
- `assets/js/auth-ui.js`, `assets/js/supabase-client.js`
- `api/track-visit.js`, `lib/supabaseAdmin.js`
- `package.json`, `package-lock.json`

#### 🗑️ Removed Files
- `signup.html` (replaced by `auth.html`)
- `data/projects.json` (migrated to Supabase)

#### 🔧 Configuration Requirements
- Supabase project with appropriate tables
- Environment variables configured (`.env.local`)
- Vercel deployment for serverless functions

#### 🐛 Known Issues (Beta)
- This is a beta release - expect ongoing improvements
- Analytics dashboard UI not yet implemented
- Some features may be refined based on user feedback

## v1.3.0 — 07 Feb 2026
- Added Trustpilot review widget integration with styling and responsive design
- Updated contact information: replaced YouTube with WhatsApp contact link
- Standardized SEO meta tags, descriptions, and Open Graph/Twitter metadata across all pages
- Fixed PWA manifest start_url from `/NexCore/` to `/` for proper deployment
- Updated sitemap URLs from github.io to nexcorelabs.vercel.app domain
- Added Privacy Policy link to hub navigation menu
- Removed WELCOME.md documentation file
- Improved branding consistency with 'NexCore Labs' labels site-wide

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