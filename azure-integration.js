/* 
 * Azure/M365 Integration Script
 * Replace the Firebase <script type="module"> section with this
 */

// Global Variables
let patients = [];
let onCallSchedule = [];
let selectedPatientIds = new Set();
let currentUser = null;
let globalSettings = { onCall: "", hospitals: "" };
let currentTab = 'active';
let rawImportData = null;
let calDate = new Date();
let isConnected = false;
let accessToken = null;
let lastUpdatedMax = null;
let pollingInterval = null;
let msalInstance = null;

window.getCurrentPatients = () => patients;

const PROC_KEYWORDS = /(cysto|stent|turbt|litho|laser|surgery|bx|biopsy|procedure|or|scheduled|urology|pcn|urs|nephrectomy|robotic)/i;
const STATUS_COLORS = {
    'To-Do': { bg: 'bg-slate-100', text: 'text-slate-600', badge: '⬜' },
    'In-Progress': { bg: 'bg-blue-100', text: 'text-blue-700', badge: '🔵' },
    'Completed': { bg: 'bg-emerald-100', text: 'text-emerald-700', badge: '✅' },
    'Post-Op': { bg: 'bg-amber-100', text: 'text-amber-700', badge: '⭐' }
};

// US Federal Holidays (keep existing logic - lines 877-932 from original)
const US_HOLIDAYS = {
    '01-01': { name: 'New Year\'s Day', emoji: '🎉' },
    '07-04': { name: 'Independence Day', emoji: '🎆' },
    '11-11': { name: 'Veterans Day', emoji: '🎖️' },
    '12-25': { name: 'Christmas', emoji: '🎄' }
};

function getVariableHolidays(year) {
    const holidays = {};
    
    let mlkDay = new Date(year, 0, 1);
    while (mlkDay.getDay() !== 1) mlkDay.setDate(mlkDay.getDate() + 1);
    mlkDay.setDate(mlkDay.getDate() + 14);
    holidays[`${String(mlkDay.getMonth() + 1).padStart(2, '0')}-${String(mlkDay.getDate()).padStart(2, '0')}`] = { name: 'MLK Jr. Day', emoji: '✊' };
    
    let presDay = new Date(year, 1, 1);
    while (presDay.getDay() !== 1) presDay.setDate(presDay.getDate() + 1);
    presDay.setDate(presDay.getDate() + 14);
    holidays[`${String(presDay.getMonth() + 1).padStart(2, '0')}-${String(presDay.getDate()).padStart(2, '0')}`] = { name: 'Presidents\' Day', emoji: '🇺🇸' };
    
    let memDay = new Date(year, 4, 31);
    while (memDay.getDay() !== 1) memDay.setDate(memDay.getDate() - 1);
    holidays[`${String(memDay.getMonth() + 1).padStart(2, '0')}-${String(memDay.getDate()).padStart(2, '0')}`] = { name: 'Memorial Day', emoji: '🌹' };
    
    let laborDay = new Date(year, 8, 1);
    while (laborDay.getDay() !== 1) laborDay.setDate(laborDay.getDate() + 1);
    holidays[`${String(laborDay.getMonth() + 1).padStart(2, '0')}-${String(laborDay.getDate()).padStart(2, '0')}`] = { name: 'Labor Day', emoji: '🔧' };
    
    let thanksDay = new Date(year, 10, 1);
    while (thanksDay.getDay() !== 4) thanksDay.setDate(thanksDay.getDate() + 1);
    thanksDay.setDate(thanksDay.getDate() + 21);
    holidays[`${String(thanksDay.getMonth() + 1).padStart(2, '0')}-${String(thanksDay.getDate()).padStart(2, '0')}`] = { name: 'Thanksgiving', emoji: '🦃' };
    
    return holidays;
}

// ==================== MSAL AUTHENTICATION ====================

