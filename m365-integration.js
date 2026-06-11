/**
 * Clinical Rounding Platform - Pure Microsoft 365 Integration
 * 
 * Architecture: Browser → MSAL.js → Microsoft Graph API → SharePoint Lists + OneDrive
 * Authentication: Entra ID (Azure AD) with delegated permissions
 * Storage: SharePoint Lists (4 lists: Patients, OnCallSchedule, Settings, AuditLogs)
 * File Storage: OneDrive for Excel exports
 * Sync: 10-15 second polling with localStorage caching
 * 
 * No backend services required - all operations run directly from browser.
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

// Build/version marker to confirm the right bundle is loaded
const JS_VERSION = '2026-02-08T07:50Z';

function resolveRedirectUri() {
    const configuredRedirect = String(globalThis.__M365_AUTH_REDIRECT_URI || '').trim();
    if (configuredRedirect) return configuredRedirect;

    const currentUri = `${globalThis.location.origin}${globalThis.location.pathname}`;
    if (currentUri) return currentUri;

    return 'http://localhost:3000/clinical-rounding-adaptive.html';
}

const M365_CONFIG = {
    // MSAL Configuration - Configured with your Entra ID app
    auth: {
        clientId: '2030acbd-8796-420d-8990-acdf468227a6',  // Your Entra ID Client ID
        authority: 'https://login.microsoftonline.com/d4402872-0ebc-4758-9c54-71923320c29d',  // Your Tenant ID
        // IMPORTANT: This exact URL must be registered in Azure Portal → App Registration → Authentication.
        // Override with globalThis.__M365_AUTH_REDIRECT_URI before this script loads if you want a fixed custom auth URL.
        redirectUri: resolveRedirectUri()
    },
    cache: {
        cacheLocation: 'sessionStorage',  // Use sessionStorage to match MSAL state storage
        storeAuthStateInCookie: true  // Required for redirect flow reliability
    },
    
    // Microsoft Graph API endpoints
    graphBaseUrl: 'https://graph.microsoft.com/v1.0',
    
    // SharePoint configuration - Configured with your SharePoint site & lists
    sharepoint: {
        siteId: 'bf8b1313-2fb7-4a22-8775-1f0acd899909',  // Your SharePoint Site ID
        lists: {
            patients: 'c475a404-97fa-44b1-8cca-7dfaec391049',           // Patients List ID
            onCallSchedule: '7e99100a-aeb4-4fe6-9fb0-3f8188904174',    // OnCall List ID
            settings: '57fbe18d-6fa3-4fff-bc39-5937001e1a0b',          // Settings List ID
            auditLogs: '36a95571-80dd-4ceb-94d3-36db0be54eae'          // Audit Logs List ID
        },
        auditFields: {
            userIdentity: 'UserIdentity',
            actionType: 'ActionType',
            recordId: 'RecordId',
            details: 'Details',
            timestamp: 'Timestamp'
        },
        drives: {
            patientDocuments: 'YOUR_PATIENT_DOCS_DRIVE_ID',             // Document Library Drive ID
            patientDocumentsName: 'PatientDocuments'                    // Document Library Name fallback
        },
        patientDocumentsFields: {
            patientId: 'PatientId',
            mrn: 'MRN',
            visitKey: 'Visitkey',
            patientName: 'PatientName',
            uploadedBy: 'UploadedBy',
            uploadedAt: 'UploadedAt',
            originalName: 'OriginalName',
            fileSize: 'FileSize',
            contentType: 'ContentType'
        },
        fields: {
            visitTime: 'VisitTime'
        }
    },
    
    // Required scopes for delegated permissions
    scopes: ['Sites.ReadWrite.All', 'Files.ReadWrite', 'User.Read'],
    
    // Polling configuration
    pollInterval: 15000,  // 15 seconds
    offlineCacheSize: 500,  // Max records to cache in localStorage

    // Debug toggles (temporary)
    debug: {
        minimalSave: false
    }
};

const VISIT_TIME_FIELD = (M365_CONFIG.sharepoint.fields && M365_CONFIG.sharepoint.fields.visitTime) || 'VisitTime';
let patientDocsDriveIdCache = null;
const UNSUPPORTED_PATIENT_FIELDS = new Set();

// =============================================================================
// MSAL INITIALIZATION
// =============================================================================

let msalInstance = null;
let currentAccount = null;
let pollTimer = null;
let sessionInvalidationInProgress = false;

const SERVER_SESSION_POLICY_KEYS = {
    epoch: 'SessionEpoch',
    forceLogoutBeforeUtc: 'ForceLogoutBeforeUtc'
};

const LOCAL_SESSION_POLICY_KEYS = {
    epoch: 'm365_session_epoch',
    authAt: 'm365_auth_at'
};

function parseBoolish(value) {
    if (value === true || value === 1) return true;
    if (typeof value === 'string') {
        const v = value.trim().toLowerCase();
        return v === 'true' || v === 'yes' || v === 'y' || v === '1' || v === 'stat' || v === 'urgent';
    }
    return false;
}

function getStorageItemSafe(key) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function setStorageItemSafe(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch {
        // Ignore storage write errors (private mode / blocked storage).
    }
}

function removeStorageItemSafe(key) {
    try {
        localStorage.removeItem(key);
    } catch {
        // Ignore storage remove errors.
    }
}

function markAuthIssuedAtNow() {
    setStorageItemSafe(LOCAL_SESSION_POLICY_KEYS.authAt, String(Date.now()));
}

function getAuthIssuedAtMs() {
    const raw = getStorageItemSafe(LOCAL_SESSION_POLICY_KEYS.authAt);
    const asNumber = Number.parseInt(raw || '', 10);
    return Number.isFinite(asNumber) ? asNumber : 0;
}

function parseDateMs(value) {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    if (!text) return null;
    const ms = Date.parse(text);
    return Number.isFinite(ms) ? ms : null;
}

function clearAppRuntimeCaches() {
    try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;
            if (key.startsWith('m365_cache_') || key === 'patientDraft') {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch {
        // Ignore storage clear errors.
    }
}

function evaluateServerSessionPolicy(settings) {
    if (!settings || typeof settings !== 'object') {
        return { shouldInvalidate: false, reason: '' };
    }

    const remoteEpoch = String(settings[SERVER_SESSION_POLICY_KEYS.epoch] || '').trim();
    const localEpoch = String(getStorageItemSafe(LOCAL_SESSION_POLICY_KEYS.epoch) || '').trim();

    if (remoteEpoch) {
        if (!localEpoch) {
            setStorageItemSafe(LOCAL_SESSION_POLICY_KEYS.epoch, remoteEpoch);
        } else if (localEpoch !== remoteEpoch) {
            // Persist the new epoch before invalidation so post-login polling does not loop.
            setStorageItemSafe(LOCAL_SESSION_POLICY_KEYS.epoch, remoteEpoch);
            return {
                shouldInvalidate: true,
                reason: 'Session invalidated by administrator (SessionEpoch updated).'
            };
        }
    }

    const forceLogoutBeforeMs = parseDateMs(settings[SERVER_SESSION_POLICY_KEYS.forceLogoutBeforeUtc]);
    if (forceLogoutBeforeMs) {
        const authAtMs = getAuthIssuedAtMs();
        if (!authAtMs || authAtMs < forceLogoutBeforeMs) {
            return {
                shouldInvalidate: true,
                reason: 'Session expired by server policy (ForceLogoutBeforeUtc).'
            };
        }
    }

    return { shouldInvalidate: false, reason: '' };
}

async function triggerServerSessionInvalidation(reason) {
    if (sessionInvalidationInProgress) return;
    sessionInvalidationInProgress = true;

    stopPolling();
    clearAppRuntimeCaches();
    removeStorageItemSafe(LOCAL_SESSION_POLICY_KEYS.authAt);

    if (typeof window.updateAuthState === 'function') {
        try {
            window.updateAuthState(false, '');
        } catch (err) {
            console.warn('Failed to update auth state during invalidation:', err?.message || err);
        }
    }

    if (typeof window.showToast === 'function') {
        window.showToast(`🔒 ${reason || 'Session invalidated. Please sign in again.'}`);
    }

    if (!msalInstance) {
        sessionInvalidationInProgress = false;
        return;
    }

    try {
        await msalInstance.logoutRedirect({ account: currentAccount || undefined });
    } catch (err) {
        console.error('Server session invalidation logout failed:', err);
        sessionInvalidationInProgress = false;
    }
}

function safeJsonParse(value, fallback, contextLabel = 'JSON field') {
    if (value === null || value === undefined || value === '') return fallback;
    try {
        return JSON.parse(value);
    } catch (err) {
        console.warn(`Unable to parse ${contextLabel}; using fallback`, err?.message || err);
        return fallback;
    }
}

function normalizeDateFromSharePoint(value) {
    if (!value) return '';
    const text = String(value).trim();
    // Already normalized for date inputs and calendar comparisons.
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return text;

    const y = parsed.getUTCFullYear();
    const m = String(parsed.getUTCMonth() + 1).padStart(2, '0');
    const d = String(parsed.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function initializeMSAL() {
    try {
        msalInstance = new msal.PublicClientApplication({
            auth: M365_CONFIG.auth,
            cache: M365_CONFIG.cache
        });
        
        // Handle redirect response
        msalInstance.handleRedirectPromise()
            .then(response => {
                if (response) {
                    currentAccount = response.account;
                    // Clear URL params after successful login
                    window.history.replaceState({}, document.title, window.location.pathname);
                    handleSuccessfulLogin();
                } else {
                    // Check if user is already signed in
                    const accounts = msalInstance.getAllAccounts();
                    if (accounts.length > 0) {
                        currentAccount = accounts[0];
                        handleSuccessfulLogin();
                    } else {
                        // No existing session
                        if (typeof window.updateAuthState === 'function') {
                            window.updateAuthState(false, '');
                        }
                    }
                }
            })
            .catch(err => {
                console.error('MSAL redirect error:', err);
                console.error('Error details:', { code: err.errorCode, message: err.message });
                
                // Clear URL (both hash and query) on state errors to prevent loop
                if (err.errorCode === 'state_not_found') {
                    console.warn('State mismatch detected - clearing auth code from URL');
                    // Clear search AND hash to remove auth code
                    window.history.replaceState({}, document.title, window.location.pathname);
                    if (typeof window.showToast === 'function') {
                        window.showToast('Authentication failed. Please try again.');
                    } else {
                        console.error('showToast not available for error display');
                    }
                } else {
                    // Show other auth errors
                    if (typeof window.showToast === 'function') {
                        window.showToast('Authentication error: ' + err.message);
                    } else {
                        console.error('showToast not available for error display');
                    }
                }
                
                // Update auth state to false on error
                if (typeof window.updateAuthState === 'function') {
                    console.log('Calling updateAuthState(false) due to MSAL error');
                    window.updateAuthState(false, '');
                } else {
                    console.error('updateAuthState not available!');
                }
            });
    } catch (err) {
        console.error('MSAL initialization error:', err);
        if (typeof window.showToast === 'function') {
            window.showToast('Failed to initialize authentication');
        } else {
            console.error('showToast not available for error display');
        }
        // Update auth state to false on error
        if (typeof window.updateAuthState === 'function') {
            window.updateAuthState(false, '');
        } else {
            console.error('updateAuthState not available!');
        }
    }
}

async function login() {
    try {
        // Clear any previous auth error flags when user tries again
        sessionStorage.removeItem('msal_auth_error');

        // Ensure MSAL client is available before attempting redirect login.
        if (!msalInstance) {
            if (typeof initializeMSAL === 'function') {
                initializeMSAL();
            }
            if (!msalInstance) {
                throw new Error('Authentication client not initialized yet. Please refresh and try again.');
            }
        }
        
        const loginRequest = {
            scopes: M365_CONFIG.scopes,
            prompt: 'select_account'
        };

        // Redirect-only flow avoids Safari/iOS popup restrictions (block_nested_popups)
        await msalInstance.loginRedirect(loginRequest);
    } catch (err) {
        console.error('Login error:', err);
        if (typeof window.showToast === 'function') {
            window.showToast('Login failed: ' + err.message);
        } else {
            console.error('showToast not available, login error:', err.message);
        }
    }
}

function logout() {
    stopPolling();
    clearAppRuntimeCaches();
    removeStorageItemSafe(LOCAL_SESSION_POLICY_KEYS.authAt);
    
    // Update auth state in main HTML
    if (typeof window.updateAuthState === 'function') {
        window.updateAuthState(false, '');
    }
    
    if (!msalInstance) {
        console.warn('MSAL instance not initialized during logout request.');
        return;
    }

    msalInstance.logoutRedirect({
        account: currentAccount
    });
}

async function getAccessToken() {
    if (!msalInstance) {
        throw new Error('Authentication client is not initialized. Please sign in again.');
    }

    if (!currentAccount) {
        throw new Error('No active account. Please sign in.');
    }
    
    const tokenRequest = {
        account: currentAccount,
        scopes: M365_CONFIG.scopes
    };
    
    try {
        // Try silent token acquisition first
        const response = await msalInstance.acquireTokenSilent(tokenRequest);
        return response.accessToken;
    } catch (err) {
        if (err instanceof msal.InteractionRequiredAuthError) {
            // Fallback to interactive
            const response = await msalInstance.acquireTokenRedirect(tokenRequest);
            return response.accessToken;
        }
        throw err;
    }
}

function handleSuccessfulLogin() {

    sessionInvalidationInProgress = false;
    markAuthIssuedAtNow();
    console.log('🎯 User authenticated:', currentAccount.username);
    console.log('🔄 Calling updateConnectionStatus(true, ...)...');
    
    try {
        updateConnectionStatus(true, currentAccount.username);
        console.log('✓ updateConnectionStatus succeeded');
    } catch (e) {
        console.error('❌ updateConnectionStatus failed:', e);
    }
    
    console.log('🔄 Calling window.updateAuthState(true, ...)...');
    // Update auth state in main HTML
    if (typeof window.updateAuthState === 'function') {
        try {
            window.updateAuthState(true, currentAccount.username);
            console.log('✓ updateAuthState succeeded');
        } catch (e) {
            console.error('❌ updateAuthState failed:', e);
        }
    } else {
        console.error('❌ window.updateAuthState not available!');
    }
    
    console.log('🔄 Starting polling...');
    startPolling();
    
    console.log('🔄 Fetching initial data...');
    // Trigger initial data load
    fetchAllData();
    
    console.log('✅ handleSuccessfulLogin complete');
}

function updateConnectionStatus(connected, username = '') {
    console.log('🔄 updateConnectionStatus called:', { connected, username });
    
    // Safe toast function wrapper
    const safeToast = (msg) => {
        if (typeof window.showToast === 'function') {
            try {
                window.showToast(msg);
            } catch (e) {
                console.warn('Toast failed:', e);
            }
        }
    };
    
    // Update right-side connection status
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
        if (connected) {
            statusEl.innerHTML = '<span class="text-green-700 font-semibold">M365</span>';
            console.log('✓ Updated connection-status element');
        } else {
            statusEl.innerHTML = '';
            console.log('✓ Cleared connection-status (local mode)');
        }
    } else {
        console.warn('⚠️ Element not found: #connection-status');
    }
    
    // Update left-side status banner
    const statusBar = document.getElementById('connection-status-bar');
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    const statusDetail = document.getElementById('status-detail');
    
    if (!statusBar) console.warn('⚠️ Element not found: #connection-status-bar');
    if (!statusIndicator) console.warn('⚠️ Element not found: #status-indicator');
    if (!statusText) console.warn('⚠️ Element not found: #status-text');
    if (!statusDetail) console.warn('⚠️ Element not found: #status-detail');
    
    if (connected) {
        if (statusBar) {
            statusBar.className = 'system-ribbon flex-shrink-0 bg-green-50 border-b border-green-200';
            console.log('✓ Updated statusBar to Connected (green)');
        }
        if (statusIndicator) {
            statusIndicator.className = 'inline-flex h-3 w-3 rounded-full bg-green-600';
        }
        if (statusText) {
            statusText.className = 'text-sm font-bold text-green-900 uppercase tracking-wide';
            statusText.innerText = 'Connected';
            console.log('✓ Updated statusText to "Connected"');
        }
        if (statusDetail) {
            statusDetail.className = 'text-xs text-green-700 font-semibold';
            statusDetail.innerText = username || 'Authenticated';
            console.log('✓ Updated statusDetail to:', username);
        }
    } else {
        if (statusBar) {
            statusBar.className = 'system-ribbon flex-shrink-0 bg-amber-50 border-b border-amber-200';
        }
        if (statusIndicator) {
            statusIndicator.className = 'inline-flex h-3 w-3 rounded-full bg-amber-600';
        }
        if (statusText) {
            statusText.className = 'text-sm font-bold text-amber-900 uppercase tracking-wide';
            statusText.innerText = 'Local';
        }
        if (statusDetail) {
            statusDetail.className = 'text-xs text-amber-700 font-semibold';
            statusDetail.innerText = 'No persistence';
        }
        console.log('✓ Reverted statusBar to Local Mode (amber)');
    }
    console.log('✅ updateConnectionStatus complete');
}

// =============================================================================
// SHAREPOINT LIST OPERATIONS
// =============================================================================

/**
 * graphRequest — single Graph API call with:
 *   • AbortController timeout (default 30 s, 60 s for batch)
 *   • Automatic 429 retry honouring Retry-After header
 *   • Exponential back-off for 5xx / network errors (max 3 retries)
 *
 * @param {string}        endpoint   Relative path after graphBaseUrl
 * @param {string}        method     HTTP verb
 * @param {object|null}   body       JSON body (serialised internally)
 * @param {object}        opts
 * @param {number}        opts.timeoutMs   Per-attempt timeout (default 30 000)
 * @param {number}        opts.maxRetries  Total retry budget (default 3)
 * @param {AbortSignal}   opts.signal      External abort signal (e.g. from ImportEngine)
 */
