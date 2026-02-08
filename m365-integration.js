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
const JS_VERSION = '2026-02-08T05:05Z';

const M365_CONFIG = {
    // MSAL Configuration - Configured with your Entra ID app
    auth: {
        clientId: '2030acbd-8796-420d-8990-acdf468227a6',  // Your Entra ID Client ID
        authority: 'https://login.microsoftonline.com/d4402872-0ebc-4758-9c54-71923320c29d',  // Your Tenant ID
        // IMPORTANT: This exact URL must be registered in Azure Portal → App Registration → Authentication
        // Use the page you're actually running on to avoid silent auth failures (Local Mode symptom)
        redirectUri: (() => {
            const currentUri = `${window.location.origin}${window.location.pathname}`;
            // Known good URIs kept for clarity; Entra app must list every value you run from
            const allowed = [
                'http://localhost:3000/clinical-rounding-adaptive.html',
                'https://art1907.github.io/Clinical-Roundup-List/clinical-rounding-adaptive.html'
            ];
            // Prefer exact current page; fallback to first known dev URI to avoid empty string
            return currentUri || allowed[0];
        })()
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
        }
    },
    
    // Required scopes for delegated permissions
    scopes: ['Sites.ReadWrite.All', 'Files.ReadWrite', 'User.Read'],
    
    // Polling configuration
    pollInterval: 15000,  // 15 seconds
    offlineCacheSize: 500,  // Max records to cache in localStorage

    // Debug toggles (temporary)
    debug: {
        minimalSave: true
    }
};

// =============================================================================
// MSAL INITIALIZATION
// =============================================================================

let msalInstance = null;
let currentAccount = null;
let pollTimer = null;

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
        
        const loginRequest = {
            scopes: M365_CONFIG.scopes,
            prompt: 'select_account'
        };
        
        // Try popup on mobile if redirect has issues, otherwise use redirect
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        
        if (isMobile) {
            // Popup might work better on some mobile browsers
            try {
                const response = await msalInstance.loginPopup(loginRequest);
                currentAccount = response.account;
                handleSuccessfulLogin();
            } catch (popupErr) {
                // Fallback to redirect if popup fails
                console.warn('Popup failed, trying redirect:', popupErr);
                await msalInstance.loginRedirect(loginRequest);
            }
        } else {
            // Desktop: use redirect flow
            await msalInstance.loginRedirect(loginRequest);
        }
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
    
    // Update auth state in main HTML
    if (typeof window.updateAuthState === 'function') {
        window.updateAuthState(false, '');
    }
    
    msalInstance.logoutRedirect({
        account: currentAccount
    });
}