// MSAL Configuration (update with your tenant/client ID)
const msalConfig = {
    auth: {
        clientId: "YOUR_CLIENT_ID_HERE", // Replace with your Entra ID app client ID
        authority: "https://login.microsoftonline.com/YOUR_TENANT_ID_HERE", // Replace with your tenant ID
        redirectUri: window.location.origin
    },
    cache: {
        cacheLocation: "sessionStorage",
        storeAuthStateInCookie: false
    }
};

const loginRequest = {
    scopes: ["User.Read", "Files.ReadWrite", "Sites.ReadWrite.All"]
};

async function initializeAuth() {
    try {
        msalInstance = new msal.PublicClientApplication(msalConfig);
        await msalInstance.initialize();
        
        const accounts = msalInstance.getAllAccounts();
        
        if (accounts.length === 0) {
            // Not signed in, redirect to login
            await msalInstance.loginRedirect(loginRequest);
            return;
        }
        
        currentUser = accounts[0];
        
        // Get access token
        try {
            const response = await msalInstance.acquireTokenSilent({
                scopes: loginRequest.scopes,
                account: currentUser
            });
            accessToken = response.accessToken;
            
            // Extract roles from ID token
            currentUser.roles = response.idTokenClaims.roles || [];
            
            document.getElementById('status-text').innerText = 'Connected (Azure)';
            document.getElementById('status-detail').innerText = `Logged in as ${currentUser.username}`;
            isConnected = true;
            
            // Start polling
            startPolling();
            
            // Load initial data
            await loadAllData();
            
        } catch (error) {
            console.error("Token acquisition failed:", error);
            await msalInstance.acquireTokenRedirect(loginRequest);
        }
    } catch (error) {
        console.error("Auth initialization error:", error);
        document.getElementById('status-text').innerText = 'Auth Error';
        document.getElementById('status-detail').innerText = error.message;
    }
}

window.signOut = async () => {
    if (msalInstance) {
        await msalInstance.logoutRedirect();
    }
};

// ==================== API HELPER ====================

async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(endpoint, {
            ...options,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        if (response.status === 401) {
            // Token expired, refresh
            const tokenResponse = await msalInstance.acquireTokenSilent({
                scopes: loginRequest.scopes,
                account: currentUser
            });
            accessToken = tokenResponse.accessToken;
            
            // Retry request
            return await apiCall(endpoint, options);
        }
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `API error: ${response.status}`);
        }
        
        if (response.status === 204) return null;
        
        return await response.json();
    } catch (error) {
        console.error(`API call failed (${endpoint}):`, error);
        
        // Try offline mode
        if (!navigator.onLine) {
            loadFromCache();
        }
        
        throw error;
    }
}

// ==================== DATA LOADING ====================

async function loadAllData() {
    try {
        // Load patients
        const patientsData = await apiCall('/api/patients');
        patients = patientsData.patients;
        lastUpdatedMax = patientsData.lastUpdatedMax;
        
        // Load on-call schedule
        onCallSchedule = await apiCall('/api/onCallSchedule');
        
        // Load settings
        globalSettings = await apiCall('/api/settings');
        
        // Cache in localStorage
        saveToCache();
        
        renderUI();
        updateOnCallDashboard();
        
    } catch (error) {
        console.error("Data loading error:", error);
        // Try loading from cache
        loadFromCache();
    }
}

// ==================== POLLING WITH ETAG ====================

function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    
    // Poll every 15 seconds
    pollingInterval = setInterval(async () => {
        try {
            const patientsData = await apiCall('/api/patients');
            
            // Only update if data changed
            if (patientsData.lastUpdatedMax !== lastUpdatedMax) {
                patients = patientsData.patients;
                lastUpdatedMax = patientsData.lastUpdatedMax;
                saveToCache();
                renderUI();
            }
        } catch (error) {
            console.warn("Polling error:", error);
        }
    }, 15000);
}

// Refresh on window focus
window.addEventListener('focus', async () => {
    if (isConnected) {
        try {
            await loadAllData();
        } catch (error) {
            console.warn("Focus refresh error:", error);
        }
    }
});

