# NexCore Labs 🌐

> **Bringing projects to life online — making every idea count.**

NexCore Labs is a creative web development and innovation initiative founded in 2025 at Sultan Qaboos University.  
We provide professional digital solutions and showcase platforms for student-led projects, empowering teams to highlight their core ideas and contributions effectively.

---

## 🚀 Mission

To bring projects to life online, transforming every idea into an impactful digital experience.

## 🌍 Vision

To become the go-to hub for showcasing innovation, connecting creators and audiences worldwide.

---

## 💡 Features

### Core Platform
- 🧠 **Project Showcases** – Interactive project cards with categories, creator profiles, stats, and social sharing.
- 🔎 **Search & Filter** – Find projects by name, ID, or one of 16 color-coded categories.
- 👤 **User Accounts** – Display names, avatars, contact information, and full data export/delete support.
- 📦 **Progressive Web App (PWA)** – Installable with offline caching via Service Worker.
- 🖼️ **Optimised Media** – Lazy-loaded and WebP-ready images for better performance.

### AI Assistant
- 🤖 **RAG-Powered Chat** – Context-aware AI chat (Google Gemini 2.5) backed by a project knowledge base.
- ✍️ **AI Writing Assist** – Enhance project descriptions with Professional, Shorter, Technical, or Inspiring styles.
- 💡 **Project Insights** – On-demand AI-generated summaries and insight arrays per project.
- 📊 **Usage Tracking** – Daily limits (3 actions/day) with visible usage pills and quota feedback.

### Admin & Security
- 🛡️ **Admin Panel** – Dedicated interface (`/admin-users`) for managing users and platform settings.
- ✅ **User Whitelisting** – Database-driven Approved Users system to gate access to specific features.
- 📋 **Audit Logging** – `admin_activity_log` table tracking all administrative actions.
- 🔍 **Project Moderation** – Rule-based + Gemini-powered moderation pipeline controlling publish state.

### Subscriptions & Payments
- 💳 **PayPal Integration** – Capture and manage PayPal subscription payments via serverless API.
- 🏦 **Bank Transfer** – Support for bank transfer subscription orders.
- 📧 **Email Notifications** – Transactional emails via Nodemailer for order confirmations and receipts.

### Embedding & Sharing
- 🔗 **Embed System** – Generate embeddable code snippets to display NexCore projects on external sites.
- 📣 **Social Sharing** – One-click sharing to X/Twitter, LinkedIn, and WhatsApp from project pages.

### Internationalisation
- 🌐 **Arabic / RTL Support** – Full right-to-left layout with Tajawal font and a dedicated `arabic.css`.
- 🗣️ **AI Chat Localisation** – Multilingual AI responses with improved Arabic accuracy.

### Roadmap & Community
- 🗺️ **Roadmap & Feature Requests** – Public roadmap page with anonymous suggestion submission and guest voting.
- 🍪 **Cookie Consent v2** – Granular consent manager with GA load/clear behaviour and accessibility support.

---

## 🧰 Technologies Used

| Layer | Tools |
|---|---|
| **Frontend** | HTML5, CSS3, JavaScript (ES6) |
| **Backend / DB** | Supabase (Auth, Database, RPC, Embeddings) |
| **AI** | Google Gemini 2.5 via `@google/genai`, RAG knowledge base |
| **Serverless API** | Vercel Functions (Node.js) |
| **Payments** | PayPal REST API, Bank Transfer |
| **Email** | Nodemailer |
| **PWA** | Service Worker, Web App Manifest |
| **Analytics** | Google Analytics, Vercel Speed Insights, Google Search Console |
| **Icons & Assets** | Font Awesome, Flaticon, Inkscape |
| **Dev & Hosting** | VS Code, Vercel, GitHub |

---

## 📁 Project Structure

```
NexCore/
├── index.html               # Landing page
├── hub.html                 # Project discovery hub
├── project.html             # Individual project page
├── dashboard.html           # Creator dashboard
├── account.html             # User account & settings
├── ai-chat.html             # Full-page AI chat interface
├── embed.html               # Embed code generator
├── admin-users.html         # Admin panel
├── roadmap.html             # Roadmap & feature requests
├── auth.html                # Authentication page
├── pricing.html             # Pricing / subscription plans
├── releases.html            # Version release history
├── faq.html / how-to-use.html
├── privacy-policy.html / terms.html
├── api/                     # Vercel serverless functions
│   ├── ai.js                # AI assistant + RAG endpoint
│   ├── moderate-project.js  # Project moderation
│   ├── submit-subscription.js
│   ├── paypal-capture.js
│   ├── bank-transfer.js
│   └── ...
├── assets/
│   ├── css/                 # Stylesheets (global, AI chat, Arabic, cookies...)
│   ├── js/                  # Client-side scripts
│   └── data/releases.json   # Release history data
├── lib/supabaseAdmin.js      # Supabase admin client
├── scripts/seed-knowledge.js # AI knowledge base seeder
├── sql/                     # Database schemas & RLS policies
├── service-worker.js        # PWA caching
└── manifest.json            # PWA manifest
```

---

## 🔒 Progressive Web App (PWA)

NexCore Labs supports offline mode and caching using a custom **Service Worker**.  
Install the app on your desktop or phone for quick access and seamless performance.

---

## 📸 Preview

Visit the live version here:  
👉 [**NexCore Labs**](https://nexcorelabs.vercel.app/)

---

## 📋 Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full version history.  
Current version: **v2.9.0**

---

## 🧭 Author

**NexCore Labs Team**  
_2025 Cohort — Sultan Qaboos University_  

---

> _Progress makes **improvement**, not perfection._