async function getAccessToken() {
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
            statusEl.innerHTML = `<span class="text-green-600 font-bold">● Connected (M365)</span> <span class="text-slate-600">${username}</span>`;
            console.log('✓ Updated connection-status element');
        } else {
            statusEl.innerHTML = '<span class="text-red-600 font-bold">● Offline</span>';
            console.log('✓ Updated connection-status (offline)');
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
        // Change to green "Connected (M365)" mode
        if (statusBar) {
            statusBar.className = 'px-4 py-3 flex-shrink-0 flex flex-col items-center justify-center bg-green-50 border-b border-green-200 gap-1';
            console.log('✓ Updated statusBar to Connected (green)');
        }
        if (statusIndicator) {
            statusIndicator.className = 'inline-flex h-3 w-3 rounded-full bg-green-600';
        }
        if (statusText) {
            statusText.className = 'text-sm font-bold text-green-900 uppercase tracking-wide';
            statusText.innerText = 'Connected (M365)';
            console.log('✓ Updated statusText to "Connected (M365)"');
        }
        if (statusDetail) {
            statusDetail.className = 'text-xs text-green-700 font-semibold';
            statusDetail.innerText = username || 'Authenticated';
            console.log('✓ Updated statusDetail to:', username);
        }
    } else {
        // Revert to amber "Local Mode"
        if (statusBar) {
            statusBar.className = 'px-4 py-3 flex-shrink-0 flex flex-col items-center justify-center bg-amber-50 border-b border-amber-200 gap-1';
        }
        if (statusIndicator) {
            statusIndicator.className = 'inline-flex h-3 w-3 rounded-full bg-amber-600';
        }
        if (statusText) {
            statusText.className = 'text-sm font-bold text-amber-900 uppercase tracking-wide';
            statusText.innerText = 'Local Mode';
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

async function graphRequest(endpoint, method = 'GET', body = null) {
    console.log('🔐 graphRequest: Getting access token...');
    const token = await getAccessToken();
    console.log('✅ Access token obtained, length:', token ? token.length : 0);
    
    const url = M365_CONFIG.graphBaseUrl + endpoint;
    console.log('🌐 Calling Graph API:', { method, url: url.substring(0, 100) + '...' });
    
    const options = {
        method: method,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };
    
    if (body) {
        options.body = JSON.stringify(body);
        console.log('📦 Request body size:', options.body.length, 'bytes');
    }
    
    try {
        const response = await fetch(url, options);
        console.log('📨 Response received:', { status: response.status, statusText: response.statusText });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Graph API error response:', { status: response.status, text: errorText });
            throw new Error(`Graph API error: ${response.status} - ${errorText}`);
        }
        
        if (response.status === 204) {
            console.log('✅ No content response (204)');
            return null;  // No content
        }
        
        const data = await response.json();
        console.log('✅ Response JSON parsed successfully');
        return data;
    } catch (fetchErr) {
        console.error('❌ Network/fetch error in graphRequest:', fetchErr.message);
        console.error('   Possible causes:');
        console.error('   - Network connectivity issue');
        console.error('   - CORS blocking');
        console.error('   - Token invalid/expired');
        console.error('   - Timeout');
        throw fetchErr;
    }
}

// -----------------------------------------------------------------------------
// PATIENTS
// -----------------------------------------------------------------------------

async function api_fetchPatients(dateFilter = null) {
    try {
        const listId = M365_CONFIG.sharepoint.lists.patients;
        const siteId = M365_CONFIG.sharepoint.siteId;
        
        let endpoint = `/sites/${siteId}/lists/${listId}/items?expand=fields&$top=1000`;
        
        if (dateFilter) {
            // Filter by date if provided
            endpoint += `&$filter=fields/Date eq '${dateFilter}'`;
        }
        
        const response = await graphRequest(endpoint);
        
        const patients = response.value.map(item => ({
            id: item.id,
            room: item.fields.Room || '',
            date: item.fields.Date || '',
            name: item.fields.Name || '',
            dob: item.fields.DateofBirth || item.fields.DOB || '',
            mrn: item.fields.MRN || '',
            hospital: item.fields.Hospital_x0028_s_x0029_ || item.fields.Hospital || '',
            findingsValues: item.fields.FindingsData ? JSON.parse(item.fields.FindingsData) : {},
            findingsCodes: item.fields.FindingsCodes
                ? item.fields.FindingsCodes.split(',').map(c => c.trim())
                : (item.fields.FindingsData ? Object.keys(JSON.parse(item.fields.FindingsData)) : []),
            findingsText: item.fields.FindingsText || '',
            plan: item.fields.Plan || '',
            supervisingMd: item.fields.SupervisingMD || '',
            pending: item.fields.Pending || '',
            followUp: item.fields.FollowUp || '',
            priority: item.fields.Priority === 'Yes',
            procedureStatus: item.fields.ProcedureStatus || 'To-Do',
            cptPrimary: item.fields.CPTPrimary || '',
            icdPrimary: item.fields.ICDPrimary || '',
            chargeCodesSecondary: item.fields.ChargeCodesSecondary ? JSON.parse(item.fields.ChargeCodesSecondary) : [],
            archived: item.fields.Archived === 'Yes',
            lastUpdated: item.fields.Modified || item.fields.Created
        }));
        
        // Cache in localStorage
        cacheData('patients', patients);
        
        return patients;
    } catch (err) {
        console.error('Error fetching patients:', err);
        
        // Return cached data on error
        return getCachedData('patients') || [];
    }
}

async function api_savePatient(patientData) {
    console.log('SAVE enter', { mrn: patientData?.mrn, name: patientData?.name, has_id: !!patientData?.id });

    const listId = M365_CONFIG.sharepoint.lists.patients;
    const siteId = M365_CONFIG.sharepoint.siteId;

    const normalizeDateForSharePoint = (dateStr) => {
        if (!dateStr) return '';
        return dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00Z`;
    };

    const fields = {
        Room: patientData.room || '',
        Date: normalizeDateForSharePoint(patientData.date || ''),
        Name: patientData.name || '',
        DateofBirth: patientData.dob || '',
        MRN: patientData.mrn || '',
        Hospital_x0028_s_x0029_: patientData.hospital || '',
        VisitKey: `${patientData.mrn}|${patientData.date}`,
        FindingsData: patientData.findingsValues ? JSON.stringify(patientData.findingsValues) : '{}',
        FindingsText: patientData.findingsText || '',
        Plan: patientData.plan || '',
        SupervisingMD: patientData.supervisingMd || '',
        Pending: patientData.pending || '',
        FollowUp: patientData.followUp || '',
        Priority: patientData.priority ? 'Yes' : 'No',
        ProcedureStatus: patientData.procedureStatus || 'To-Do',
        CPTPrimary: patientData.cptPrimary || '',
        ICDPrimary: patientData.icdPrimary || '',
        ChargeCodesSecondary: patientData.chargeCodesSecondary ? JSON.stringify(patientData.chargeCodesSecondary) : '[]',
        Archived: patientData.archived ? 'Yes' : 'No'
    };

    let fieldsToSend = { ...fields };
    ['Hospital_x0028_s_x0029_', 'Priority', 'ProcedureStatus', 'Archived'].forEach((key) => {
        if (fieldsToSend[key] === '' || fieldsToSend[key] === null) {
            delete fieldsToSend[key];
        }
    });

    if (M365_CONFIG.debug && M365_CONFIG.debug.minimalSave) {
        fieldsToSend = {
            VisitKey: fields.VisitKey,
            MRN: fields.MRN,
            Name: fields.Name,
            Date: fields.Date,
            Room: fields.Room,
            DateofBirth: fields.DateofBirth,
            Hospital_x0028_s_x0029_: fields.Hospital_x0028_s_x0029_,
            Plan: fields.Plan,
            FindingsText: fields.FindingsText,
            Pending: fields.Pending,
            FollowUp: fields.FollowUp
        };
        console.warn('DEBUG minimal save enabled; sending fields:', Object.keys(fieldsToSend));
    }

    console.log('SAVE fields', { visitKey: fieldsToSend.VisitKey, hospital: fieldsToSend.Hospital_x0028_s_x0029_ });

    const logAndValidateResponse = (resp, context) => {
        console.log(`RESP ${context}`, resp);
        if (!resp || !resp.id) {
            throw new Error(`${context} did not return an id; response=${JSON.stringify(resp)}`);
        }
        return resp.id;
    };

    try {
        if (patientData.id && patientData.id.startsWith('local-')) {
            console.log('SAVE create (local id)');
            const endpoint = `/sites/${siteId}/lists/${listId}/items`;
            const body = { fields: fieldsToSend };
            const response = await graphRequest(endpoint, 'POST', body);
            const newId = logAndValidateResponse(response, 'create-local');
            console.log('SAVE created id', newId);
            return newId;
        } else if (patientData.id) {
            console.log('SAVE update id', patientData.id);
            const endpoint = `/sites/${siteId}/lists/${listId}/items/${patientData.id}/fields`;
            const response = await graphRequest(endpoint, 'PATCH', fieldsToSend);
            console.log('SAVE patch response', response);
            return patientData.id;
        } else {
            console.log('SAVE create (no id)');
            const endpoint = `/sites/${siteId}/lists/${listId}/items`;
            const body = { fields: fieldsToSend };
            const response = await graphRequest(endpoint, 'POST', body);
            const newId = logAndValidateResponse(response, 'create-noid');
            console.log('SAVE created id', newId);
            return newId;
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
            return {
                id: item.id,
                room: item.fields.Room || '',
                name: item.fields.Name || '',
                dob: item.fields.DateofBirth || item.fields.DOB || '',
                mrn: item.fields.MRN || '',
                hospital: item.fields.Hospital_x0028_s_x0029_ || item.fields.Hospital || '',
                plan: item.fields.Plan || '',
                supervisingMd: item.fields.SupervisingMD || '',
                cptPrimary: item.fields.CPTPrimary || '',
                icdPrimary: item.fields.ICDPrimary || '',
                chargeCodesSecondary: item.fields.ChargeCodesSecondary ? JSON.parse(item.fields.ChargeCodesSecondary) : []
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
        
        const schedule = response.value.map(item => ({
            id: item.id,
            date: item.fields.Date || '',
            provider: item.fields.Provider || '',
            hospitals: item.fields.Hospitals || ''
        }));
        
        cacheData('onCallSchedule', schedule);
        return schedule;
    } catch (err) {
        console.error('Error fetching on-call schedule:', err);
        return getCachedData('onCallSchedule') || [];
    }
}

async function api_saveOnCallShift(shiftData) {
    const listId = M365_CONFIG.sharepoint.lists.onCallSchedule;
    const siteId = M365_CONFIG.sharepoint.siteId;
    
    const fields = {
        Date: shiftData.date || '',
        Provider: shiftData.provider || '',
        Hospitals: shiftData.hospitals || ''
    };
    
    if (shiftData.id) {
        // Update
        const endpoint = `/sites/${siteId}/lists/${listId}/items/${shiftData.id}/fields`;
        await graphRequest(endpoint, 'PATCH', fields);
    } else {
        // Create
        const endpoint = `/sites/${siteId}/lists/${listId}/items`;
        await graphRequest(endpoint, 'POST', { fields: fields });
    }
}

async function api_deleteOnCallShift(shiftId) {
    const listId = M365_CONFIG.sharepoint.lists.onCallSchedule;
    const siteId = M365_CONFIG.sharepoint.siteId;
    const endpoint = `/sites/${siteId}/lists/${listId}/items/${shiftId}`;
    
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
// CSV IMPORT WITH 3-PASS PARSING
// =============================================================================

async function api_importFromCSV(csvText) {
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
    const columnMap = {};
    headerRow.forEach((header, index) => {
        const normalized = (header || '').trim().toLowerCase();
        if (normalized.includes('hospital') || normalized.includes('room')) columnMap.hospital = index;
        else if (normalized.includes('date')) columnMap.date = index;
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
        const isSection = row[0] && row[0].trim() && row.slice(1).every(cell => !cell || !cell.trim());
        
        if (isSection) {
            currentHospital = row[0].trim();
            continue;
        }
        
        // Skip empty rows
        if (row.every(cell => !cell || !cell.trim())) {
            continue;
        }
        
        // Parse patient row
        const patient = {
            room: row[columnMap.hospital] || '',  // Room from Hospital/Room # column
            date: row[columnMap.date] || '',
            name: row[columnMap.name] || '',
            dob: row[columnMap.dob] || '',
            mrn: row[columnMap.mrn] || '',
            hospital: currentHospital,  // From section header
            findingsText: row[columnMap.findings] || '',
            plan: row[columnMap.plan] || '',
            supervisingMd: row[columnMap.supervisingMd] || '',
            pending: row[columnMap.pending] || '',
            followUp: row[columnMap.followUp] || '',
            priority: false,
            procedureStatus: 'To-Do',
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
    window.m365SaveSetting = api_saveSetting;
    window.m365GetCurrentUser = getCurrentUser;
    window.m365ExportToOneDrive = exportToOneDrive;
    window.m365ImportFromCSV = api_importFromCSV;
    window.m365UpdateConnectionStatus = updateConnectionStatus;  // NEW: Export connection status updater
    
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
        fetchSettings: api_fetchSettings,
        saveSetting: api_saveSetting,
        exportToOneDrive,
        importFromCSV: api_importFromCSV
    };
}