// ==================== OFFLINE MODE (localStorage) ====================

function saveToCache() {
    try {
        localStorage.setItem('cached_patients', JSON.stringify(patients));
        localStorage.setItem('cached_oncall', JSON.stringify(onCallSchedule));
        localStorage.setItem('cached_settings', JSON.stringify(globalSettings));
        localStorage.setItem('cached_timestamp', Date.now().toString());
    } catch (error) {
        console.warn("Cache save error:", error);
    }
}

function loadFromCache() {
    try {
        const cachedPatients = localStorage.getItem('cached_patients');
        const cachedOnCall = localStorage.getItem('cached_oncall');
        const cachedSettings = localStorage.getItem('cached_settings');
        const cachedTimestamp = localStorage.getItem('cached_timestamp');
        
        if (cachedPatients) {
            patients = JSON.parse(cachedPatients);
            renderUI();
        }
        if (cachedOnCall) {
            onCallSchedule = JSON.parse(cachedOnCall);
            updateOnCallDashboard();
        }
        if (cachedSettings) {
            globalSettings = JSON.parse(cachedSettings);
        }
        
        if (cachedTimestamp) {
            const age = Math.floor((Date.now() - parseInt(cachedTimestamp)) / 1000 / 60);
            document.getElementById('status-detail').innerText = `Offline mode (cached ${age} min ago)`;
        }
        
        document.getElementById('status-text').innerText = 'Offline';
        isConnected = false;
    } catch (error) {
        console.error("Cache load error:", error);
    }
}

// Sync pending changes on reconnect
window.addEventListener('online', async () => {
    if (accessToken) {
        document.getElementById('status-text').innerText = 'Syncing...';
        try {
            await loadAllData();
            document.getElementById('status-text').innerText = 'Connected (Azure)';
            isConnected = true;
        } catch (error) {
            console.error("Reconnect sync error:", error);
        }
    }
});

// ==================== CRUD OPERATIONS ====================

