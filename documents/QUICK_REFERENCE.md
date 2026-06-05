# 🗺️ HTML Integration - Quick Reference Guide

## 📍 Where Everything Is

```
clinical-rounding-adaptive.html
├─ Line 854-876     ← M365_CONFIG (fill these in!)
├─ Line 881         ← <script src="m365-integration.js">
├─ Line 896-913     ← M365 initialization & callbacks
├─ Line 1118-1128   ← Callback functions
└─ Line 1133-1235   ← Updated CRUD functions
                       • savePatient()
                       • toggleArchive()
                       • updateStatusQuick()
                       • deletePatient()

m365-integration.js  ← All M365 functions (don't need to edit!)
├─ M365_CONFIG setup
├─ MSAL authentication
├─ Graph API calls
├─ SharePoint operations
├─ Polling & caching
└─ CSV import

INSTALLATION_GUIDE.md ← Follow this to set up M365
├─ Step 1: Entra ID app registration (15 min)
├─ Step 2: Create SharePoint Lists (20 min)
├─ Step 3: Update HTML config (10 min)
└─ Step 4: Test (5 min)
```

---

## 🎯 The Three Modes

### 1️⃣ Local Mode (Default) ✨
```
App loads
   ↓
M365_CONFIG = placeholder values?
   ↓
YES → useM365 = false
   ↓
Run in Local Mode (all features work, data in memory)
```

**When to use**: Development, testing, demos  
**Setup time**: 0 minutes  
**Data**: Lives in browser only  

### 2️⃣ M365 Mode (Production) 🏢
```
App loads
   ↓
M365_CONFIG = real values?
   ↓
YES → useM365 = true
   ↓
MSAL login → Graph API → SharePoint
   ↓
Data syncs every 15 seconds
```

**When to use**: Production, multi-user teams, data persistence  
**Setup time**: 1-2 hours (mostly Azure/SharePoint UI clicks)  
**Data**: Lives in SharePoint, synced across devices  

### 3️⃣ Offline Mode (Automatic) 📴
```
User offline or M365 error?
   ↓
App uses localStorage cache
   ↓
Works offline!
   ↓
When online again → automatic sync
```

**When to use**: Works automatically, no action needed  
**Setup time**: 0 minutes  
**Data**: Synced when connection restored  

---

## 🔄 Data Flow Diagrams

### Local Mode Flow
```
Form Input
   ↓
savePatient() called
   ↓
isConnected = false?
   ↓
YES → Update patients[] array
   ↓
renderUI()
   ↓
Patient appears in table
```

### M365 Mode Flow
```
Form Input
   ↓
savePatient() called
   ↓
isConnected = true?
   ↓
YES → window.m365SavePatient(data)
   ↓
MSAL token → Graph API → SharePoint
   ↓
Polling detects change
   ↓
updatePatientsFromM365() callback
   ↓
renderUI()
   ↓
Patient appears in table
```

---

## 🛠️ Configuration Checklist

### ✅ Before First Use (Local Mode)
- [ ] Open `clinical-rounding-adaptive.html` in browser
- [ ] Test adding a patient
- [ ] Test editing a patient
- [ ] Test CSV import
- [ ] All features work? ✓

### ⚙️ Before M365 Setup (Takes 1-2 hours)

**Step 1: Entra ID App Registration** (15 min)
```
1. Go to Azure Portal: https://portal.azure.com
2. Navigate to App Registrations
3. Click "+ New Registration"
4. Name: "Clinical Rounding Platform"
5. Supported account types: "Accounts in this organizational directory only"
6. Redirect URI: http://localhost:3000 (for local testing)
7. Click Register
8. Copy: Client ID, Tenant ID
```

**Step 2: Create SharePoint Lists** (20 min)
```
1. Go to SharePoint site
2. Create 4 lists:
   ✓ Patients (19 columns)
   ✓ OnCallSchedule (3 columns)
   ✓ Settings (3 columns)
   ✓ AuditLogs (6 columns)
3. For each list, get: List ID
4. Copy: Site ID
```

**Step 3: Update HTML Config** (10 min)
```javascript
// Find in clinical-rounding-adaptive.html (line ~860)
const M365_CONFIG = {
    clientId: 'PASTE_CLIENT_ID',              // From Step 1
    tenantId: 'PASTE_TENANT_ID',              // From Step 1
    siteId: 'PASTE_SITE_ID',                  // From Step 2
    lists: {
        patients: 'PASTE_PATIENTS_ID',        // From Step 2
        onCallSchedule: 'PASTE_ONCALL_ID',    // From Step 2
        settings: 'PASTE_SETTINGS_ID',        // From Step 2
        auditLogs: 'PASTE_AUDIT_ID'           // From Step 2
    },
    redirectUri: window.location.origin + window.location.pathname
};
```

**Step 4: Test M365 Mode** (5 min)
```
1. Reload HTML page
2. Click Login button
3. Login with M365 account
4. Add record → appears in table
5. Check SharePoint List → patient there? ✓
```

---

## 🧠 How the App Decides What to Do

```javascript
// This happens automatically when page loads:

if (M365_CONFIG.clientId !== 'YOUR_CLIENT_ID_HERE') {
    // Config is filled in → Try M365 mode
    useM365 = true;
    initializeMSAL(); // Start MSAL login flow
} else {
    // Config has placeholder values → Stay in Local Mode
    useM365 = false;
    console.log("M365 config not configured - running in Local Mode");
}

// When user saves a patient:

if (!isConnected || !useM365) {
    // Local mode: save to memory
    patients.push(data);
} else {
    // M365 mode: save to SharePoint
    await window.m365SavePatient(data);
}
```

