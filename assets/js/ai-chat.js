/**
 * NexCore AI Chat Widget — frontend logic
 *
 * Self-contained IIFE — no global pollution.
 *
 * Features:
 *  - Floating trigger button with pulse ring
 *  - Slide-up chat panel
 *  - User + AI message bubbles with timestamps
 *  - "AI is typing…" indicator
 *  - Quick-suggestion buttons (hidden after first use)
 *  - Source attribution tags
 *  - Daily usage counter in header
 *  - Context-aware mode: reads window.nexcoreProjectContext on project pages
 *  - Copy last AI reply button
 *  - Graceful error handling + rate limit messaging
 *  - Auto-scroll to latest message
 *  - Enter to send, Shift+Enter for new line
 */

(function () {
  'use strict';

  // ── Config ──────────────────────────────────────────────────────────────
  const API_ENDPOINT = '/api/ai-chat';
  const MAX_MSG_LEN  = 500;

  // Quick suggestion buttons shown on first open
  const SUGGESTIONS = [
    'What is NexCore?',
    'How do I submit a project?',
    'Tell me about SQU colleges',
    'What is the AI Assist feature?',
    'SQU admission requirements'
  ];

  // ── State ───────────────────────────────────────────────────────────────
  let isOpen         = false;
  let isLoading      = false;
  let sessionToken   = null;   // cached JWT
  let chatUsed       = 0;
  let chatRemaining  = 10;
  let chatMax        = 10;
  let suggestionsUsed = false;
  let messageCount   = 0;

  // ── Inject HTML ─────────────────────────────────────────────────────────
  function buildWidget() {
    const trigger = document.createElement('button');
    trigger.id = 'nexai-trigger';
    trigger.setAttribute('aria-label', 'Open NexCore AI Assistant');
    trigger.setAttribute('title', 'NexCore AI Assistant');
    trigger.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
        <path d="M8 10h8M8 14h5"/>
        <circle cx="12" cy="12" r="10"/>
        <path d="M9.5 9.5c.5-1 1.5-1.5 2.5-1.5s2 .5 2.5 1.5"/>
        <line x1="12" y1="16" x2="12" y2="16.5"/>
      </svg>
      <span id="nexai-badge" aria-hidden="true"></span>`;

    // Better icon — speech bubble with sparkle
    trigger.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#6ee7f3" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        <line x1="8" y1="10" x2="16" y2="10"/>
        <line x1="8" y1="14" x2="13" y2="14"/>
      </svg>
      <span id="nexai-badge" aria-hidden="true"></span>`;

    const panel = document.createElement('div');
    panel.id = 'nexai-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'NexCore AI Assistant');
    panel.innerHTML = `
      <div id="nexai-header">
        <div class="nexai-avatar" aria-hidden="true">✦</div>
        <div class="nexai-title">
          <h3>NexCore AI</h3>
          <span id="nexai-status">Ready to help</span>
        </div>
        <span id="nexai-usage-pill" class="nexai-usage-pill" title="Messages left today"></span>
        <button id="nexai-close" aria-label="Close AI chat" title="Close">✕</button>
      </div>

      <div id="nexai-messages" role="log" aria-live="polite" aria-label="Chat messages">
        <div class="nexai-welcome">
          <span class="nexai-welcome-icon" aria-hidden="true">✦</span>
          Hi! I'm the NexCore AI assistant.<br>
          Ask me anything about the platform, SQU, or projects.
        </div>
      </div>

      <div id="nexai-suggestions" aria-label="Quick suggestions"></div>

      <div id="nexai-input-area">
        <textarea
          id="nexai-input"
          rows="1"
          placeholder="Ask NexCore AI…"
          maxlength="${MAX_MSG_LEN}"
          aria-label="Message input"
          autocomplete="off"
          spellcheck="true"
        ></textarea>
        <button id="nexai-send" aria-label="Send message" title="Send (Enter)">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>`;

    document.body.appendChild(trigger);
    document.body.appendChild(panel);
  }

  // ── DOM references (populated after build) ──────────────────────────────
  let elTrigger, elPanel, elMessages, elInput, elSend,
      elStatus, elUsagePill, elSuggestions, elBadge;

  function cacheRefs() {
    elTrigger    = document.getElementById('nexai-trigger');
    elPanel      = document.getElementById('nexai-panel');
    elMessages   = document.getElementById('nexai-messages');
    elInput      = document.getElementById('nexai-input');
    elSend       = document.getElementById('nexai-send');
    elStatus     = document.getElementById('nexai-status');
    elUsagePill  = document.getElementById('nexai-usage-pill');
    elSuggestions = document.getElementById('nexai-suggestions');
    elBadge      = document.getElementById('nexai-badge');
  }

  // ── Auth token helper ───────────────────────────────────────────────────
  async function getToken() {
    if (sessionToken) return sessionToken;
    const sb = window.supabaseClient;
    if (!sb) return null;
    try {
      const { data } = await sb.auth.getSession();
      sessionToken = data?.session?.access_token || null;
      return sessionToken;
    } catch (_) {
      return null;
    }
  }

  // ── Usage display ───────────────────────────────────────────────────────
  function updateUsagePill() {
    if (!elUsagePill) return;
    elUsagePill.textContent = `${chatRemaining} left`;
    elUsagePill.className = 'nexai-usage-pill' + (chatRemaining === 0 ? ' depleted' : '');
    elUsagePill.title = `${chatUsed} of ${chatMax} messages used today`;
  }

  async function fetchUsage() {
    const token = await getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_ENDPOINT}?usage=1`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      chatUsed      = data.used      ?? chatUsed;
      chatRemaining = data.remaining ?? chatRemaining;
      chatMax       = data.max       ?? chatMax;
      updateUsagePill();
    } catch (_) {}
  }

  // ── Message rendering ───────────────────────────────────────────────────
  function formatTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * Append a message bubble to the chat.
   * @param {'user'|'ai'} role
   * @param {string} text
   * @param {Array}  sources  — optional source array from API
   * @param {boolean} isError
   * @returns {HTMLElement} the bubble element (so caller can update it)
   */
  function appendMessage(role, text, sources, isError) {
    // Remove welcome message on first real message
    const welcome = elMessages.querySelector('.nexai-welcome');
    if (welcome) welcome.remove();

    const wrapper = document.createElement('div');
    wrapper.className = `nexai-msg ${role}`;

    const bubble = document.createElement('div');
    bubble.className = 'nexai-bubble';
    if (isError) bubble.classList.add('nexai-error-bubble');
    bubble.textContent = text;

    const time = document.createElement('span');
    time.className = 'nexai-msg-time';
    time.textContent = formatTime();

    wrapper.appendChild(bubble);
    wrapper.appendChild(time);

    // Source attribution for AI messages
    if (role === 'ai' && sources && sources.length > 0 && !isError) {
      const sourcesEl = document.createElement('div');
      sourcesEl.className = 'nexai-sources';
      const uniqueSources = [...new Set(sources.map(s => s.source))];
      uniqueSources.forEach(src => {
        const tag = document.createElement('span');
        tag.className = 'nexai-source-tag';
        tag.textContent = src;
        sourcesEl.appendChild(tag);
      });
      wrapper.appendChild(sourcesEl);
    }

    elMessages.appendChild(wrapper);
    scrollToBottom();
    messageCount++;

    return bubble;
  }

  function scrollToBottom() {
    elMessages.scrollTop = elMessages.scrollHeight;
  }

  // ── Typing indicator ────────────────────────────────────────────────────
  let typingEl = null;

  function showTyping() {
    if (typingEl) return;
    const el = document.createElement('div');
    el.className = 'nexai-msg ai';
    el.innerHTML = `
      <div class="nexai-typing">
        <div class="nexai-typing-dots">
          <span></span><span></span><span></span>
        </div>
        <span class="nexai-typing-label">NexCore AI is thinking…</span>
      </div>`;
    elMessages.appendChild(el);
    typingEl = el;
    scrollToBottom();
  }

  function hideTyping() {
    if (typingEl) {
      typingEl.remove();
      typingEl = null;
    }
  }

  // ── Quick suggestions ───────────────────────────────────────────────────
  function renderSuggestions() {
    if (!elSuggestions || suggestionsUsed) return;
    elSuggestions.innerHTML = '';
    SUGGESTIONS.forEach(text => {
      const btn = document.createElement('button');
      btn.className = 'nexai-suggestion';
      btn.textContent = text;
      btn.addEventListener('click', () => {
        hideSuggestions();
        elInput.value = text;
        sendMessage();
      });
      elSuggestions.appendChild(btn);
    });
  }

  function hideSuggestions() {
    if (elSuggestions) elSuggestions.innerHTML = '';
    suggestionsUsed = true;
  }

  // ── Auto-resize textarea ────────────────────────────────────────────────
  function autoResize() {
    elInput.style.height = 'auto';
    elInput.style.height = Math.min(elInput.scrollHeight, 90) + 'px';
  }

  // ── Send message ─────────────────────────────────────────────────────────
  async function sendMessage() {
    const text = (elInput.value || '').trim().replace(/\0/g, '').slice(0, MAX_MSG_LEN);
    if (!text || isLoading) return;

    // Check remaining
    if (chatRemaining <= 0) {
      appendMessage('ai', 'You\'ve reached your daily message limit. Come back tomorrow!', null, true);
      return;
    }

    // Require auth
    const token = await getToken();
    if (!token) {
      appendMessage('ai', 'Please sign in to use the AI assistant.', null, true);
      return;
    }

    // Clear input
    elInput.value = '';
    elInput.style.height = 'auto';
    hideSuggestions();

    appendMessage('user', text);
    setLoading(true);
    showTyping();

    // Build request body — attach project context if on project page
    const body = { message: text };
    if (window.nexcoreProjectContext) {
      body.projectContext = {
        title:       String(window.nexcoreProjectContext.title       || '').slice(0, 200),
        description: String(window.nexcoreProjectContext.description || '').slice(0, 800)
      };
    }

    try {
      const res = await fetch(API_ENDPOINT, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      hideTyping();

      if (!res.ok) {
        if (res.status === 429) {
          appendMessage('ai', data.message || 'Daily message limit reached. Try again tomorrow.', null, true);
        } else if (res.status === 401) {
          appendMessage('ai', 'Session expired — please sign in again.', null, true);
        } else if (res.status === 503) {
          appendMessage('ai', 'The AI is temporarily unavailable. Please try again in a moment.', null, true);
        } else {
          appendMessage('ai', 'Something went wrong. Please try again.', null, true);
        }
        return;
      }

      // Success
      chatUsed      = data.used      ?? chatUsed;
      chatRemaining = data.remaining ?? chatRemaining;
      chatMax       = data.max       ?? chatMax;
      updateUsagePill();

      appendMessage('ai', data.reply || 'Sorry, I couldn\'t generate a response.', data.sources);

    } catch (netErr) {
      console.error('[NexCore AI] Request failed:', netErr.message);
      hideTyping();
      appendMessage('ai', 'Network error — check your connection and try again.', null, true);
    } finally {
      setLoading(false);
    }
  }

  // ── UI state helpers ────────────────────────────────────────────────────
  function setLoading(loading) {
    isLoading = loading;
    elSend.disabled  = loading;
    elInput.disabled = loading;
    elStatus.textContent = loading ? 'Thinking…' : 'Ready to help';
  }

  // ── Panel toggle ────────────────────────────────────────────────────────
  function openPanel() {
    elPanel.classList.add('open');
    elTrigger.setAttribute('aria-expanded', 'true');
    isOpen = true;

    // Hide unread badge
    elBadge.classList.remove('visible');

    // Fetch usage on first open
    if (messageCount === 0) {
      fetchUsage();
      renderSuggestions();
    }

    // Focus input after transition
    setTimeout(() => elInput.focus(), 260);
  }

  function closePanel() {
    elPanel.classList.remove('open');
    elTrigger.setAttribute('aria-expanded', 'false');
    isOpen = false;
  }

  function togglePanel() {
    if (isOpen) closePanel(); else openPanel();
  }

  // ── Event listeners ─────────────────────────────────────────────────────
  function bindEvents() {
    elTrigger.addEventListener('click', togglePanel);
    document.getElementById('nexai-close').addEventListener('click', closePanel);

    // Close on outside click
    document.addEventListener('click', e => {
      if (isOpen && !elPanel.contains(e.target) && !elTrigger.contains(e.target)) {
        closePanel();
      }
    });

    // Send on Enter (Shift+Enter = new line)
    elInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    elInput.addEventListener('input', autoResize);
    elSend.addEventListener('click', sendMessage);

    // Close on Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && isOpen) closePanel();
    });

    // Re-fetch token if auth state changes
    if (window.supabaseClient) {
      window.supabaseClient.auth.onAuthStateChange(() => {
        sessionToken = null; // bust cached token
      });
    }
  }

  // ── Init ────────────────────────────────────────────────────────────────
  function init() {
    buildWidget();
    cacheRefs();
    updateUsagePill();
    bindEvents();
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