async function graphRequest(endpoint, method = 'GET', body = null, opts = {}) {
    const timeoutMs  = opts.timeoutMs  ?? 30_000;
    const maxRetries = opts.maxRetries ?? 3;
    const external   = opts.signal     ?? null;

    console.log('🔐 graphRequest: Getting access token...');
    const token = await getAccessToken();
    console.log('✅ Access token obtained, length:', token ? token.length : 0);

    const url = M365_CONFIG.graphBaseUrl + endpoint;
    console.log('🌐 Calling Graph API:', { method, url: url.substring(0, 120) + '...' });

    const bodyStr = body ? JSON.stringify(body) : null;
    if (bodyStr) console.log('📦 Request body size:', bodyStr.length, 'bytes');

    let lastErr;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        // Abort if an external signal (e.g. user cancel) has fired
        if (external?.aborted) throw new DOMException('Aborted', 'AbortError');

        const controller = new AbortController();
        const timer      = setTimeout(() => controller.abort(), timeoutMs);

        // Link external signal to our internal controller
        const onExternalAbort = () => controller.abort();
        if (external) external.addEventListener('abort', onExternalAbort, { once: true });

        try {
            const options = {
                method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type':  'application/json'
                },
                signal: controller.signal
            };
            if (bodyStr) options.body = bodyStr;

            const response = await fetch(url, options);
            clearTimeout(timer);
            if (external) external.removeEventListener('abort', onExternalAbort);

            console.log('📨 Response received:', { status: response.status, statusText: response.statusText });

            // ── 429 Throttle ─────────────────────────────────────────────────
            if (response.status === 429) {
                const retryAfter = parseInt(response.headers.get('Retry-After') || '10', 10);
                const waitMs     = Math.max(retryAfter * 1000, 1000);
                console.warn(`⏳ Graph API 429 throttle — waiting ${retryAfter}s before retry (attempt ${attempt + 1}/${maxRetries + 1})`);
                await new Promise(r => setTimeout(r, waitMs));
                lastErr = new Error(`Graph API error: 429 - throttled (retry-after ${retryAfter}s)`);
                continue;   // retry
            }

            // ── 5xx Server Error — retryable ─────────────────────────────────
            if (response.status >= 500 && attempt < maxRetries) {
                const backoff = Math.min(Math.pow(2, attempt) * 1000, 15_000);
                console.warn(`⚠️ Graph API ${response.status} — back-off ${backoff}ms (attempt ${attempt + 1})`);
                await new Promise(r => setTimeout(r, backoff));
                lastErr = new Error(`Graph API error: ${response.status}`);
                continue;
            }

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Graph API error response:', { status: response.status, text: errorText });
                throw new Error(`Graph API error: ${response.status} - ${errorText}`);
            }

            if (response.status === 204) {
                console.log('✅ No content response (204)');
                return null;
            }

            const data = await response.json();
            console.log('✅ Response JSON parsed successfully');
            return data;

        } catch (fetchErr) {
            clearTimeout(timer);
            if (external) external.removeEventListener('abort', onExternalAbort);

            if (fetchErr.name === 'AbortError') {
                if (external?.aborted) throw new DOMException('Aborted by caller', 'AbortError');
                // Our own timeout
                lastErr = new Error(`Graph API request timed out after ${timeoutMs}ms (${method} ${endpoint.substring(0, 60)})`);
                if (attempt < maxRetries) {
                    const backoff = Math.min(Math.pow(2, attempt) * 1000, 10_000);
                    console.warn('⏱️ Request timeout — back-off', backoff, 'ms');
                    await new Promise(r => setTimeout(r, backoff));
                    continue;
                }
            } else {
                lastErr = fetchErr;
                if (attempt < maxRetries) {
                    const backoff = Math.min(Math.pow(2, attempt) * 1000, 10_000);
                    console.warn('❌ Network/fetch error — back-off', backoff, 'ms:', fetchErr.message);
                    await new Promise(r => setTimeout(r, backoff));
                    continue;
                }
            }

            console.error('❌ graphRequest failed after all retries:', lastErr.message);
            throw lastErr;
        }
    }

    throw lastErr ?? new Error('graphRequest: exhausted retries');
}