window.savePatient = async (e) => {
    e.preventDefault();
    const codesInput = document.getElementById('f-findings-codes');
    const findingsCodes = codesInput.value ? codesInput.value.split(',').map(c => c.trim()).filter(c => c) : [];
    const valuesInput = document.getElementById('f-findings-values');
    const findingsValues = valuesInput.value ? JSON.parse(valuesInput.value) : {};
    
    const data = {
        room: document.getElementById('f-room').value,
        date: document.getElementById('f-date').value,
        name: document.getElementById('f-name').value,
        dob: document.getElementById('f-dob').value,
        mrn: document.getElementById('f-mrn').value,
        hospital: document.getElementById('f-hospital').value,
        findingsCodes: findingsCodes,
        findingsValues: findingsValues,
        findingsText: document.getElementById('f-findings-text').value,
        plan: document.getElementById('f-plan').value,
        supervisingMd: document.getElementById('f-md').value,
        pending: document.getElementById('f-pending').value,
        followUp: document.getElementById('f-fu').value,
        priority: document.getElementById('f-priority').checked,
        procedureStatus: document.getElementById('f-proc-status').value,
        cptPrimary: document.getElementById('f-cpt-primary').value,
        icdPrimary: document.getElementById('f-icd-primary').value,
        chargeCodesSecondary: document.getElementById('f-charge-codes-secondary').value,
        archived: false
    };
    
    try {
        const editId = document.getElementById('edit-id').value;
        
        if (!isConnected) {
            // Local mode: store in memory and cache
            if (editId) {
                const index = patients.findIndex(p => p.id === editId);
                if (index !== -1) {
                    patients[index] = { ...data, id: editId, lastUpdated: new Date().toISOString() };
                }
            } else {
                const newId = 'local-' + Date.now();
                patients.push({ ...data, id: newId, lastUpdated: new Date().toISOString() });
            }
            saveToCache();
            renderUI();
            window.closeModal();
            showToast("✓ Saved (Local)");
            return false;
        }
        
        if (editId) {
            await apiCall(`/api/patients/${editId}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
        } else {
            await apiCall('/api/patients', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        }
        
        await loadAllData(); // Refresh
        window.closeModal();
        showToast("✓ Saved");
    } catch (err) {
        console.error("Save error:", err);
        if (err.message.includes('already rounded')) {
            showToast("⚠️ Duplicate: " + err.message);
        } else {
            showToast("❌ Error: " + err.message);
        }
    }
    return false;
};

window.toggleArchive = async (id, shouldArchive) => {
    if (!isConnected) {
        const p = patients.find(x => x.id === id);
        if (p) {
            p.archived = shouldArchive;
            saveToCache();
            renderUI();
            showToast(shouldArchive ? "Archived" : "Restored");
        }
        return;
    }
    
    try {
        const patient = patients.find(p => p.id === id);
        if (patient) {
            patient.archived = shouldArchive;
            await apiCall(`/api/patients/${id}`, {
                method: 'PUT',
                body: JSON.stringify(patient)
            });
            await loadAllData();
            showToast(shouldArchive ? "Archived" : "Restored");
        }
    } catch (err) {
        console.error("Archive error:", err);
        showToast("❌ Error");
    }
};

window.updateStatusQuick = async (id, newStatus) => {
    if (!isConnected) {
        const p = patients.find(x => x.id === id);
        if (p) {
            p.procedureStatus = newStatus;
            saveToCache();
            renderUI();
        }
        return;
    }
    
    try {
        const patient = patients.find(p => p.id === id);
        if (patient) {
            patient.procedureStatus = newStatus;
            await apiCall(`/api/patients/${id}`, {
                method: 'PUT',
                body: JSON.stringify(patient)
            });
            await loadAllData();
        }
    } catch (err) {
        console.error("Status update error:", err);
    }
};

window.deletePatient = async (id) => {
    if (!confirm('Permanently delete this patient record? This cannot be undone.')) return;
    
    if (!isConnected) {
        patients = patients.filter(p => p.id !== id);
        saveToCache();
        renderUI();
        showToast("Deleted (Local)");
        return;
    }
    
    try {
        await apiCall(`/api/patients/${id}`, { method: 'DELETE' });
        await loadAllData();
        showToast("✓ Deleted");
    } catch (err) {
        console.error("Delete error:", err);
        showToast("❌ Error: " + err.message);
    }
};

// ==================== BACKFEED LOGIC ====================

window.copyPreviousVisit = async () => {
    const mrn = document.getElementById('f-mrn').value;
    if (!mrn) {
        showToast("⚠️ Enter MRN first");
        return;
    }
    
    try {
        const backfeedData = await apiCall(`/api/patients/backfeed?mrn=${mrn}`);
        
        // Prefill all fields except date, findings, pending, followUp
        document.getElementById('f-room').value = backfeedData.room || '';
        document.getElementById('f-name').value = backfeedData.name || '';
        document.getElementById('f-dob').value = backfeedData.dob || '';
        document.getElementById('f-hospital').value = backfeedData.hospital || '';
        document.getElementById('f-plan').value = backfeedData.plan || '';
        document.getElementById('f-md').value = backfeedData.supervisingMd || '';
        document.getElementById('f-priority').checked = backfeedData.priority || false;
        document.getElementById('f-proc-status').value = backfeedData.procedureStatus || 'To-Do';
        document.getElementById('f-cpt-primary').value = backfeedData.cptPrimary || '';
        document.getElementById('f-icd-primary').value = backfeedData.icdPrimary || '';
        document.getElementById('f-charge-codes-secondary').value = backfeedData.chargeCodesSecondary || '';
        
        showToast(`✓ Copied from visit on ${backfeedData.lastVisitDate}`);
    } catch (error) {
        console.error("Backfeed error:", error);
        showToast("⚠️ No previous visits found");
    }
};

// Initialize on page load
initializeAuth();
