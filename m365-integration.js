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

const M365_CONFIG = {
    // MSAL Configuration - Update these values after Entra ID app registration
    auth: {
        clientId: '2030acbd-8796-420d-8990-acdf468227a6',  // From Entra ID app registration
        authority: 'https://login.microsoftonline.com/d4402872-0ebc-4758-9c54-71923320c29d',
        // IMPORTANT: This exact URL must be registered in Azure Portal → App Registration → Authentication
        redirectUri: window.location.hostname === 'localhost' 
            ? 'http://localhost:3000/clinical-rounding-adaptive.html'
            : 'https://art1907.github.io/Clinical-Roundup-List/clinical-rounding-adaptive.html'
    },
    cache: {
        cacheLocation: 'sessionStorage',  // Use sessionStorage to match MSAL state storage
        storeAuthStateInCookie: true  // Required for redirect flow reliability
    },
    
    // Microsoft Graph API endpoints
    graphBaseUrl: 'https://graph.microsoft.com/v1.0',
    
    // SharePoint configuration - Update after creating SharePoint site and lists
    sharepoint: {
        siteId: 'bf8b1313-2fb7-4a22-8775-1f0acd899909',  // Get via Graph API: /sites/{hostname}:/sites/{sitename}
        lists: {
            patients: 'c475a404-97fa-44b1-8cca-7dfaec391049',
            onCallSchedule: '7e99100a-aeb4-4fe6-9fb0-3f8188904174',
            settings: '57fbe18d-6fa3-4fff-bc39-5937001e1a0b',
            auditLogs: '36a95571-80dd-4ceb-94d3-36db0be54eae'  // Optional
        }
    },
    
    // Required scopes for delegated permissions
    scopes: ['Sites.ReadWrite.All', 'Files.ReadWrite', 'User.Read'],
    
    // Polling configuration
    pollInterval: 15000,  // 15 seconds
    offlineCacheSize: 500  // Max records to cache in localStorage
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
                
                // Clear URL (both hash and query) on state errors to prevent loop
                if (err.errorCode === 'state_not_found') {
                    console.warn('State mismatch detected - clearing auth code from URL');
                    // Clear search AND hash to remove auth code
                    window.history.replaceState({}, document.title, window.location.pathname);
                    showToast('Authentication failed. Please try again.');
                } else {
                    // Show other auth errors
                    showToast('Authentication error: ' + err.message);
                }
                
                // Update auth state to false on error
                if (typeof window.updateAuthState === 'function') {
                    window.updateAuthState(false, '');
                }
            });
    } catch (err) {
        console.error('MSAL initialization error:', err);
        showToast('Failed to initialize authentication');
        // Update auth state to false on error
        if (typeof window.updateAuthState === 'function') {
            window.updateAuthState(false, '');
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
        showToast('Login failed: ' + err.message);
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
    console.log('User authenticated:', currentAccount.username);
    updateConnectionStatus(true, currentAccount.username);
    
    // Update auth state in main HTML
    if (typeof window.updateAuthState === 'function') {
        window.updateAuthState(true, currentAccount.username);
    }
    
    startPolling();
    
    // Trigger initial data load
    fetchAllData();
}

function updateConnectionStatus(connected, username = '') {
    // Update right-side connection status
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
        if (connected) {
            statusEl.innerHTML = `<span class="text-green-600 font-bold">● Connected (M365)</span> <span class="text-slate-600">${username}</span>`;
        } else {
            statusEl.innerHTML = '<span class="text-red-600 font-bold">● Offline</span>';
        }
    }
    
    // Update left-side status banner
    const statusBar = document.getElementById('connection-status-bar');
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    const statusDetail = document.getElementById('status-detail');
    
    if (connected) {
        // Change to green "Connected (M365)" mode
        if (statusBar) {
            statusBar.className = 'px-4 py-3 flex-shrink-0 flex flex-col items-center justify-center bg-green-50 border-b border-green-200 gap-1';
        }
        if (statusIndicator) {
            statusIndicator.className = 'inline-flex h-3 w-3 rounded-full bg-green-600';
        }
        if (statusText) {
            statusText.className = 'text-sm font-bold text-green-900 uppercase tracking-wide';
            statusText.innerText = 'Connected (M365)';
        }
        if (statusDetail) {
            statusDetail.className = 'text-xs text-green-700 font-semibold';
            statusDetail.innerText = username || 'Authenticated';
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
    }
}

// =============================================================================
// SHAREPOINT LIST OPERATIONS
// =============================================================================

async function graphRequest(endpoint, method = 'GET', body = null) {
    const token = await getAccessToken();
    const url = M365_CONFIG.graphBaseUrl + endpoint;
    
    const options = {
        method: method,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };
    
    if (body) {
        options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Graph API error: ${response.status} - ${errorText}`);
    }
    
    if (response.status === 204) {
        return null;  // No content
    }
    
    return await response.json();
}

// -----------------------------------------------------------------------------
// PATIENTS
// -----------------------------------------------------------------------------

async function fetchPatients(dateFilter = null) {
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
            dob: item.fields.DOB || '',
            mrn: item.fields.MRN || '',
            hospital: item.fields.Hospital || '',
            findingsCodes: item.fields.FindingsCodes ? item.fields.FindingsCodes.split(',').map(c => c.trim()) : [],
            findingsValues: item.fields.FindingsData ? JSON.parse(item.fields.FindingsData) : {},
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

async function savePatient(patientData) {
    const listId = M365_CONFIG.sharepoint.lists.patients;
    const siteId = M365_CONFIG.sharepoint.siteId;
    
    // Build SharePoint list item fields
    const fields = {
        Room: patientData.room || '',
        Date: patientData.date || '',
        Name: patientData.name || '',
        DOB: patientData.dob || '',
        MRN: patientData.mrn || '',
        Hospital: patientData.hospital || '',
        VisitKey: `${patientData.mrn}|${patientData.date}`,  // Compound unique key
        FindingsCodes: patientData.findingsCodes ? patientData.findingsCodes.join(',') : '',
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
    
    if (patientData.id && patientData.id.startsWith('local-')) {
        // New record (local ID) - create in SharePoint
        const endpoint = `/sites/${siteId}/lists/${listId}/items`;
        const body = { fields: fields };
        const response = await graphRequest(endpoint, 'POST', body);
        return response.id;
    } else if (patientData.id) {
        // Update existing record
        const endpoint = `/sites/${siteId}/lists/${listId}/items/${patientData.id}/fields`;
        await graphRequest(endpoint, 'PATCH', fields);
        return patientData.id;
    } else {
        // New record (no ID) - create in SharePoint
        const endpoint = `/sites/${siteId}/lists/${listId}/items`;
        const body = { fields: fields };
        const response = await graphRequest(endpoint, 'POST', body);
        return response.id;
    }
}

async function deletePatient(patientId) {
    const listId = M365_CONFIG.sharepoint.lists.patients;
    const siteId = M365_CONFIG.sharepoint.siteId;
    const endpoint = `/sites/${siteId}/lists/${listId}/items/${patientId}`;
    
    await graphRequest(endpoint, 'DELETE');
}

async function getBackfeedData(mrn) {
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
                dob: item.fields.DOB || '',
                mrn: item.fields.MRN || '',
                hospital: item.fields.Hospital || '',
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

async function fetchOnCallSchedule() {
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

async function saveOnCallShift(shiftData) {
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

async function deleteOnCallShift(shiftId) {
    const listId = M365_CONFIG.sharepoint.lists.onCallSchedule;
    const siteId = M365_CONFIG.sharepoint.siteId;
    const endpoint = `/sites/${siteId}/lists/${listId}/items/${shiftId}`;
    
    await graphRequest(endpoint, 'DELETE');
}

// -----------------------------------------------------------------------------
// SETTINGS
// -----------------------------------------------------------------------------

async function fetchSettings() {
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

async function saveSetting(key, value) {
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

async function importFromCSV(csvText) {
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
            await saveOnCallShift(shift);
        }
    }
    
    // Import patients
    for (const patient of patients) {
        await savePatient(patient);
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
            fetchPatients(),
            fetchOnCallSchedule(),
            fetchSettings()
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
    } catch (err) {
        console.warn('localStorage cache error:', err);
    }
}

function getCachedData(key) {
    try {
        const cached = localStorage.getItem(`m365_cache_${key}`);
        if (cached) {
            const cache = JSON.parse(cached);
            return cache.data;
        }
    } catch (err) {
        console.warn('localStorage retrieve error:', err);
    }
    return null;
}

// =============================================================================
// INITIALIZATION
// =============================================================================

// Expose functions once DOM is ready (initialization triggered from clinical-rounding-adaptive.html)
document.addEventListener('DOMContentLoaded', () => {
    window.m365Login = login;
    window.m365Logout = logout;
    window.m365FetchPatients = fetchPatients;
    window.m365SavePatient = savePatient;
    window.m365DeletePatient = deletePatient;
    window.m365GetBackfeed = getBackfeedData;
    window.m365FetchOnCall = fetchOnCallSchedule;
    window.m365SaveOnCall = saveOnCallShift;
    window.m365DeleteOnCall = deleteOnCallShift;
    window.m365SaveSetting = saveSetting;
    window.m365ExportToOneDrive = exportToOneDrive;
    window.m365ImportFromCSV = importFromCSV;
});

// =============================================================================
// EXPORTS (if using modules)
// =============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        login,
        logout,
        fetchPatients,
        savePatient,
        deletePatient,
        getBackfeedData,
        fetchOnCallSchedule,
        saveOnCallShift,
        deleteOnCallShift,
        fetchSettings,
        saveSetting,
        exportToOneDrive,
        importFromCSV
    };
}