// -----------------------------------------------------------------------------
// AUDIT LOGS
// -----------------------------------------------------------------------------

async function api_logAuditEvent(event) {
    const deriveAuditAction = (entry) => {
        const type = String(entry?.type || '').toLowerCase();
        const action = String(entry?.action || '').toLowerCase();
        const fieldChanged = String(entry?.fieldChanged || '').toLowerCase();

        if (action === 'create' || (type === 'data_change' && fieldChanged === 'record' && entry?.oldValue == null)) return 'create';
        if (action === 'delete') return 'delete';
        if (action === 'view' || type === 'patient_access' || type === 'access') return 'view';
        if (action === 'export' || type === 'export') return 'export';
        if (type === 'data_change' || action === 'update' || fieldChanged) return 'update';
        if (action === 'auth' || type === 'auth') return 'auth';
        return 'update';
    };

    try {
        const listId = M365_CONFIG.sharepoint.lists.auditLogs;
        const siteId = M365_CONFIG.sharepoint.siteId;
        const fieldsMap = M365_CONFIG.sharepoint.auditFields || {};
        const normalizedAction = deriveAuditAction(event);
        const detailsJson = JSON.stringify(event || {});

        const fullFields = {
            Title: event.type || 'audit',
            [fieldsMap.userIdentity || 'UserIdentity']: event.userId || 'unknown',
            [fieldsMap.actionType || 'ActionType']: normalizedAction,
            [fieldsMap.recordId || 'RecordId']: event.recordId || event.patientId || '',
            [fieldsMap.details || 'Details']: detailsJson,
            [fieldsMap.timestamp || 'Timestamp']: event.timestamp || new Date().toISOString()
        };

        const endpoint = `/sites/${siteId}/lists/${listId}/items`;
        const payloadCandidates = [
            { fields: fullFields },
            {
                fields: {
                    Title: event.type || 'audit',
                    [fieldsMap.details || 'Details']: detailsJson,
                    [fieldsMap.timestamp || 'Timestamp']: event.timestamp || new Date().toISOString()
                }
            },
            { fields: { Title: `${normalizedAction}: ${event.recordId || event.patientId || 'n/a'}` } }
        ];

        let lastErr = null;
        for (const candidate of payloadCandidates) {
            try {
                await graphRequest(endpoint, 'POST', candidate);
                return;
            } catch (err) {
                lastErr = err;
            }
        }
        throw lastErr || new Error('Unknown audit log write failure');
    } catch (err) {
        console.warn('Audit log write failed:', err.message || err);
    }
}

