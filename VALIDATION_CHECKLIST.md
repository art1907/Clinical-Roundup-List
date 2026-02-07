# Configuration Validation Checklist - February 7, 2026

## ✅ Your Current M365_CONFIG Values

Based on `m365-integration.js` lines 16-59:

```javascript
clientId: '2030acbd-8796-420d-8990-acdf468227a6'
tenantId: 'd4402872-0ebc-4758-9c54-71923320c29d' (from authority URL)
redirectUri: Uses window.location (dynamic - gets current page URL)
siteId: 'bf8b1313-2fb7-4a22-8775-1f0acd899909'
scopes: ['Sites.ReadWrite.All', 'Files.ReadWrite', 'User.Read']
```

## ✅ What You've Already Verified (Per Your Screenshots)

1. **Azure App Registration:**
   - ✅ Redirect URIs registered:
     - `https://art1907.github.io/Clinical-Roundup-List/clinical-rounding-adaptive.html`
     - `https://art1907.github.io/Clinical-Roundup-List/`
     - `http://localhost:3000/clinical-rounding-adaptive.html`
   
2. **API Permissions:**
   - ✅ Sites.ReadWrite.All (delegated, consented)
   - ✅ Files.ReadWrite.All (delegated, consented)
   - ✅ User.Read (delegated, consented)

3. **GitHub Pages:**
   - ✅ Live at `https://art1907.github.io/Clinical-Roundup-List/`

## 🔍 Final Verification Steps

### Step 1: Match Azure Config to Code (2 minutes)

Open **Azure Portal** → Your app registration and confirm:

**clientId Match:**
```javascript
// In m365-integration.js line 19:
clientId: '2030acbd-8796-420d-8990-acdf468227a6'

// Should match Azure Portal → Overview → Application (client) ID
✓ Verify first 8 characters: 2030acbd
```

**tenantId Match:**
```javascript
// In m365-integration.js line 20:
authority: 'https://login.microsoftonline.com/d4402872-0ebc-4758-9c54-71923320c29d'

// Should match Azure Portal → Overview → Directory (tenant) ID  
✓ Verify first 8 characters: d4402872
```

### Step 2: Verify SharePoint Site ID (3 minutes)

Your siteId in code: `bf8b1313-2fb7-4a22-8775-1f0acd899909`

**To verify this is correct:**

Option A - Use Graph Explorer:
1. Go to https://developer.microsoft.com/en-us/graph/graph-explorer
2. Sign in with your M365 account
3. Run: `GET https://graph.microsoft.com/v1.0/sites?search=Clinical`
4. Find your site in results, compare the `id` field

Option B - Run in browser console after login:
```javascript
// After successful M365 login, paste this in console:
fetch('https://graph.microsoft.com/v1.0/sites?search=Clinical', {
    headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('accessToken') }
})
.then(r => r.json())
.then(d => console.log('Sites found:', d.value.map(s => ({ name: s.displayName, id: s.id }))));
```

### Step 3: Verify SharePoint List IDs (3 minutes)

Your list IDs in code:
- patients: `c475a404-97fa-44b1-8cca-7dfaec391049`
- onCallSchedule: `7e99100a-aeb4-4fe6-9fb0-3f8188904174`
- settings: `57fbe18d-6fa3-4fff-bc39-5937001e1a0b`
- auditLogs: `36a95571-80dd-4ceb-94d3-36db0be54eae`

**To verify these exist:**

Go to your SharePoint site and check if you have lists named:
- "Patients" (or "Clinical Rounding Patients")
- "OnCallSchedule" 
- "Settings"
- "AuditLogs"

**If lists are missing:** You need to create them first (see INSTALLATION_GUIDE.md Step 3)

**To get correct list IDs:**
```javascript
// In browser console after login, run:
const siteId = 'bf8b1313-2fb7-4a22-8775-1f0acd899909';
fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/lists`, {
    headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('accessToken') }
})
.then(r => r.json())
.then(d => console.log('Lists:', d.value.map(l => ({ name: l.displayName, id: l.id }))));
```

## 🧪 Test Login Flow (5 minutes)

### Test 1: GitHub Pages (Production)

1. **Navigate to EXACT URL:**
   ```
   https://art1907.github.io/Clinical-Roundup-List/clinical-rounding-adaptive.html
   ```
   ⚠️ **Critical:** Use the FULL PATH including `.html` extension

2. **Open Console** (F12)

3. **Expected Console Output (Before Login):**
   ```
   🔧 HTML Initialization (window load event)
   ✅ M365_CONFIG found
   📋 Config details: { clientId: '2030acb...', ... }
   🔍 M365 Config Validation:
      hasValidClientId: true
      hasValidSiteId: true
      useM365: true
   🚀 M365 config valid - initializing MSAL...
   ✅ MSAL initialized
   ```

4. **Click "Sign In with Microsoft 365"**

5. **Complete Microsoft login**

6. **Expected Console Output (After Redirect):**
   ```
   🎯 User authenticated: your.email@company.com
   🔄 Calling updateConnectionStatus(true, ...)...
   ✓ Updated statusBar to Connected (green)
   ✓ Updated statusText to "Connected (M365)"
   ✓ Updated statusDetail to: your.email@company.com
   ✅ updateConnectionStatus complete
   🔐 updateAuthState called
      authenticated: true
      username: your.email@company.com
   📍 State updated:
      isAuthenticated: true
      currentUser: your.email@company.com
      isConnected: true
      useM365: true
   ✅ User authenticated - rendering UI
   ```

7. **Verify UI:**
   - Status bar should be **GREEN** 🟢
   - Text should say **"Connected (M365)"**
   - Should show **your email address**
   - "Add Record" form should show **your email** (not "Local User")

### Test 2: Localhost (Development)

1. **Start local server:**
   ```powershell
   cd "d:\Code\Clinical Roundup File"
   python -m http.server 3000
   ```

2. **Navigate to:**
   ```
   http://localhost:3000/clinical-rounding-adaptive.html
   ```

3. **Repeat steps 2-7 from Test 1**

## 🚨 Common Issues & Quick Fixes

### Issue 1: Console Shows "hasValidClientId: false" or "hasValidSiteId: false"

**Cause:** M365_CONFIG has placeholder values

**Check:**
```javascript
// In m365-integration.js around line 20-45:
// Should NOT be:
clientId: 'YOUR_CLIENT_ID_HERE'  // ❌ Placeholder
siteId: 'YOUR_SITE_ID_HERE'      // ❌ Placeholder

