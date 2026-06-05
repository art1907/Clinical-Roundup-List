# Debugging Guide: Authentication & Connection Status Fix

## Changes Made

### 1. ✅ Added Comprehensive Logging to m365-integration.js

**What was fixed:**
- Added console logging at every critical point in the authentication flow
- Added logging before/after updateConnectionStatus() calls
- Added logging before/after DOM element updates
- Added safe wrapper for showToast() calls that checks availability first

**Key additions:**
```javascript
console.log('🔐 User authenticated:', currentAccount.username);
console.log('📍 Calling updateConnectionStatus(true, ...)');
console.log('✩ Element #connection-status-bar:', statusBar ? 'found' : 'NOT FOUND');
```

**Files affected:**
- `m365-integration.js` lines 191-290 (handleSuccessfulLogin)
- `m365-integration.js` lines 206-244 (updateConnectionStatus)
- `m365-integration.js` lines 100-125 (error handling)

### 2. ✅ Added Comprehensive Logging to clinical-rounding-adaptive.html

**What was fixed:**
- Added console logging to window load event handler
- Added logging to updateAuthState callback
- Added logging to toggleAuthUIElements
- Added logging to all data update callbacks

**Key additions:**
```javascript
console.group('🔧 HTML Initialization (window load event)');
console.log('📋 Config validation:', { hasValidClientId, hasValidSiteId, useM365 });
console.log('✅ MSAL initialized');
console.group('🔐 updateAuthState called');
console.log('📍 State updated:', { isAuthenticated, currentUser, isConnected, useM365 });
```

**Files affected:**
- `clinical-rounding-adaptive.html` lines 1240-1310 (window load handler)
- `clinical-rounding-adaptive.html` lines 1315-1367 (updateAuthState callback)
- `clinical-rounding-adaptive.html` lines 1369-1409 (toggleAuthUIElements)

### 3. ✅ Fixed showToast() Undefined Error

**What was fixed:**
- showToast() was being called in m365-integration.js but was not defined there
- Added safe wrapper that checks if window.showToast exists before calling
- Falls back to console.error if showToast is unavailable

**Code change:**
```javascript
// OLD (would fail silently if showToast was undefined):
showToast('Authentication error: ' + err.message);

// NEW (safe wrapper):
if (typeof window.showToast === 'function') {
    window.showToast('Authentication error: ' + err.message);
} else {
    console.error('showToast not available, error:', err.message);
}
```

### 4. ✅ Exported updateConnectionStatus to window

**What was fixed:**
- updateConnectionStatus() was a local function but was being called from handleSuccessfulLogin()
- Now exported to window as m365UpdateConnectionStatus for external access if needed

**Files affected:**
- `m365-integration.js` line 790 (added window.m365UpdateConnectionStatus export)

### 5. ✅ Added Explicit Error Handling for DOM Elements

**What was fixed:**
- updateConnectionStatus() was silently failing if DOM elements didn't exist
- Now logs a warning if element cannot be found
- Added element existence check logging

**Code change:**
```javascript
// NEW: Checks and logs before updating
if (!statusText) console.warn('⚠️ Element not found: #status-text');
if (statusText) {
    statusText.className = '...';
    statusText.innerText = 'Connected (M365)';
    console.log('✅ Updated statusText to "Connected (M365)"');
}
```

## How to Verify the Fix

### Step 1: Open Browser Console

1. Open the app in your browser
2. Press **F12** (or **Cmd+Option+I** on Mac) to open Developer Tools
3. Go to **Console** tab
4. You should see the diagnostic output

### Step 2: Check Initialization

Look for this output on page load:

```
🔧 HTML Initialization (window load event)
⏱️ Timestamp: 2026-02-07T12:34:56.789Z
📡 Callback check:
   updateAuthState: function
   showToast: function
   m365Login: function
✅ M365_CONFIG found
📋 Config details:
   clientId: 2030acb...
   authority: https://lo...
   siteId: bf8b131...
🔍 M365 Config Validation:
   hasValidClientId: true
   hasValidSiteId: true
   useM365: true
🚀 M365 config valid - initializing MSAL...
✅ MSAL initialized
✅ Auth UI toggled and login prompt shown
```

**If you see:**
- ❌ instead of ✅: There's an error in that step
- `false` for hasValidClientId/hasValidSiteId: Check your config values
- `m365Login: undefined`: m365-integration.js didn't load properly

### Step 3: Watch Authentication Flow

Click "Sign In with Microsoft 365" button and watch the console:

