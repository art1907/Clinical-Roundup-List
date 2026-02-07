# Authentication & Connection Status Audit - February 7, 2026

## Problem Summary
User successfully logs in but:
1. Connection status bar still shows "Local Mode" (amber indicator) instead of "Connected (M365)" (green)
2. "Add Record" form shows "Local User" instead of authenticated M365 username
3. Says "database not connected" (referring to connection status bar showing "No persistence")

## Root Cause Analysis

### Issue 1: Silent Error in handleRedirectPromise()
**Location**: `m365-integration.js` lines 73-108

**Problem**: When `handleRedirectPromise()` completes after redirect from Microsoft login, it calls:
- `handleSuccessfulLogin()` → calls `updateConnectionStatus(true, username)`
- BUT: If any error occurs in `updateConnectionStatus()` or if DOM elements don't exist, the error is caught but the rest of the function continues silently

**Evidence**: 
- Line 207-211: `updateConnectionStatus()` tries to find `connection-status` element
- If element missing (timing issue), update silently fails
- No console.log before/after element updates = errors go unnoticed

### Issue 2: Timing Issue Between Script Registration and Element Queries
**Location**: `m365-integration.js` lines 770-800 and HTML window load event

**Problem**:
1. `m365-integration.js` attaches `m365GetCurrentUser` to `window` in its DOMContentLoaded (line 774)
2. HTML file's window 'load' event calls `initializeMSAL()` (line 1241)
3. When user logs in and redirects back, `handleRedirectPromise()` is resolved
4. It tries to call `updateConnectionStatus()` which queries for elements by ID
5. BUT: The `connection-status-bar` element exists in HTML, but `updateConnectionStatus()` cannot find it

**Why?**: Looking at line 1336:
```javascript
const statusBar = document.getElementById('connection-status-bar');
```

The element DOES exist (line 2380 in HTML), but there's a deeper issue...

### Issue 3: updateConnectionStatus() Not Exported to Window
**Location**: `m365-integration.js` line 206

**Problem**: 
- `updateConnectionStatus()` is defined but NEVER exposed to `window` object
- So when called from `handleSuccessfulLogin()`, it's calling the function in its own scope
- But there's no guarantee it's being called correctly

**Missing Export**: Compare lines 770-800:
```javascript
window.m365Login = login;
window.m365Logout = logout;
window.m365FetchPatients = fetchPatients;
// ... 
window.m365GetCurrentUser = getCurrentUser;
// MISSING: window.updateConnectionStatus = updateConnectionStatus;
```

### Issue 4: No Error Handling Before DOM Updates
**Location**: `m365-integration.js` lines 207-241

**Problem**: The function tries to update elements without checking if they exist:
```javascript
const statusEl = document.getElementById('connection-status');
if (statusEl) {
    statusEl.innerHTML = `...`;  // Only updates if element found
} else {
    // Silently skips if not found - NO ERROR LOG
}
```

This is good defensive coding, but there's NO error reporting if none of the elements are found.

### Issue 5: No Console Logging in updateConnectionStatus()
**Location**: `m365-integration.js` lines 206-241

**Problem**: Missing diagnostic logging
- No `console.log()` showing connection status being updated
- No `console.error()` if elements can't be found
- Makes debugging impossible

**Example**: Should be:
```javascript
function updateConnectionStatus(connected, username = '') {
    console.log('updateConnectionStatus called:', { connected, username });
    
    const statusEl = document.getElementById('connection-status');
    if (!statusEl) {
        console.warn('Element not found: connection-status');
    }
    // ... rest of function
}
```

## Specific Bugs Found

### Bug 1: Missing Console Logging in Authentication Flow
```javascript
function handleSuccessfulLogin() {
    console.log('User authenticated:', currentAccount.username);  // ✓ Good
    updateConnectionStatus(true, currentAccount.username);       // ✗ No log if fails
    
    if (typeof window.updateAuthState === 'function') {
        window.updateAuthState(true, currentAccount.username);    // ✓ Has type check
    }
    
    startPolling();                                               // ✗ No log
    fetchAllData();                                               // ✗ No log
}
```

### Bug 2: showToast() Called Unchecked
```javascript
// In multiple catch blocks:
showToast('Authentication error: ' + err.message);  // ✗ showToast not defined in m365-integration!
```

**Issue**: `showToast()` is defined only in HTML file (inline script), not available in m365-integration.js!

This means:
- Toast notifications from m365-integration.js errors will fail silently
- User sees no error message on auth failures

**Evidence**: Lines 110, 116, 123 in m365-integration.js call `showToast()` but it's undefined

### Bug 3: Callback Function Registration Happens in DOMContentLoaded
```javascript
// m365-integration.js lines 765-800
document.addEventListener('DOMContentLoaded', () => {
    window.m365Login = login;
    // ... 20 other registrations
});
```

But HTML file has:
```html
<!-- Line 1015 -->
<script src="m365-integration.js"></script>

<script>
    // This runs AFTER m365-integration.js loads
    // But when does updateAuthState get called?
    window.updateAuthState = function(authenticated, username = '') {
        // This is defined in HTML, line 1296
    }
</script>
```

**Race condition**: When does `window.updateAuthState` get registered? AFTER the above script tag. But m365-integration.js's initialization might fire BEFORE the HTML defines `updateAuthState`!

## Impact

1. **User logs in** → Redirected back to app
2. **handleRedirectPromise() fires** → Calls `handleSuccessfulLogin()`
3. **updateConnectionStatus() called** → Tries to update DOM elements
4. **Elements not found** → Updates silently fail, no error logged
5. **updateAuthState() called** → Sets `isAuthenticated = true`, `currentUser = username`
6. **But connection bar still shows "Local Mode"** because updateConnectionStatus() failed
7. **User sees "Local User" in form** because they're technically "authenticated" per HTML, but connection status doesn't reflect M365

## Verification Checklist

**Check with browser console**:
- [ ] Open DevTools → Console tab
- [ ] Look for errors from m365-integration.js
- [ ] Log in again
- [ ] Check if `currentAccount` is set (type: `ms alInstance.getAllAccounts()`)
- [ ] Check if `updateConnectionStatus()` is called (add breakpoint or log)

**Check HTML vs M365 state**:
- [ ] Is `isAuthenticated` true or false after login?
- [ ] Is `currentUser` set to the M365 username?
- [ ] Is `isConnected` true or false after login?
- [ ] Is `useM365` true or false?

**Check DOM elements**:
```javascript
// In console:
document.getElementById('connection-status-bar')  // Should exist
document.getElementById('status-text')             // Should exist
document.getElementById('status-indicator')        // Should exist
document.getElementById('status-detail')           // Should exist
```

## Recommended Fixes (Priority Order)

### Fix 1: Add Logging to updateConnectionStatus() [CRITICAL]
Add console.log statements to understand what's happening

### Fix 2: Export updateConnectionStatus() to window [CRITICAL]
Make function properly accessible

### Fix 3: Import showToast() from HTML [HIGH]
Register showToast() in window from HTML, consume in m365-integration.js

### Fix 4: Add Explicit Error Handling [HIGH]
Log when DOM element queries fail

### Fix 5: Fix Race Condition in updateAuthState() [MEDIUM]
Ensure callback is defined before m365-integration.js tries to call it

### Fix 6: Test Full Auth Flow End-to-End [HIGH]
Add integration tests to verify full flow