async function api_fetchAuditLogs(filters = {}) {
    try {
        const listId = M365_CONFIG.sharepoint.lists.auditLogs;
        const siteId = M365_CONFIG.sharepoint.siteId;
        const fieldsMap = M365_CONFIG.sharepoint.auditFields || {};
        const endpoint = `/sites/${siteId}/lists/${listId}/items?expand=fields&$top=500`;
        const response = await graphRequest(endpoint);

        const logs = (response.value || []).map((item) => {
            const fields = item.fields || {};
            const titleText = String(fields.Title || '');
            const titleParts = titleText.split(':');
            const titleAction = (titleParts[0] || '').trim().toLowerCase();
            const titleRecordId = (titleParts[1] || '').trim();
            const detailsRaw = fields[fieldsMap.details || 'Details'] || '';
            let detailsObj = null;
            try {
                detailsObj = detailsRaw ? JSON.parse(detailsRaw) : null;
            } catch (e) {
                console.debug('Audit details parse skipped:', e?.message || e);
                detailsObj = null;
            }

            return {
                id: item.id,
                createdDateTime: item.createdDateTime,
                timestamp: fields[fieldsMap.timestamp || 'Timestamp'] || item.createdDateTime || '',
                userId: fields[fieldsMap.userIdentity || 'UserIdentity'] || detailsObj?.userId || 'unknown',
                userIdentity: fields[fieldsMap.userIdentity || 'UserIdentity'] || detailsObj?.userId || 'unknown',
                action: fields[fieldsMap.actionType || 'ActionType'] || detailsObj?.action || detailsObj?.type || titleAction || 'event',
                type: detailsObj?.type || fields[fieldsMap.actionType || 'ActionType'] || titleAction || 'event',
                recordId: fields[fieldsMap.recordId || 'RecordId'] || detailsObj?.recordId || detailsObj?.patientId || titleRecordId || '',
                patientId: detailsObj?.patientId || fields[fieldsMap.recordId || 'RecordId'] || '',
                fieldChanged: detailsObj?.fieldChanged || '',
                message: detailsObj?.message || '',
                errorType: detailsObj?.errorType || '',
                detailsSummary: detailsObj?.detailsSummary
                    || (detailsObj?.fieldChanged ? `${detailsObj.fieldChanged} changed` : '')
                    || detailsObj?.message
                    || detailsRaw
                    || '-',
                details: detailsRaw,
                source: 'm365'
            };
        });

        let filtered = logs;
        if (filters.fromDate) {
            const from = new Date(`${filters.fromDate}T00:00:00`).getTime();
            filtered = filtered.filter((log) => {
                const t = new Date(log.timestamp).getTime();
                return Number.isFinite(t) && t >= from;
            });
        }
        if (filters.toDate) {
            const to = new Date(`${filters.toDate}T23:59:59`).getTime();
            filtered = filtered.filter((log) => {
                const t = new Date(log.timestamp).getTime();
                return Number.isFinite(t) && t <= to;
            });
        }

        return filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (err) {
        console.warn('Audit log fetch failed:', err.message || err);
        return [];
    }
}

// -----------------------------------------------------------------------------
// PATIENTS
// -----------------------------------------------------------------------------

const PROC_DATE_TOKEN_REGEX = /\[\[PROC_DATE:(\d{4}-\d{2}-\d{2})\]\]/i;

function normalizeProcedureDateToken(value) {
    const normalized = String(value || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
}

function extractProcedureDateToken(planValue = '') {
    const match = String(planValue || '').match(PROC_DATE_TOKEN_REGEX);
    return match ? normalizeProcedureDateToken(match[1]) : '';
}

function stripProcedureDateToken(planValue = '') {
    return String(planValue || '')
        .replace(/\s*\[\[PROC_DATE:\d{4}-\d{2}-\d{2}\]\]\s*/gi, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .trim();
}

function composePlanWithProcedureDateToken(planValue = '', procedureDate = '') {
    const cleanPlan = stripProcedureDateToken(planValue);
    const normalizedDate = normalizeProcedureDateToken(procedureDate);
    if (!normalizedDate) return cleanPlan;
    return cleanPlan ? `${cleanPlan}\n[[PROC_DATE:${normalizedDate}]]` : `[[PROC_DATE:${normalizedDate}]]`;
}

async function api_fetchPatients(dateFilter = null) {
    try {
        const listId = M365_CONFIG.sharepoint.lists.patients;
        const siteId = M365_CONFIG.sharepoint.siteId;

        let baseEndpoint = `/sites/${siteId}/lists/${listId}/items?expand=fields&$top=1000`;
        if (dateFilter) {
            baseEndpoint += `&$filter=fields/Date eq '${dateFilter}'`;
        }

        // Follow @odata.nextLink pages so we never silently truncate large lists
        let allItems = [];
        let nextEndpoint = baseEndpoint;
        while (nextEndpoint) {
            const response = await graphRequest(nextEndpoint);
            allItems = allItems.concat(response.value || []);
            // nextLink is an absolute URL — strip the base so graphRequest can prefix it again
            const nl = response['@odata.nextLink'];
            if (nl) {
                nextEndpoint = nl.replace(M365_CONFIG.graphBaseUrl, '');
                console.log(`📄 Fetching next page of patients (${allItems.length} so far)...`);
            } else {
                nextEndpoint = null;
            }
        }
        console.log(`✅ Fetched ${allItems.length} patient records (all pages)`);

        const patients = allItems.map(item => {
            const rawPlan = item.fields.Plan || '';
            const rawPriority = item.fields.Priority ?? item.fields.Stat ?? item.fields.STAT ?? item.fields.StatPriority ?? item.fields.IsSTAT;
            const statValue = parseBoolish(rawPriority);
            const findingsValues = safeJsonParse(item.fields.FindingsData, {}, `FindingsData for item ${item.id}`);
            const findingsDates = safeJsonParse(item.fields.FindingsDates, {}, `FindingsDates for item ${item.id}`);
            const procedureValues = safeJsonParse(item.fields.ProcedureData, {}, `ProcedureData for item ${item.id}`);
            const procedureDates = safeJsonParse(item.fields.ProcedureDates, {}, `ProcedureDates for item ${item.id}`);
            const findingsCodes = Array.from(new Set([
                ...(item.fields.FindingsCodes ? item.fields.FindingsCodes.split(',').map(c => c.trim()) : []),
                ...Object.keys(findingsValues || {}),
                ...Object.keys(findingsDates || {})
            ].map((code) => String(code || '').trim()).filter(Boolean)));
            const procedureCodes = Array.from(new Set([
                ...(item.fields.ProcedureCodes ? item.fields.ProcedureCodes.split(',').map(c => c.trim()) : []),
                ...Object.keys(procedureDates || {}),
                ...(String(procedureValues?.otherSurgeryText || '').trim() ? ['other-surgery'] : [])
            ].map((code) => String(code || '').trim()).filter(Boolean)));
            return ({
            // Keep STAT compatibility across app variants (stat and priority)
            stat: statValue,
            priority: statValue,
            id: normalizeSharePointListItemId(item.id) || String(item.id || ''),
            room: item.fields.Room || '',
            date: normalizeDateFromSharePoint(item.fields.Date || ''),
            name: item.fields.Name || item.fields.Title || '',
            createdBy: item.fields.CreatedBy || item.fields.Created_x0020_By || '',
            dob: item.fields.DateofBirth || item.fields.DOB || '',
            mrn: item.fields.MRN || '',
            hospital: item.fields.Hospital_x0028_s_x0029_ || item.fields.Hospital || '',
            visitTime: item.fields[VISIT_TIME_FIELD] || item.fields.Visit_x0020_Time || '',
            visitKey: item.fields.VisitKey || '',
            findingsValues,
            findingsDates,
            findingsCodes,
            procedureValues,
            procedureDates,
            procedureCodes,
            findingsText: item.fields.FindingsText || '',
            plan: stripProcedureDateToken(rawPlan),
            procedureDate: extractProcedureDateToken(rawPlan),
            progressNotes: item.fields.ProgressNotes || item.fields.Progress_x0020_Notes || '',
            supervisingMd: item.fields.SupervisingMD || '',
            pending: item.fields.Pending || '',
            followUp: item.fields.FollowUp || '',
            procedureStatus: item.fields.ProcedureStatus || 'NEW CONSULT',
            cptPrimary: item.fields.CPTPrimary || '',
            icdPrimary: item.fields.ICDPrimary || '',
            chargeCodesSecondary: safeJsonParse(item.fields.ChargeCodesSecondary, [], `ChargeCodesSecondary for item ${item.id}`),
            catchAll: item.fields.CatchAll || '',
            archived: parseBoolish(item.fields.Archived),
            notesHistory: item.fields.ChangeNotesHistory
                ? safeJsonParse(item.fields.ChangeNotesHistory, [], `ChangeNotesHistory for item ${item.id}`)
                : safeJsonParse(item.fields.NotesHistory, [], `NotesHistory for item ${item.id}`),
            lastUpdated: item.fields.Modified || item.fields.Created
        });
        });
        
        // Cache in localStorage
        cacheData('patients', patients);
        
        return patients;
    } catch (err) {
        console.error('Error fetching patients:', err);
        
        // Return cached data on error
        return getCachedData('patients') || [];
    }
}

async function api_normalizePriorityFields(options = {}) {
    const { forceNo = false, dryRun = false } = options || {};
    const listId = M365_CONFIG.sharepoint.lists.patients;
    const siteId = M365_CONFIG.sharepoint.siteId;

    const normalizePriorityValue = (raw) => {
        if (forceNo) return false;
        return parseBoolish(raw);
    };

    const endpoint = `/sites/${siteId}/lists/${listId}/items?expand=fields&$top=1000`;
    const response = await graphRequest(endpoint);
    const items = response?.value || [];

    let updated = 0;
    let skipped = 0;
    const failed = [];

    for (const item of items) {
        const priorityFieldKey = ['Priority', 'Stat', 'STAT', 'StatPriority', 'IsSTAT']
            .find((k) => Object.prototype.hasOwnProperty.call(item?.fields || {}, k)) || 'Priority';

        const currentPriority = item?.fields?.[priorityFieldKey];
        const nextPriority = normalizePriorityValue(currentPriority);

        // Treat semantic match as already normalized.
        const isAlreadyNormalized = parseBoolish(currentPriority) === nextPriority;

        if (isAlreadyNormalized) {
            skipped += 1;
            continue;
        }

        if (!dryRun) {
            try {
                const endpointPatch = `/sites/${siteId}/lists/${listId}/items/${item.id}/fields`;
                const candidates = [
                    { [priorityFieldKey]: nextPriority },
                    { [priorityFieldKey]: nextPriority ? 'Yes' : 'No' },
                    { [priorityFieldKey]: nextPriority ? 'STAT' : 'Normal' },
                    { Priority: nextPriority },
                    { Priority: nextPriority ? 'Yes' : 'No' },
                    { Stat: nextPriority }
                ];

                let patched = false;
                for (const payload of candidates) {
                    try {
                        await graphRequest(endpointPatch, 'PATCH', payload);
                        patched = true;
                        break;
                    } catch (_) {
                        // try next candidate
                    }
                }

                if (!patched) {
                    throw new Error('Unable to patch Priority using any supported payload shape');
                }
            } catch (err) {
                failed.push({ id: item.id, error: String(err?.message || err) });
                continue;
            }
        }

        updated += 1;
    }

    const result = {
        total: items.length,
        updated,
        skipped,
        failedCount: failed.length,
        failed
    };

    console.log('Priority normalization result:', result);
    return result;
}

async function api_savePatient(patientData) {
    console.log('SAVE enter', { mrn: patientData?.mrn, name: patientData?.name, has_id: !!patientData?.id });

    const listId = M365_CONFIG.sharepoint.lists.patients;
    const siteId = M365_CONFIG.sharepoint.siteId;
    const normalizedPatientItemId = normalizeSharePointListItemId(patientData?.id);
    const isUpdate = Boolean(normalizedPatientItemId);

    const normalizeDateForSharePoint = (dateStr) => {
        if (!dateStr) return '';
        return dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00Z`;
    };

    const normalizeBool = (val) => parseBoolish(val);
    const computeVisitKey = () => {
        if (patientData.visitKey) return patientData.visitKey;
        const normalizedDate = String(patientData.date || '').trim();
        const normalizedMrn = String(patientData.mrn || '').trim().toLowerCase();
        const normalizedHospital = String(patientData.hospital || '').trim().toLowerCase();
        const normalizedRoom = String(patientData.room || '').trim().toLowerCase();
        const normalizedName = String(patientData.name || '').trim().toLowerCase();

        if (normalizedMrn && normalizedDate) {
            return `${normalizedMrn}|${normalizedDate}`;
        }

        return `fallback|${normalizedDate}|${normalizedHospital || 'unknown-hospital'}|${normalizedRoom || 'unknown-room'}|${normalizedName || 'unknown-name'}`;
    };

    const visitTimeValue = patientData.visitTime || (isUpdate ? '' : new Date().toISOString());
    const computedVisitKey = computeVisitKey();
    const visitKeyValue = isUpdate ? (patientData.visitKey || computedVisitKey) : computedVisitKey;

    const fields = {
        Room: patientData.room || '',
        Date: normalizeDateForSharePoint(patientData.date || ''),
        Title: patientData.name || '',
        Name: patientData.name || '',
        DateofBirth: patientData.dob || '',
        DOB: patientData.dob || '', // Fallback catch for variations
        Date_x0020_of_x0020_Birth: patientData.dob || '', // Fallback catch for spaces
        MRN: patientData.mrn || '',
        Hospital_x0028_s_x0029_: patientData.hospital || '',
        VisitKey: visitKeyValue,
        [VISIT_TIME_FIELD]: visitTimeValue,
        FindingsCodes: Array.isArray(patientData.findingsCodes)
            ? patientData.findingsCodes.map((code) => String(code || '').trim()).filter(Boolean).join(',')
            : '',
        FindingsData: patientData.findingsValues ? JSON.stringify(patientData.findingsValues) : '{}',
        FindingsDates: patientData.findingsDates ? JSON.stringify(patientData.findingsDates) : '{}',
        ProcedureCodes: Array.isArray(patientData.procedureCodes)
            ? patientData.procedureCodes.map((code) => String(code || '').trim()).filter(Boolean).join(',')
            : '',
        ProcedureData: patientData.procedureValues ? JSON.stringify(patientData.procedureValues) : '{}',
        ProcedureDates: patientData.procedureDates ? JSON.stringify(patientData.procedureDates) : '{}',
        FindingsText: patientData.findingsText || '',
        Plan: composePlanWithProcedureDateToken(patientData.plan || '', patientData.procedureDate || ''),
        ProgressNotes: patientData.progressNotes || '',
        SupervisingMD: patientData.supervisingMd || '',
        Pending: patientData.pending || '',
        FollowUp: patientData.followUp || '',
        Priority: normalizeBool(patientData.stat) || normalizeBool(patientData.priority),
        ProcedureStatus: patientData.procedureStatus || 'NEW CONSULT',
        CPTPrimary: patientData.cptPrimary || '',
        ICDPrimary: patientData.icdPrimary || '',
        ChargeCodesSecondary: patientData.chargeCodesSecondary ? JSON.stringify(patientData.chargeCodesSecondary) : '[]',
        CatchAll: patientData.catchAll || '',
        Archived: normalizeBool(patientData.archived),
        ChangeNotesHistory: patientData.notesHistory ? JSON.stringify(patientData.notesHistory) : '[]'
    };

    let fieldsToSend = { ...fields };

    // Skip fields already known to be unsupported in this tenant/list schema.
    UNSUPPORTED_PATIENT_FIELDS.forEach((fieldName) => {
        delete fieldsToSend[fieldName];
    });

    if (M365_CONFIG.debug && M365_CONFIG.debug.minimalSave) {
        console.warn('DEBUG minimal save disabled; sending full payload');
    }

    ['Hospital_x0028_s_x0029_', 'ProcedureStatus', 'Archived', 'Date', 'MRN', VISIT_TIME_FIELD].forEach((key) => {
        if (fieldsToSend[key] === '' || fieldsToSend[key] === null) {
            delete fieldsToSend[key];
        }
    });

    if (isUpdate) {
        delete fieldsToSend.VisitKey;
    }

    if (!isUpdate && (!fieldsToSend.Date || !fieldsToSend.VisitKey)) {
        throw new Error('Missing required fields: Date and visit identity are required to create a record');
    }

    console.log('SAVE fields', { visitKey: fieldsToSend.VisitKey, hospital: fieldsToSend.Hospital_x0028_s_x0029_ });

    const logAndValidateResponse = (resp, context) => {
        console.log(`RESP ${context}`, resp);
        if (!resp || !resp.id) {
            throw new Error(`${context} did not return an id; response=${JSON.stringify(resp)}`);
        }
        return resp.id;
    };

    const buildBaseFields = () => ({
        Title: fieldsToSend.Title || fieldsToSend.Name || 'Untitled',
        Name: fieldsToSend.Name || fieldsToSend.Title || 'Untitled',
        MRN: fieldsToSend.MRN,
        Date: fieldsToSend.Date,
        VisitKey: fieldsToSend.VisitKey,
        [VISIT_TIME_FIELD]: fieldsToSend[VISIT_TIME_FIELD]
    });

    const buildPatchFields = () => {
        const baseKeys = new Set(['Title', 'Name', 'MRN', 'Date', 'VisitKey', VISIT_TIME_FIELD]);
        const patch = {};
        Object.keys(fieldsToSend).forEach((key) => {
            if (!baseKeys.has(key)) {
                patch[key] = fieldsToSend[key];
            }
        });
        return patch;
    };

    const extractUnknownFieldName = (err) => {
        const message = String(err?.message || '');
        const match = message.match(/Field '([^']+)' is not recognized/i);
        return match ? match[1] : null;
    };

    const patchFieldsWithRetry = async (endpoint, payload) => {
        const mutablePayload = { ...payload };
        let attempts = 0;

        while (attempts < 8) {
            attempts += 1;
            try {
                return await graphRequest(endpoint, 'PATCH', mutablePayload);
            } catch (err) {
                const unknownField = extractUnknownFieldName(err);
                if (unknownField && Object.prototype.hasOwnProperty.call(mutablePayload, unknownField)) {
                    console.warn(`SAVE patch retry: dropping unknown field '${unknownField}' and retrying`);
                    UNSUPPORTED_PATIENT_FIELDS.add(unknownField);
                    delete mutablePayload[unknownField];
                    continue;
                }

                // Some tenants return generic invalidRequest without a field name.
                // Isolate by attempting one field at a time and keep only valid fields.
                const msg = String(err?.message || '');
                if (/Graph API error:\s*400/i.test(msg) && /"code":"invalidRequest"/i.test(msg) && /Field\s'[^']+'\sis not recognized/i.test(msg) === false) {
                    console.warn('SAVE patch retry: generic invalidRequest, isolating valid fields');
                    const validEntries = [];
                    const invalidKeys = [];

                    for (const [key, value] of Object.entries(mutablePayload)) {
                        try {
                            await graphRequest(endpoint, 'PATCH', { [key]: value });
                            validEntries.push([key, value]);
                        } catch (fieldErr) {
                            // Try alternative representations for schema-variant fields.
                            let recovered = false;
                            if (key === 'Priority' || key === 'Archived') {
                                const asBool = parseBoolish(value);
                                const alternates = [
                                    asBool,
                                    asBool ? 'Yes' : 'No',
                                    asBool ? 'STAT' : 'Normal',
                                    asBool ? 'true' : 'false'
                                ];
                                for (const alt of alternates) {
                                    try {
                                        await graphRequest(endpoint, 'PATCH', { [key]: alt });
                                        recovered = true;
                                        break;
                                    } catch (_) {
                                        // keep trying alternatives
                                    }
                                }
                            }

                            if (!recovered) {
                                invalidKeys.push(key);
                                const unknownFieldFromSingle = extractUnknownFieldName(fieldErr);
                                if (unknownFieldFromSingle) {
                                    UNSUPPORTED_PATIENT_FIELDS.add(unknownFieldFromSingle);
                                }
                            } else {
                                validEntries.push([key, value]);
                            }
                        }
                    }

                    if (invalidKeys.length > 0) {
                        console.warn('SAVE patch isolate: rejected fields', invalidKeys);
                    }

                    // If at least one field patched successfully, treat as success.
                    if (validEntries.length > 0) {
                        return null;
                    }
                }
                throw err;
            }
        }

        throw new Error('PATCH retry limit exceeded while removing unknown SharePoint fields');
    };

    const isUniqueConstraintError = (err) => {
        const message = String(err?.message || '');
        return /unique constraints already has the provided value/i.test(message)
            || (/Graph API error:\s*400/i.test(message) && /invalidRequest/i.test(message) && /unique/i.test(message));
    };

    const createOrRecoverByVisitKey = async (contextLabel) => {
        const endpoint = `/sites/${siteId}/lists/${listId}/items`;
        const baseFields = buildBaseFields();

        try {
            const response = await graphRequest(endpoint, 'POST', { fields: baseFields });
            const newId = logAndValidateResponse(response, contextLabel);
            const patchFields = buildPatchFields();
            if (Object.keys(patchFields).length > 0) {
                console.log(`SAVE patch after create (${contextLabel})`, Object.keys(patchFields));
                try {
                    await patchFieldsWithRetry(`/sites/${siteId}/lists/${listId}/items/${newId}/fields`, patchFields);
                } catch (patchErr) {
                    console.error('SAVE patch failed after create; isolating invalid fields', patchErr);
                    const invalidFields = [];
                    for (const [key, value] of Object.entries(patchFields)) {
                        try {
                            await graphRequest(`/sites/${siteId}/lists/${listId}/items/${newId}/fields`, 'PATCH', { [key]: value });
                        } catch (fieldErr) {
                            invalidFields.push(key);
                        }
                    }
                    console.error('SAVE patch rejected fields:', invalidFields);
                    console.error('SAVE patch failed after create; deleting created record');
                    await graphRequest(`/sites/${siteId}/lists/${listId}/items/${newId}`, 'DELETE');
                    throw new Error(`SharePoint rejected fields: ${invalidFields.join(', ') || 'unknown'}`);
                }
            }
            console.log('SAVE created id', newId);
            return newId;
        } catch (createErr) {
            if (!isUniqueConstraintError(createErr)) {
                throw createErr;
            }

            console.warn('SAVE create hit unique VisitKey; attempting recovery', computedVisitKey);
            const recoveredItemId = await resolvePatientItemIdByVisitKey(siteId, listId, computedVisitKey);
            if (!recoveredItemId) {
                throw createErr;
            }

            const updateFields = { ...fieldsToSend };
            delete updateFields.VisitKey;
            await patchFieldsWithRetry(`/sites/${siteId}/lists/${listId}/items/${recoveredItemId}/fields`, updateFields);
            console.log('SAVE recovered existing id after unique constraint', recoveredItemId);
            return recoveredItemId;
        }
    };

    try {
        let targetItemId = normalizedPatientItemId;
        if (!targetItemId) {
            targetItemId = await resolvePatientItemIdByVisitKey(siteId, listId, computedVisitKey);
        }

        if (targetItemId) {
            console.log('SAVE update resolved id', targetItemId);
            const updateFields = { ...fieldsToSend };
            delete updateFields.VisitKey;
            const endpoint = `/sites/${siteId}/lists/${listId}/items/${targetItemId}/fields`;
            const response = await patchFieldsWithRetry(endpoint, updateFields);
            console.log('SAVE patch response', response);
            return targetItemId;
        }

        if (patientData.id && patientData.id.startsWith('local-')) {
            console.log('SAVE create (local id)');
            return await createOrRecoverByVisitKey('create-local');
        } else {
            console.log('SAVE create (no id)');
            return await createOrRecoverByVisitKey('create-noid');
        }
    } catch (err) {
        console.error('SAVE error', err);
        throw err;
    }
}
async function api_deletePatient(patientId) {
    const listId = M365_CONFIG.sharepoint.lists.patients;
    const siteId = M365_CONFIG.sharepoint.siteId;
    const endpoint = `/sites/${siteId}/lists/${listId}/items/${patientId}`;
    
    await graphRequest(endpoint, 'DELETE');
}

async function api_getBackfeedData(mrn) {
    try {
        const listId = M365_CONFIG.sharepoint.lists.patients;
        const siteId = M365_CONFIG.sharepoint.siteId;
        
        // Query for most recent record with matching MRN, sorted by date descending
        const endpoint = `/sites/${siteId}/lists/${listId}/items?expand=fields&$filter=fields/MRN eq '${mrn}'&$orderby=fields/Date desc&$top=1`;
        
        const response = await graphRequest(endpoint);
        
        if (response.value && response.value.length > 0) {
            const item = response.value[0];
            const rawPlan = item.fields.Plan || '';
            return {
                id: item.id,
                room: item.fields.Room || '',
                name: item.fields.Name || '',
                dob: item.fields.DateofBirth || item.fields.DOB || '',
                mrn: item.fields.MRN || '',
                hospital: item.fields.Hospital_x0028_s_x0029_ || item.fields.Hospital || '',
                plan: stripProcedureDateToken(rawPlan),
                procedureDate: extractProcedureDateToken(rawPlan),
                supervisingMd: item.fields.SupervisingMD || '',
                cptPrimary: item.fields.CPTPrimary || '',
                icdPrimary: item.fields.ICDPrimary || '',
                chargeCodesSecondary: safeJsonParse(item.fields.ChargeCodesSecondary, [], `Backfeed ChargeCodesSecondary for item ${item.id}`)
                // Note: Exclude findings, pending, followUp per backfeed logic
            };
        }
        
        return null;
    } catch (err) {
        console.error('Error fetching backfeed data:', err);
        return null;
    }
}

// -----------------------------------------------------------------------------
// ON-CALL SCHEDULE
// -----------------------------------------------------------------------------

async function api_fetchOnCallSchedule() {
    try {
        const listId = M365_CONFIG.sharepoint.lists.onCallSchedule;
        const siteId = M365_CONFIG.sharepoint.siteId;
        const endpoint = `/sites/${siteId}/lists/${listId}/items?expand=fields&$top=100`;
        
        const response = await graphRequest(endpoint);
        
        const schedule = response.value.map(item => {
            const providerRaw = item.fields.Provider || '';
            const providers = String(providerRaw)
                .split(/\s*\|\s*|\s*,\s*/)
                .map(v => v.trim())
                .filter(Boolean);
            return {
                id: normalizeSharePointListItemId(item.id) || String(item.id || ''),
                date: normalizeDateFromSharePoint(item.fields.Date || ''),
                provider: providers[0] || providerRaw || '',
                provider2: providers[1] || '',
                provider3: providers[2] || '',
                hospitals: item.fields.Hospitals || ''
            };
        });
        
        cacheData('onCallSchedule', schedule);
        return schedule;
    } catch (err) {
        console.error('Error fetching on-call schedule:', err);
        return getCachedData('onCallSchedule') || [];
    }
}

function isSharePointListItemId(value) {
    return normalizeSharePointListItemId(value) !== '';
}

function normalizeSharePointListItemId(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    // Ignore likely client-generated timestamps (e.g. Date.now())
    if (/^\d{10,}$/.test(raw)) return '';

    if (/^\d+$/.test(raw)) return raw;

    // Graph occasionally surfaces IDs like "3-<suffix>"; list item endpoints need "3".
    const prefixed = raw.match(/^(\d+)-/);
    if (prefixed && prefixed[1]) return prefixed[1];

    return '';
}

async function resolvePatientItemIdByVisitKey(siteId, listId, visitKey) {
    if (!visitKey) return '';

    try {
        const escapedVisitKey = String(visitKey).replaceAll("'", "''");
        const response = await graphRequest(`/sites/${siteId}/lists/${listId}/items?expand=fields&$filter=fields/VisitKey eq '${escapedVisitKey}'&$top=2`);
        const match = (response.value || [])[0];
        return normalizeSharePointListItemId(match?.id);
    } catch (err) {
        console.warn('Failed resolving patient item id by VisitKey:', err?.message || err);
        return '';
    }
}

async function resolveOnCallShiftItemIdByDate(siteId, listId, shiftDate) {
    if (!shiftDate) return '';

    try {
        const response = await graphRequest(`/sites/${siteId}/lists/${listId}/items?expand=fields&$top=500`);
        const match = (response.value || []).find((item) => {
            const normalizedDate = normalizeDateFromSharePoint(item.fields?.Date || '');
            return normalizedDate === shiftDate;
        });

        return normalizeSharePointListItemId(match?.id);
    } catch (err) {
        console.warn('Failed resolving on-call item id by date:', err?.message || err);
        return '';
    }
}

async function api_saveOnCallShift(shiftData) {
    const listId = M365_CONFIG.sharepoint.lists.onCallSchedule;
    const siteId = M365_CONFIG.sharepoint.siteId;
    
    const providerValues = [shiftData.provider, shiftData.provider2, shiftData.provider3]
        .map(v => String(v || '').trim())
        .filter(Boolean);
    const fields = {
        Date: shiftData.date || '',
        Provider: providerValues.join(' | '),
        Hospitals: shiftData.hospitals || ''
    };

    let normalizedItemId = normalizeSharePointListItemId(shiftData.id);
    if (!normalizedItemId) {
        normalizedItemId = await resolveOnCallShiftItemIdByDate(siteId, listId, shiftData.date);
    }

    if (normalizedItemId) {
        const endpoint = `/sites/${siteId}/lists/${listId}/items/${normalizedItemId}/fields`;
        await graphRequest(endpoint, 'PATCH', fields);
        return { ...shiftData, id: normalizedItemId };
    }

    const endpoint = `/sites/${siteId}/lists/${listId}/items`;
    const createdItem = await graphRequest(endpoint, 'POST', { fields: fields });
    const createdId = normalizeSharePointListItemId(createdItem?.id);
    return {
        ...shiftData,
        id: createdId || String(createdItem?.id || shiftData.id || '')
    };
}

async function api_deleteOnCallShift(shiftId) {
    const normalizedItemId = normalizeSharePointListItemId(shiftId);
    if (!normalizedItemId) {
        console.warn('Skipping M365 delete for non-SharePoint on-call shift id:', shiftId);
        return;
    }

    const listId = M365_CONFIG.sharepoint.lists.onCallSchedule;
    const siteId = M365_CONFIG.sharepoint.siteId;
    const endpoint = `/sites/${siteId}/lists/${listId}/items/${normalizedItemId}`;
    
    await graphRequest(endpoint, 'DELETE');
}

// -----------------------------------------------------------------------------
// SETTINGS
// -----------------------------------------------------------------------------

async function api_fetchSettings() {
    try {
        const listId = M365_CONFIG.sharepoint.lists.settings;
        const siteId = M365_CONFIG.sharepoint.siteId;
        const endpoint = `/sites/${siteId}/lists/${listId}/items?expand=fields&$top=100`;
        
        const response = await graphRequest(endpoint);
        
        const settings = {};
        response.value.forEach(item => {
            const key = item.fields.Key;
            const value = item.fields.Value;
            if (key) settings[key] = value;
        });
        
        return settings;
    } catch (err) {
        console.error('Error fetching settings:', err);
        return {};
    }
}

async function api_saveSetting(key, value) {
    const listId = M365_CONFIG.sharepoint.lists.settings;
    const siteId = M365_CONFIG.sharepoint.siteId;
    
    // Check if setting exists
    const endpoint = `/sites/${siteId}/lists/${listId}/items?expand=fields&$filter=fields/Key eq '${key}'`;
    const response = await graphRequest(endpoint);
    
    const fields = {
        Key: key,
        Value: value
    };
    
    if (response.value && response.value.length > 0) {
        // Update existing
        const itemId = response.value[0].id;
        const updateEndpoint = `/sites/${siteId}/lists/${listId}/items/${itemId}/fields`;
        await graphRequest(updateEndpoint, 'PATCH', fields);
    } else {
        // Create new
        const createEndpoint = `/sites/${siteId}/lists/${listId}/items`;
        await graphRequest(createEndpoint, 'POST', { fields: fields });
    }
}

// =============================================================================
// ONEDRIVE OPERATIONS
// =============================================================================

async function exportToOneDrive(xlsxBlob, filename) {
    try {
        const token = await getAccessToken();
        const driveEndpoint = `${M365_CONFIG.graphBaseUrl}/me/drive/root:/Clinical Rounding/${filename}:/content`;
        
        const response = await fetch(driveEndpoint, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            },
            body: xlsxBlob
        });
        
        if (!response.ok) {
            throw new Error(`OneDrive upload failed: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Export successful:', result.webUrl);
        return result.webUrl;
    } catch (err) {
        console.error('OneDrive export error:', err);
        throw err;
    }
}

// =============================================================================
// PATIENT DOCUMENTS (SHAREPOINT DOCUMENT LIBRARY)
// =============================================================================

async function resolvePatientDocsDriveId() {
    if (patientDocsDriveIdCache) return patientDocsDriveIdCache;
    const configured = M365_CONFIG.sharepoint?.drives?.patientDocuments;
    if (configured && configured !== 'YOUR_PATIENT_DOCS_DRIVE_ID') {
        patientDocsDriveIdCache = configured;
        return patientDocsDriveIdCache;
    }

    const siteId = M365_CONFIG.sharepoint.siteId;
    const driveName = M365_CONFIG.sharepoint?.drives?.patientDocumentsName || 'PatientDocuments';
    const response = await graphRequest(`/sites/${siteId}/drives`);
    const match = response.value.find(d => d.name === driveName);
    if (!match) {
        throw new Error(`Patient documents library not found: ${driveName}`);
    }
    patientDocsDriveIdCache = match.id;
    return patientDocsDriveIdCache;
}

function sanitizeDrivePathSegment(value) {
    return String(value || '')
        .replace(/["*:<>?\\|]/g, '_')
        .replace(/[#%&]/g, '_')
        .replace(/[\u0000-\u001f]/g, '')
        .trim()
        .slice(0, 180) || 'attachment';
}

async function updatePatientFileMetadata(driveId, driveItemId, meta = {}, file = null) {
    const fieldsMap = M365_CONFIG.sharepoint?.patientDocumentsFields || {};
    const metadata = {
        [fieldsMap.patientId || 'PatientId']: meta.patientId || meta.id || '',
        [fieldsMap.mrn || 'MRN']: meta.mrn || '',
        [fieldsMap.visitKey || 'Visitkey']: meta.visitKey || '',
        [fieldsMap.patientName || 'PatientName']: meta.patientName || '',
        [fieldsMap.uploadedBy || 'UploadedBy']: meta.uploadedBy || currentAccount?.username || '',
        [fieldsMap.uploadedAt || 'UploadedAt']: meta.uploadedAt || new Date().toISOString(),
        [fieldsMap.originalName || 'OriginalName']: file?.name || meta.originalName || '',
        [fieldsMap.fileSize || 'FileSize']: file?.size || meta.fileSize || 0,
        [fieldsMap.contentType || 'ContentType']: file?.type || meta.contentType || ''
    };
    const cleaned = Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined && value !== null && value !== ''));
    if (!Object.keys(cleaned).length) return;

    try {
        await graphRequest(`/sites/${M365_CONFIG.sharepoint.siteId}/drives/${driveId}/items/${driveItemId}/listItem/fields`, 'PATCH', cleaned);
    } catch (err) {
        console.warn('Patient file metadata batch update skipped; retrying supported columns only:', err?.message || err);
        for (const [fieldName, value] of Object.entries(cleaned)) {
            try {
                await graphRequest(`/sites/${M365_CONFIG.sharepoint.siteId}/drives/${driveId}/items/${driveItemId}/listItem/fields`, 'PATCH', { [fieldName]: value });
            } catch (fieldErr) {
                console.warn(`Patient file metadata column skipped (${fieldName}):`, fieldErr?.message || fieldErr);
            }
        }
    }
}

async function api_uploadPatientFile(patientId, file, meta = {}) {
    const siteId = M365_CONFIG.sharepoint.siteId;
    const driveId = await resolvePatientDocsDriveId();

    const safePatientFolder = sanitizeDrivePathSegment(patientId);
    const safeName = sanitizeDrivePathSegment(file.name);
    const uploadPath = `/sites/${siteId}/drives/${driveId}/root:/PatientDocuments/${safePatientFolder}/${safeName}:/content`;
    const token = await getAccessToken();

    const uploadResponse = await fetch(`${M365_CONFIG.graphBaseUrl}${uploadPath}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': file.type || 'application/octet-stream'
        },
        body: file
    });

    if (!uploadResponse.ok) {
        const errText = await uploadResponse.text();
        throw new Error(`Upload failed: ${uploadResponse.status} - ${errText}`);
    }

    const driveItem = await uploadResponse.json();
    await updatePatientFileMetadata(driveId, driveItem.id, { ...meta, patientId }, file);
    return driveItem;
}

async function api_fetchPatientFiles(patientId) {
    const siteId = M365_CONFIG.sharepoint.siteId;
    const driveId = await resolvePatientDocsDriveId();
    const endpoint = `${M365_CONFIG.graphBaseUrl}/sites/${siteId}/drives/${driveId}/root:/PatientDocuments/${sanitizeDrivePathSegment(patientId)}:/children?$expand=listItem`;

    const token = await getAccessToken();
    const response = await fetch(endpoint, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.status === 404) {
        return [];
    }

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Graph API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const fieldsMap = M365_CONFIG.sharepoint?.patientDocumentsFields || {};
    return data.value.map(item => ({
        fields: item.listItem?.fields || {},
        id: item.id,
        driveItemId: item.id,
        name: item.name || 'Attachment',
        webUrl: item.webUrl || '#',
        size: item.size || 0,
        uploadedAt: item.listItem?.fields?.[fieldsMap.uploadedAt || 'UploadedAt'] || item.createdDateTime || '',
        uploadedBy: item.listItem?.fields?.[fieldsMap.uploadedBy || 'UploadedBy'] || item.createdBy?.user?.displayName || item.createdBy?.user?.email || '',
        mrn: item.listItem?.fields?.[fieldsMap.mrn || 'MRN'] || '',
        visitKey: item.listItem?.fields?.[fieldsMap.visitKey || 'Visitkey'] || ''
    }));
}

async function api_deletePatientFile(driveItemId) {
    const siteId = M365_CONFIG.sharepoint.siteId;
    const driveId = await resolvePatientDocsDriveId();
    await graphRequest(`/sites/${siteId}/drives/${driveId}/items/${driveItemId}`, 'DELETE');
}

// =============================================================================
// CSV IMPORT WITH 3-PASS PARSING
// =============================================================================

async function api_importFromCSV(csvText) {
    const normalizeCell = (value) => String(value ?? '').replaceAll('\u00A0', ' ').trim();
    const normalizeSectionName = (value) => normalizeCell(value).toLowerCase().replaceAll(/[^a-z0-9]+/g, ' ').trim();
    const knownHospitalSections = (() => {
        const names = new Set();
        const addName = (value) => {
            const normalized = normalizeSectionName(value);
            if (normalized) names.add(normalized);
        };
        const addVariants = (value) => {
            const text = normalizeCell(value);
            if (!text) return;
            addName(text);
            const withoutParens = text.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
            addName(withoutParens);
            const simplified = withoutParens.replace(/\b(campus|medical center|hospital|center)\b/gi, ' ').replace(/\s+/g, ' ').trim();
            addName(simplified);
        };

        [
            'WGMC',
            'AWC',
            'BTMC',
            'AHD',
            'BEMC',
            'Westgate Medical Center',
            'Abrazo West',
            'Abrazo West Campus',
            'Banner Thunderbird Medical Center'
        ].forEach(addVariants);

        String(globalThis.globalSettings?.hospitals || '')
            .split(',')
            .map(normalizeCell)
            .filter(Boolean)
            .forEach(addVariants);

        const hospitalSelect = document.getElementById('f-hospital');
        Array.from(hospitalSelect?.options || []).forEach((option) => {
            addVariants(option.value);
            addVariants(option.textContent || '');
        });

        return names;
    })();
    const isKnownHospitalSection = (value) => knownHospitalSections.has(normalizeSectionName(value));
    const rows = Papa.parse(csvText, { header: false }).data;
    
    if (rows.length < 5) {
        throw new Error('CSV file too short. Expected on-call data + headers + patient rows.');
    }
    
    // PASS 1: Parse on-call schedule (rows 1-3)
    const onCallData = [];
    for (let i = 0; i < 3 && i < rows.length; i++) {
        const row = rows[i];
        if (row.length >= 3) {
            onCallData.push({
                date: row[0] || '',
                provider: row[1] || '',
                hospitals: row[2] || ''
            });
        }
    }
    
    // PASS 2: Parse column headers (row 4)
    const headerRow = rows[3];
    const columnMap = {
        hospital: -1,
        room: -1,
        date: -1,
        name: -1,
        dob: -1,
        mrn: -1,
        findings: -1,
        plan: -1,
        supervisingMd: -1,
        pending: -1,
        followUp: -1
    };
    headerRow.forEach((header, index) => {
        const normalized = normalizeSectionName(header).replaceAll(' ', '');
        if (normalized === 'hospital' || normalized === 'facility' || (normalized.includes('hospital') && !normalized.includes('room'))) {
            columnMap.hospital = index;
        } else if (normalized.includes('room') || normalized === 'hospitalroom') {
            columnMap.room = index;
        } else if (normalized.includes('date')) columnMap.date = index;
        else if (normalized.includes('name')) columnMap.name = index;
        else if (normalized.includes('dob') || normalized.includes('birth')) columnMap.dob = index;
        else if (normalized.includes('mrn')) columnMap.mrn = index;
        else if (normalized.includes('dx') || normalized.includes('finding')) columnMap.findings = index;
        else if (normalized.includes('plan')) columnMap.plan = index;
        else if (normalized.includes('supervising') || normalized.includes('md')) columnMap.supervisingMd = index;
        else if (normalized.includes('pending')) columnMap.pending = index;
        else if (normalized.includes('follow')) columnMap.followUp = index;
    });
    
    // PASS 3: Parse patient rows with hospital section detection (rows 5+)
    const patients = [];
    let currentHospital = '';
    
    for (let i = 4; i < rows.length; i++) {
        const row = rows[i];
        
        // Check if this is a hospital section header (only first column populated, rest empty)
        const firstCell = normalizeCell(row[0]);
        const isSection = firstCell && row.slice(1).every(cell => !normalizeCell(cell)) && isKnownHospitalSection(firstCell);
        
        if (isSection) {
            currentHospital = firstCell;
            continue;
        }
        
        // Skip empty rows
        if (row.every(cell => !cell || !cell.trim())) {
            continue;
        }
        
        // Parse patient row
        const patient = {
            room: row[columnMap.room] || '',
            date: row[columnMap.date] || '',
            name: row[columnMap.name] || '',
            dob: row[columnMap.dob] || '',
            mrn: row[columnMap.mrn] || '',
            hospital: row[columnMap.hospital] || currentHospital,
            findingsText: row[columnMap.findings] || '',
            plan: row[columnMap.plan] || '',
            supervisingMd: row[columnMap.supervisingMd] || '',
            pending: row[columnMap.pending] || '',
            followUp: row[columnMap.followUp] || '',
            procedureStatus: 'NEW CONSULT',
            archived: false
        };
        
        if (patient.mrn) {  // Only add if MRN exists
            patients.push(patient);
        }
    }
    
    // Save to SharePoint
    console.log(`Importing ${onCallData.length} on-call shifts and ${patients.length} patients...`);
    
    // Import on-call schedule
    for (const shift of onCallData) {
        if (shift.date && shift.provider) {
            await api_saveOnCallShift(shift);
        }
    }
    
    // Import patients
    for (const patient of patients) {
        await api_savePatient(patient);
    }
    
    return {
        onCallCount: onCallData.length,
        patientCount: patients.length
    };
}

// =============================================================================
// POLLING & CACHING
// =============================================================================

function startPolling() {
    if (pollTimer) {
        clearInterval(pollTimer);
    }
    
    pollTimer = setInterval(() => {
        fetchAllData();
    }, M365_CONFIG.pollInterval);
}

function stopPolling() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
}

async function fetchAllData() {
    try {
        const [patients, schedule, settings] = await Promise.all([
            api_fetchPatients(),
            api_fetchOnCallSchedule(),
            api_fetchSettings()
        ]);

        const sessionPolicy = evaluateServerSessionPolicy(settings);
        if (sessionPolicy.shouldInvalidate) {
            await triggerServerSessionInvalidation(sessionPolicy.reason);
            return;
        }
        
        // Update global state (assumes these variables exist in main HTML)
        if (typeof window.updatePatientsFromM365 === 'function') {
            window.updatePatientsFromM365(patients);
        }
        if (typeof window.updateOnCallFromM365 === 'function') {
            window.updateOnCallFromM365(schedule);
        }
        if (typeof window.updateSettingsFromM365 === 'function') {
            window.updateSettingsFromM365(settings);
        }
    } catch (err) {
        console.error('Error fetching data:', err);
        // Fail silently, use cached data
    }
}

function cacheData(key, data) {
    try {
        const cache = {
            data: data,
            timestamp: Date.now()
        };
        localStorage.setItem(`m365_cache_${key}`, JSON.stringify(cache));
        console.log('💾 Cached to localStorage:', `m365_cache_${key}`);
    } catch (err) {
        if (err.name === 'QuotaExceededError' || err.message.includes('QuotaExceededError')) {
            console.warn('⚠️  localStorage full or not available (likely Tracking Prevention):', err.message);
        } else if (err.name === 'SecurityError' || err.message.includes('SecurityError')) {
            console.warn('🔒 Tracking Prevention blocking localStorage access:', err.message);
        } else {
            console.warn('📝 localStorage cache error:', err);
        }
    }
}

function getCachedData(key) {
    try {
        const cached = localStorage.getItem(`m365_cache_${key}`);
        if (cached) {
            const cache = JSON.parse(cached);
            console.log('✅ Retrieved from localStorage cache:', `m365_cache_${key}`);
            return cache.data;
        }
    } catch (err) {
        if (err.name === 'SecurityError' || err.message.includes('SecurityError')) {
            console.warn('🔒 Tracking Prevention blocking localStorage read:', err.message);
        } else {
            console.warn('📝 localStorage retrieve error:', err);
        }
    }
    return null;
}

// Get current authenticated user
function getCurrentUser() {
    console.log('📧 getCurrentUser called:', {
        currentAccountExists: !!currentAccount,
        username: currentAccount?.username,
        msalAccountsCount: msalInstance?.getAllAccounts?.()?.length
    });
    
    if (currentAccount && currentAccount.username) {
        console.log('✅ Returning username:', currentAccount.username);
        return currentAccount.username;
    }
    
    // Fallback: try to get from MSAL directly
    if (msalInstance) {
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length > 0) {
            console.log('✅ Found account in MSAL, returning:', accounts[0].username);
            return accounts[0].username;
        }
    }
    
    console.warn('⚠️ No current user found, returning null');
    return null;
}

// =============================================================================
// INITIALIZATION
// =============================================================================

// Expose functions once DOM is ready (initialization triggered from clinical-rounding-adaptive.html)
document.addEventListener('DOMContentLoaded', () => {
    console.log('📦 M365 Integration: Registering global functions...');
    
    window.m365Login = login;
    window.m365Logout = logout;
    window.m365FetchPatients = api_fetchPatients;
    console.log('📌 About to assign api_savePatient as window.m365SavePatient...');
    window.m365SavePatient = api_savePatient;
    console.log('📌 m365SavePatient assigned successfully');
    window.m365DeletePatient = api_deletePatient;
    window.m365GetBackfeed = api_getBackfeedData;
    window.m365FetchOnCall = api_fetchOnCallSchedule;
    window.m365SaveOnCall = api_saveOnCallShift;
    window.m365DeleteOnCall = api_deleteOnCallShift;
    window.m365SaveOnCallShift = api_saveOnCallShift;
    window.m365DeleteOnCallShift = api_deleteOnCallShift;
    window.m365GetAuditLogs = api_fetchAuditLogs;
    window.m365SaveSetting = api_saveSetting;
    window.m365NormalizePriorityFields = api_normalizePriorityFields;
    window.m365GetCurrentUser = getCurrentUser;
    window.m365ExportToOneDrive = exportToOneDrive;
    window.m365ImportFromCSV = api_importFromCSV;
    window.m365UpdateConnectionStatus = updateConnectionStatus;  // NEW: Export connection status updater

        window.m365UploadPatientFile = api_uploadPatientFile;
        window.m365FetchPatientFiles = api_fetchPatientFiles;
        window.m365DeletePatientFile = api_deletePatientFile;
        window.m365LogAuditEvent = api_logAuditEvent;
    
    console.log('✓ M365 Integration functions registered:', {
        login: typeof window.m365Login,
        updateConnectionStatus: typeof window.m365UpdateConnectionStatus,
        getCurrentUser: typeof window.m365GetCurrentUser
    });
});

// =============================================================================
// EXPORTS (if using modules)
// =============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        login,
        logout,
        fetchPatients: api_fetchPatients,
        savePatient: api_savePatient,
        deletePatient: api_deletePatient,
        getBackfeedData: api_getBackfeedData,
        fetchOnCallSchedule: api_fetchOnCallSchedule,
        saveOnCallShift: api_saveOnCallShift,
        deleteOnCallShift: api_deleteOnCallShift,
        fetchAuditLogs: api_fetchAuditLogs,
        fetchSettings: api_fetchSettings,
        saveSetting: api_saveSetting,
        normalizePriorityFields: api_normalizePriorityFields,
        exportToOneDrive,
        importFromCSV: api_importFromCSV
    };
}