**You should see (if successful):**
```
📍 Callback check:
   m365Login: function
🔐 User authenticated: user@company.com
🔄 updateConnectionStatus called: { connected: true, username: "user@company.com" }
🔍 Element found: { connection-status: true, status-indicator: true, status-text: true, status-detail: true }
🟢 Updated connection-status element
✅ Updated statusBar to Connected (green)
✅ Updated statusText to "Connected (M365)"
✅ Updated statusDetail to: user@company.com
✅ updateConnectionStatus complete
🔐 updateAuthState called
   authenticated: true
   username: user@company.com
📍 State updated:
   isAuthenticated: true
   currentUser: user@company.com
   isConnected: true
   useM365: true
✅ toggleAuthUIElements succeeded
✅ User authenticated - rendering UI
```

**If you see errors instead:**

```
⚠️ Element not found: #status-text
⚠️ Element not found: #status-indicator
```
→ The HTML elements don't exist or were deleted. Restore from backup.

```
❌ M365 Initialization Error: ...
📍 Stack: ...
```
→ MSAL initialization failed. Check browser console for full error.

```
showToast not available for error display
```
→ The showToast function wasn't loaded. Check that clinical-rounding-adaptive.html is loading before m365-integration.js.

### Step 4: Verify UI State After Login

After successful login, check:

1. **Connection Status Bar** should show:
   - Green indicator (🟢)
   - Text: "Connected (M365)"
   - Detail: Your email address

2. **"Add Record" Form** should show:
   - "Created By" field filled with your M365 username
   - NOT showing "Local User"

3. **Console** should show:
   ```
   📊 updatePatientsFromM365 called with X patients
   📅 updateOnCallFromM365 called with Y on-call shifts
   ⚙️ updateSettingsFromM365 called: {...}
   ```

## Common Issues & Solutions

### Issue 1: Still Shows "Local Mode" After Login

**Check in console:**
1. `console.log(window.m365Login)` → Should be `ƒ login()`
2. `console.log(typeof window.updateAuthState)` → Should be `function`
3. `console.log(document.getElementById('status-indicator'))` → Should exist

**If m365-integration.js didn't load:**
- Check browser Network tab (F12 → Network)
- Look for `m365-integration.js` file
- Should show status 200 (loaded successfully)
- If 404 or failed: Check file path

### Issue 2: "Created By" Still Shows "Local User"

This happens when:
1. `isAuthenticated` is false (user didn't login)
2. `currentUser` is null/empty
3. `window.m365GetCurrentUser()` returns null

**Check:**
```javascript
// In console:
console.log(isAuthenticated);         // Should be true
console.log(currentUser);              // Should be email
console.log(window.m365GetCurrentUser()); // Should be email
```

### Issue 3: Connection Status Shows Orange/Amber

This is expected **before** login. After login, should turn green.

**Check:** Has updateAuthState been called?
```javascript
// In console (after login):
console.log(isAuthenticated, isConnected, currentUser);
// Should show: true, true, "email@company.com"
```

### Issue 4: Errors About "showToast is not defined"

**Fixed by:** The new safe wrapper that checks `typeof window.showToast === 'function'`

**Verify it's working:**
- Look for `showToast not available for error display` message in console
- Should not crash the app (error is caught)

## Testing Checklist

- [ ] Open app in fresh browser tab
- [ ] See initialization logs (yellow/blue messages in console)
- [ ] Click "Sign In with Microsoft 365"
- [ ] Complete Microsoft login in popup
- [ ] Browser redirects back to app
- [ ] See authentication flow logs in console
- [ ] Connection status bar turns GREEN
- [ ] Connection status bar shows "Connected (M365)"
- [ ] Connection status bar shows your email
- [ ] "Add Record" form shows your M365 username (not "Local User")
- [ ] Patient data loads and displays
- [ ] No error messages in console (except old ones from page load)

## If Still Having Issues

Please provide:
1. **Browser**: Chrome, Firefox, Safari, Edge?
2. **Device**: Desktop, mobile, tablet?
3. **Console output**: Copy-paste everything from the console
4. **Network tab**: Check if m365-integration.js loaded (Network tab in DevTools)
5. **M365 config**: Are clientId and siteId set to real values (not placeholders)?

---

## Technical Details: What Gets Logged

### Initialization Phase
- M365_CONFIG validation
- Function registration
- MSAL setup
- Auth UI toggle

### Authentication Phase
- Redirect promise handling
- Account setup
- Connection status update
- UI state change

### Data Sync Phase
- Patient data fetch
- On-call schedule fetch
- Settings fetch
- UI render

### Error Phase
- Error type and code
- Stack trace
- Element availability
- Callback availability

All logs include timestamps and status indicators (✅, ❌, ⚠️, 📍, 🔐, etc.) for easy scanning.