// Should BE:
clientId: '2030acbd-8796-420d-8990-acdf468227a6'  // ✅ Real value
siteId: 'bf8b1313-2fb7-4a22-8775-1f0acd899909'    // ✅ Real value
```

**Your config:** ✅ Already has real values

---

### Issue 2: Console Shows "useM365: false" → Stays in Local Mode

**Possible causes:**
1. clientId or siteId is still a placeholder
2. M365_CONFIG not loaded (m365-integration.js didn't load)

**Debug:**
```javascript
// Paste in console:
console.log({
    configExists: typeof M365_CONFIG !== 'undefined',
    clientId: M365_CONFIG?.auth?.clientId,
    siteId: M365_CONFIG?.sharepoint?.siteId
});
```

---

### Issue 3: Redirect URI Mismatch Error

**Error in console:**
```
MSAL error: redirect_uri_mismatch
```

**Cause:** URL you opened doesn't match any registered redirect URI

**Fix:**
1. Check URL bar - are you at the EXACT registered URL?
2. Azure Portal → App Registration → Authentication → Compare URIs

**Your registered URIs:**
- ✅ `https://art1907.github.io/Clinical-Roundup-List/clinical-rounding-adaptive.html`
- ✅ `http://localhost:3000/clinical-rounding-adaptive.html`

**Make sure you're NOT at:**
- ❌ `https://art1907.github.io/Clinical-Roundup-List/` (missing file)
- ❌ `http://localhost:3000/` (missing path)
- ❌ Any cached file or different path

---

### Issue 4: Graph API Returns 404 on SharePoint Lists

**Error in console:**
```
Graph API error: 404 - List not found
```

**Cause:** SharePoint lists don't exist yet OR siteId/listId is wrong

**Fix:**
1. Verify lists exist in SharePoint (browse to your site)
2. If missing, create them (see INSTALLATION_GUIDE.md Step 3)
3. If exist, get correct IDs using Graph Explorer or console fetch command above

---

### Issue 5: "State Not Found" Error Loop

**Error in console:**
```
MSAL redirect error: state_not_found
```

**Cause:** Browser cached old auth state or query params from failed attempt

**Fix:**
1. Clear browser cache (Ctrl+Shift+Delete → Cached images and files)
2. Close all browser tabs
3. Reopen the app
4. Try login again

**Your config already has:** The fix for this (lines 100-119 in m365-integration.js)

## 📊 Success Criteria

After login completes, verify ALL of these:

- [ ] Console shows `useM365: true`
- [ ] Console shows `isAuthenticated: true`
- [ ] Console shows `isConnected: true`
- [ ] Console shows your email address
- [ ] Status bar is GREEN (not amber/orange)
- [ ] Status bar text: "Connected (M365)"
- [ ] Status bar shows your email
- [ ] No red errors in console
- [ ] "Add Record" form shows your email (not "Local User")
- [ ] Patient data loads (if any exists)

## 🎯 Quick Debug Command

After attempting login, paste this in console:

```javascript
console.group('🔍 Login Status Check');
console.log('1. Config loaded:', typeof M365_CONFIG !== 'undefined' ? '✅' : '❌');
console.log('2. M365 mode enabled:', useM365 ? '✅' : '❌');
console.log('3. Authenticated:', isAuthenticated ? '✅' : '❌');
console.log('4. Connected:', isConnected ? '✅' : '❌');
console.log('5. Current user:', currentUser || '❌ NOT SET');
console.log('6. Status bar element:', document.getElementById('status-text')?.innerText || '❌ NOT FOUND');
console.log('7. M365 login available:', typeof window.m365Login === 'function' ? '✅' : '❌');
console.log('8. MSAL account:', typeof msalInstance !== 'undefined' && msalInstance?.getAllAccounts?.()?.[0]?.username || '❌ NO ACCOUNT');
console.groupEnd();
```

**Expected ALL checkmarks (✅):**
- If you see any ❌, that's where the issue is
- Share the output with support for targeted help

## 📝 Next Steps After Validation

1. **If all checks pass:** You're fully configured! ✅
   - Login should work
   - Data should sync with SharePoint
   - Status should show green

2. **If login fails but config is correct:**
   - Check SharePoint permissions (do you have access to the site?)
   - Verify consent was granted for all 3 API permissions
   - Try clearing browser cache and re-consenting

3. **If you get 404 errors on data fetch:**
   - Lists might not exist yet
   - Create them following INSTALLATION_GUIDE.md Step 3
   - Or use existing lists and update the list IDs in m365-integration.js

---

## 🔗 Related Docs

- **Complete setup:** INSTALLATION_GUIDE.md
- **Troubleshooting:** DEBUG_GUIDE.md  
- **Architecture:** AGENTS.md, M365_MIGRATION.md
- **Quick reference:** QUICK_REFERENCE.md

**Status:** Your configuration looks complete - ready to test! 🚀