---

## 📊 Feature Matrix

| Feature | Local Mode | M365 Mode |
|---------|-----------|----------|
| Add record | ✅ | ✅ |
| Edit patient | ✅ | ✅ |
| Delete patient | ✅ | ✅ |
| Archive patient | ✅ | ✅ |
| Change visit status | ✅ | ✅ |
| CSV import | ✅ | ✅ |
| Excel export | ✅ | ✅ |
| Offline work | ✅ | ✅ |
| Cloud sync | ❌ | ✅ |
| Multi-user | ❌ | ✅ |
| Data persistence | Session only | Permanent |
| Access control | None | Entra ID |
| Audit logs | None | SharePoint |

---

## 🔍 Troubleshooting Decision Tree

```
Issue: App not working
│
├─ In Local Mode?
│  ├─ YES → Check browser console (F12)
│  │   └─ Read HTML_INTEGRATION_CHANGES.md
│  └─ NO → Go to next
│
├─ Login button missing?
│  ├─ Check M365_CONFIG values (not placeholder?)
│  ├─ Check m365-integration.js loaded (F12 → Network)
│  └─ Read INSTALLATION_GUIDE.md Step 3
│
├─ Data not syncing?
│  ├─ Check SharePoint Lists exist
│  ├─ Check polling happening (F12 → Network, look for /sites/{siteId})
│  └─ Check M365_CONFIG list IDs are correct
│
└─ Still broken?
   ├─ Screenshot + browser console error
   ├─ Check INSTALLATION_GUIDE.md Troubleshooting section
   └─ Review AGENTS.md for architecture context
```

---

## 🎬 Quick Start (Choose One)

### Option A: Test Immediately (5 min)
```bash
cd "d:\Code\Clinical Roundup File"
python -m http.server 3000
# Open: http://localhost:3000/clinical-rounding-adaptive.html
# Try: Add a patient → See it appear
```

### Option B: Set Up M365 (1-2 hours)
```bash
# Follow INSTALLATION_GUIDE.md completely
# Then update M365_CONFIG in HTML
# Then test M365 Mode
```

### Option C: Read First (30 min)
```
Start here:
1. This file (Quick Reference)
2. INTEGRATION_READY.md (Executive Summary)
3. HTML_INTEGRATION_CHANGES.md (Technical Details)
4. INSTALLATION_GUIDE.md (Setup Steps)
```

---

## 📝 Code Snippets Reference

### Check Connection Status
```javascript
if (isConnected && useM365) {
    console.log("Connected to M365!");
} else if (isConnected && !useM365) {
    console.log("In Local Mode");
}
```

### Force Refetch Data
```javascript
// From console
await window.m365FetchPatients();
```

### Check M365 Config
```javascript
console.log(M365_CONFIG);
// If values are placeholder → Local Mode
// If values are real → M365 Mode
```

### View Cached Data
```javascript
// From console
JSON.parse(localStorage.getItem('m365_cache_patients'));
```

---

## ⚡ Performance Notes

| Operation | Local Mode | M365 Mode |
|-----------|-----------|----------|
| Save patient | Instant | ~500ms (API) |
| Load patients | Instant | ~2sec (1st load) + 15sec polling |
| Offline support | ✅ Always | ✅ Via localStorage |
| Sync latency | N/A | ~15 seconds |

---

## 🔐 Security Checklist

### Before Production (M365 Mode)
- [ ] Change redirect URI from localhost to production URL
- [ ] Enable MFA in Entra ID
- [ ] Set up conditional access policies
- [ ] Enable audit logging in SharePoint
- [ ] Review DLP rules
- [ ] Set retention policies

### Local Development (Local Mode)
- [ ] Don't commit real M365 credentials to Git
- [ ] Use placeholder values in source control
- [ ] Keep M365_CONFIG as template in comments

---

## 📚 Document Navigator

```
Want to...                          Read this...
─────────────────────────────────────────────────────
Get started quickly                 This file (QUICK_REFERENCE.md)
Set up M365 (step by step)          INSTALLATION_GUIDE.md
Understand what changed             HTML_INTEGRATION_CHANGES.md
See code snippets                   HTML_INTEGRATION_COMPLETE.md
Deploy to production                INTEGRATION_READY.md
Learn architecture                  AGENTS.md or M365_MIGRATION.md
Understand compliance               copilot-instructions.md
```

---

## 🎯 Success Indicators

### ✅ Local Mode Working
- [ ] Page loads without errors
- [ ] Can see patient form
- [ ] Can add record → appears in table
- [ ] Can edit patient → updates
- [ ] Browser close/reopen → data persists

### ✅ M365 Mode Working
- [ ] Page shows "Connected (M365)"
- [ ] Can login
- [ ] Can add record → appears in table
- [ ] SharePoint List has patient record
- [ ] Other device sees data in 15 seconds

### ✅ Ready for Production
- [ ] All above tests pass
- [ ] No console errors
- [ ] Handles offline gracefully
- [ ] Data backed up
- [ ] Team trained

---

**TL;DR**: 
- 🟢 App works in Local Mode **right now** (no setup)
- 🟡 Can optionally set up M365 for cloud sync (1-2 hours)
- 🔵 Choose your mode and start using!

**Next Step**: Pick an option above and go! 🚀
