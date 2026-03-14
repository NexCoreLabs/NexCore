/**
 * NexCore Labs - Global Authentication UI
 * Manages sign-in/sign-out UI elements across all pages
 */

(function() {
    'use strict';

    const sb = window.supabaseClient;

    if (!sb) {
        console.error('Supabase client not found. Make sure supabase-client.js is loaded first.');
        return;
    }

    function getUserDisplayName(user) {
        const metadata = user?.user_metadata || {};
        const fullName = metadata.full_name || metadata.name || metadata.user_name || metadata.preferred_username;
        if (typeof fullName === 'string' && fullName.trim()) {
            return fullName.trim();
        }

        const email = typeof user?.email === 'string' ? user.email : '';
        if (email.includes('@')) return email.split('@')[0];
        return 'Member';
    }

    function getUserAvatar(user) {
        const metadata = user?.user_metadata || {};
        const avatar = metadata.avatar_url || metadata.picture || metadata.photo_url;
        if (typeof avatar === 'string' && /^https?:\/\//i.test(avatar.trim())) {
            return avatar.trim();
        }
        return '';
    }

    async function upsertUserProfile(user) {
        if (!user?.id) return;

        try {
            const payload = {
                id: user.id,
                email: user.email || null,
                name: getUserDisplayName(user),
                avatar_url: getUserAvatar(user) || null,
                updated_at: new Date().toISOString()
            };

            const { error } = await sb
                .from('users')
                .upsert(payload, { onConflict: 'id' });

            if (error) {
                console.warn('Profile upsert skipped:', error.message);
            }
        } catch (error) {
            console.warn('Profile upsert failed:', error?.message || error);
        }
    }

    // Create nav elements if they don't exist
    function ensureNavElements() {
        const dropdown = document.querySelector('.dropdown-content');
        if (!dropdown) return;

        // Check if elements already exist
        if (document.getElementById('navAuth') &&
            document.getElementById('navDashboard') &&
            document.getElementById('navAccount') &&
            document.getElementById('navUser') &&
            document.getElementById('navLogout')) {
            return;
        }

        // Find the first menu item to insert after
        const firstMenuItem = dropdown.querySelector('a.magic-signup');

        if (firstMenuItem) {
            // Create auth elements HTML
            const authHTML = `
                <a href="auth.html" id="navAuth" class="magic-signup fade" title="Sign In" style="display: none;">
                    <i class="fa-solid fa-arrow-right-to-bracket"></i> Access the core
                </a>
                <a href="dashboard.html" id="navDashboard" class="fade" title="Dashboard" style="display: none;">
                    <i class="fa-solid fa-gauge"></i> Dashboard
                </a>
                <a href="account.html" id="navAccount" class="fade" title="Account Settings" style="display: none;">
                    <i class="fa-solid fa-user-gear"></i> Account Settings
                </a>
                <div id="navUser" style="display: none; padding: 0.75rem 1rem; color: rgba(255,255,255,0.7); font-size: 0.9rem; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 0.5rem;">
                    <span style="display: inline-flex; align-items: center; gap: 0.5rem;">
                        <img id="navUserAvatar" src="" alt="" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; display: none; border: 1px solid rgba(255,255,255,0.25);">
                        <i id="navUserIcon" class="fa-solid fa-user" aria-hidden="true"></i>
                        <span id="navUserName"></span>
                    </span>
                </div>
                <a href="#" id="navLogout" class="fade" title="Logout" style="display: none;">
                    <i class="fa-solid fa-arrow-right-from-bracket"></i> Logout
                </a>
            `;

            // Replace the first menu item with our auth elements
            firstMenuItem.outerHTML = authHTML;
        }
    }

    // Update UI based on auth state
    async function updateAuthUI() {
        try {
            const { data: { session } } = await sb.auth.getSession();

            const navAuth = document.getElementById('navAuth');
            const navDashboard = document.getElementById('navDashboard');
            const navAccount = document.getElementById('navAccount');
            const navUser = document.getElementById('navUser');
            const navUserName = document.getElementById('navUserName');
            const navUserAvatar = document.getElementById('navUserAvatar');
            const navUserIcon = document.getElementById('navUserIcon');
            const navLogout = document.getElementById('navLogout');

            if (session && session.user) {
                await upsertUserProfile(session.user);

                // User is logged in
                if (navAuth) navAuth.style.display = 'none';
                if (navDashboard) navDashboard.style.display = 'block';
                if (navAccount) navAccount.style.display = 'block';
                if (navUser) {
                    navUser.style.display = 'block';
                    if (navUserName) {
                        navUserName.textContent = getUserDisplayName(session.user);
                    }
                    if (navUserAvatar && navUserIcon) {
                        const avatarUrl = getUserAvatar(session.user);
                        if (avatarUrl) {
                            navUserAvatar.src = avatarUrl;
                            navUserAvatar.alt = getUserDisplayName(session.user);
                            navUserAvatar.style.display = 'inline-block';
                            navUserIcon.style.display = 'none';
                        } else {
                            navUserAvatar.removeAttribute('src');
                            navUserAvatar.style.display = 'none';
                            navUserIcon.style.display = 'inline-block';
                        }
                    }
                }
                if (navLogout) navLogout.style.display = 'block';
            } else {
                // User is logged out
                if (navAuth) navAuth.style.display = 'block';
                if (navDashboard) navDashboard.style.display = 'none';
                if (navAccount) navAccount.style.display = 'none';
                if (navUser) navUser.style.display = 'none';
                if (navLogout) navLogout.style.display = 'none';
            }
        } catch (error) {
            console.error('Error updating auth UI:', error);
        }
    }

    // Logout function
    async function handleLogout(e) {
        e.preventDefault();

        try {
            const { error } = await sb.auth.signOut();
            if (error) throw error;

            // Redirect to auth page
            window.location.href = '/auth.html';
        } catch (error) {
            console.error('Logout error:', error);
            alert('Failed to logout. Please try again.');
        }
    }

    // Initialize
    function init() {
        // Ensure nav elements exist
        ensureNavElements();

        // Set up logout handler
        const logoutBtn = document.getElementById('navLogout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }

        // Update UI initially
        updateAuthUI();

        // Listen for auth state changes
        sb.auth.onAuthStateChange((event, session) => {
            console.log('Auth state changed:', event);
            updateAuthUI();
        });
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose updateAuthUI globally for manual calls if needed
    window.updateAuthUI = updateAuthUI;
})();
