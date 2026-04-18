/**
 * NexCore Labs - Database-Driven Authentication UI
 * Uses Supabase table for approved users whitelist
 *
 * To use this version:
 * 1. Run sql/create_approved_users_table.sql in your Supabase database
 * 2. Replace auth-ui.js with this file in your HTML pages
 * 3. Add approved emails via the dashboard or direct SQL
 */

(function() {
    'use strict';

    const sb = window.supabaseClient;
    const ALLOWED_DOMAINS = ['squ.edu.om', 'student.squ.edu.om'];
    const AUTH_NOTICE_KEY = 'auth_notice';
    const RESTRICTED_EMAIL_NOTICE = 'Only SQU email addresses (@student.squ.edu.om / @squ.edu.om) or approved users can sign in.';
    let isEnforcingEmailDomain = false;

    // Cache for approved emails (refreshed on each auth check)
    let approvedEmailsCache = [];

    if (!sb) {
        console.error('Supabase client not found. Make sure supabase-client.js is loaded first.');
        return;
    }

    /**
     * Fetch approved emails from database
     */
    async function fetchApprovedEmails() {
        try {
            const { data, error } = await sb
                .from('approved_users')
                .select('email');

            if (error) {
                console.warn('Could not fetch approved users:', error.message);
                console.warn('Error details:', error);
                return [];
            }

            const emails = data.map(row => row.email.toLowerCase());
            console.log('✓ Fetched approved emails:', emails);
            return emails;
        } catch (err) {
            console.warn('Error fetching approved users:', err);
            return [];
        }
    }

    /**
     * Check if email is allowed (domain-based or whitelisted)
     */
    async function isAllowedEmail(email) {
        if (typeof email !== 'string') return false;
        const normalized = email.trim().toLowerCase();

        console.log('Checking email authorization for:', normalized);

        // Check if email is from allowed domain
        const isDomainAllowed = ALLOWED_DOMAINS.some(domain =>
            normalized.endsWith(`@${domain}`)
        );

        if (isDomainAllowed) {
            console.log('✓ Email allowed (SQU domain):', normalized);
            return true;
        }

        // Check database whitelist
        if (approvedEmailsCache.length === 0) {
            console.log('Cache empty, fetching approved emails...');
            approvedEmailsCache = await fetchApprovedEmails();
        }

        const isApproved = approvedEmailsCache.includes(normalized);
        if (isApproved) {
            console.log('✓ Email allowed (in approved_users):', normalized);
        } else {
            console.warn('✗ Email NOT allowed:', normalized);
            console.warn('Approved emails in cache:', approvedEmailsCache);
        }

        return isApproved;
    }

    function persistAuthNotice(message) {
        try {
            sessionStorage.setItem(AUTH_NOTICE_KEY, message);
        } catch (_) {}
    }

    async function enforceEmailDomain(session) {
        const email = session?.user?.email;
        if (!session?.user) return false;

        const allowed = await isAllowedEmail(email);
        if (allowed) return true;

        if (isEnforcingEmailDomain) return false;
        isEnforcingEmailDomain = true;

        try {
            persistAuthNotice(RESTRICTED_EMAIL_NOTICE);
            await sb.auth.signOut();
            if (!window.location.pathname.endsWith('/auth.html') && window.location.pathname !== '/auth.html') {
                window.location.href = '/auth.html?auth_notice=restricted_email';
            }
        } catch (error) {
            console.warn('Failed to enforce email policy:', error?.message || error);
            if (!window.location.pathname.endsWith('/auth.html') && window.location.pathname !== '/auth.html') {
                window.location.href = '/auth.html?auth_notice=restricted_email';
            }
        } finally {
            isEnforcingEmailDomain = false;
        }

        return false;
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
            document.getElementById('navAdmin') &&
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
                <a href="admin-users.html" id="navAdmin" class="fade" title="Admin Panel" style="display: none;">
                    <i class="fa-solid fa-user-shield"></i> Admin Panel
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

    /**
     * Check if user is an admin
     */
    async function isUserAdmin(email) {
        if (!email) return false;

        try {
            const { data, error } = await sb
                .from('admins')
                .select('email')
                .eq('email', email.toLowerCase())
                .single();

            return !error && !!data;
        } catch (err) {
            return false;
        }
    }

    // Update UI based on auth state
    async function updateAuthUI() {
        try {
            const { data: { session } } = await sb.auth.getSession();

            const navAuth = document.getElementById('navAuth');
            const navDashboard = document.getElementById('navDashboard');
            const navAdmin = document.getElementById('navAdmin');
            const navAccount = document.getElementById('navAccount');
            const navUser = document.getElementById('navUser');
            const navUserName = document.getElementById('navUserName');
            const navUserAvatar = document.getElementById('navUserAvatar');
            const navUserIcon = document.getElementById('navUserIcon');
            const navLogout = document.getElementById('navLogout');

            if (session && session.user) {
                // Refresh approved emails cache
                approvedEmailsCache = await fetchApprovedEmails();

                const allowedSession = await enforceEmailDomain(session);
                if (!allowedSession) return;
                await upsertUserProfile(session.user);

                // Check if user is admin
                const userIsAdmin = await isUserAdmin(session.user.email);

                // User is logged in
                if (navAuth) navAuth.style.display = 'none';
                if (navDashboard) navDashboard.style.display = 'block';
                if (navAccount) navAccount.style.display = 'block';

                // Show admin button only for admins
                if (navAdmin) {
                    navAdmin.style.display = userIsAdmin ? 'block' : 'none';
                }

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
                if (navAdmin) navAdmin.style.display = 'none';
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
        sb.auth.onAuthStateChange(async (event, session) => {
            console.log('Auth state changed:', event);
            if (event === 'SIGNED_IN' && session?.user) {
                const allowedSession = await enforceEmailDomain(session);
                if (!allowedSession) {
                    updateAuthUI();
                    return;
                }
            }
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

    // Expose function to add approved users (for admin dashboard)
    window.addApprovedUser = async function(email, approvedBy, reason) {
        try {
            const { data, error } = await sb
                .from('approved_users')
                .insert([{
                    email: email.toLowerCase(),
                    approved_by: approvedBy,
                    reason: reason
                }])
                .select();

            if (error) throw error;

            // Refresh cache
            approvedEmailsCache = await fetchApprovedEmails();

            return { success: true, data };
        } catch (error) {
            console.error('Failed to add approved user:', error);
            return { success: false, error: error.message };
        }
    };

    // Expose function to remove approved users
    window.removeApprovedUser = async function(email) {
        try {
            const { error } = await sb
                .from('approved_users')
                .delete()
                .eq('email', email.toLowerCase());

            if (error) throw error;

            // Refresh cache
            approvedEmailsCache = await fetchApprovedEmails();

            return { success: true };
        } catch (error) {
            console.error('Failed to remove approved user:', error);
            return { success: false, error: error.message };
        }
    };
})();
