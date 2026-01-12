# Clinical Rounding Platform - Installation Guide (Pure M365)

This guide provides step-by-step instructions to set up the Clinical Rounding Platform using **Microsoft 365 only** (no Azure).

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step 1: Entra ID App Registration](#step-1-entra-id-app-registration)
3. [Step 2: Create SharePoint Site & Lists](#step-2-create-sharepoint-site--lists)
4. [Step 3: Host the HTML File](#step-3-host-the-html-file)
5. [Step 4: Configure the App](#step-4-configure-the-app)
6. [Step 5: Test End-to-End](#step-5-test-end-to-end)
7. [Step 6: User Onboarding](#step-6-user-onboarding)
8. [Troubleshooting](#troubleshooting)
9. [Post-Deployment](#post-deployment)

---

## Prerequisites

### Required Access

- ✅ **Microsoft 365 Tenant** - With SharePoint Online access
- ✅ **Entra ID (Azure AD) Admin** - To register application
- ✅ **SharePoint Admin** - To create site and lists
- ✅ **Global Admin or Office 365 Admin** - To grant API permissions

### Required Tools

- 📌 **Web Browser** - Chrome, Edge, or Safari (for testing)
- 📌 **Microsoft 365 Admin Center** - https://admin.microsoft.com
- 📌 **Azure Portal** - https://portal.azure.com (for Entra ID only, not Azure services)
- 📌 **Text Editor** - VS Code or Notepad (to edit HTML config)

### Verify Access

```
1. Go to https://admin.microsoft.com → should work (Office 365 admin)
2. Go to https://portal.azure.com → **App Registrations** section (Entra ID admin)
3. Go to https://yourdomain.sharepoint.com/sites → should see SharePoint sites (SharePoint admin)
```

---

## Step 1: Entra ID App Registration

### 1.1 Register New Application

1. Go to **Azure Portal** → https://portal.azure.com
2. Click **App Registrations** (left menu)
3. Click **+ New Registration**
4. Fill in:
   - **Name**: `Clinical Rounding Platform`
   - **Supported account types**: **Accounts in this organizational directory only**
   - **Redirect URI** (Single-page application):
     - `http://localhost:3000` (for local testing)
     - `https://yourdomain.sharepoint.com/sites/clinical-rounding` (for production)
5. Click **Register**

### 1.2 Copy Credentials

After registration, save these values (you'll need them later):

**On the Overview page:**
- 📋 **Application (client) ID** - Copy this
- 📋 **Directory (tenant) ID** - Copy this

```bash
# Save these in a text file temporarily
CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### 1.3 Add API Permissions

1. Go to **API permissions** (left menu)
2. Click **+ Add a permission**
3. Select **Microsoft Graph**
4. Select **Delegated permissions**
5. Search and add these permissions:
   - ✅ `Sites.ReadWrite.All` - SharePoint access
   - ✅ `Files.Read.Write` - OneDrive access
   - ✅ `User.Read` - User profile
6. Click **Grant admin consent for [Tenant]** (blue button)
7. Verify all permissions show green checkmarks ✅

### 1.4 (Optional) Add App Roles for RBAC

If you want role-based access control (clinician/billing/admin):

1. Go to **App roles** (left menu)
2. Click **Create app role**
3. Create three roles:

| Display name | Value | Enabled |
|---|---|---|
| Clinician | `clinician` | ✅ Yes |
| Billing | `billing` | ✅ Yes |
| Administrator | `admin` | ✅ Yes |

4. Click **Apply**

### 1.5 Assign Users to Roles

1. Go to **Manage** → **Users and groups** (left menu)
2. Click **+ Add user/group**
3. Select users
4. Assign roles (Clinician → clinician, etc.)
5. Click **Assign**

---

## Step 2: Create SharePoint Site & Lists

### 2.1 Create SharePoint Site

1. Go to **SharePoint Home** - https://yourdomain.sharepoint.com
2. Click **+ Create site**
3. Select **Team site** (or **Communication site** if you prefer)
4. Fill in:
   - **Site name**: `Clinical Rounding`
   - **Site address**: `clinical-rounding` (becomes `/sites/clinical-rounding`)
5. Click **Next**
6. Choose privacy: **Private** (only authorized users)
7. Click **Finish**

### 2.2 Get Site ID

You'll need the **site ID** later. Get it now:

1. Go to your new site: https://yourdomain.sharepoint.com/sites/clinical-rounding
2. Click **Settings** (gear icon, top right)
3. Click **Site information** (bottom of menu)
4. Copy the **Site ID** from the URL bar

```
URL format: /sites/clinical-rounding?id=abc123...
Site ID: yourdomain.sharepoint.com,abc123,def456
```

**Save this value:**
```bash
SHAREPOINT_SITE_ID=yourdomain.sharepoint.com,abc123,def456
```

### 2.3 Create Patients List

1. Click **+ New** → **List**
2. Name: `Patients`
3. Click **Create**
4. Click **+ Add column** and create these columns:

| Column Name | Type | Additional Settings |
|---|---|---|
| Room | Single line of text | - |
| Date | Date and Time | - |
| Name | Single line of text | - |
| DOB | Single line of text | - |
| MRN | Single line of text | - |
| Hospital | Choice | Choices: `WGMC`, `AWC`, `BTMC`, `BEMC`, `CRMC`, `AHD`, `Westgate` |
| FindingsData | Multiple lines of text | Format: JSON |
| FindingsText | Multiple lines of text | - |
| Plan | Multiple lines of text | - |
| SupervisingMD | Single line of text | - |
| Pending | Multiple lines of text | - |
| FollowUp | Multiple lines of text | - |
| Priority | Choice | Choices: `Yes`, `No` |
| ProcedureStatus | Choice | Choices: `To-Do`, `In-Progress`, `Completed`, `Post-Op` |
| CPTPrimary | Single line of text | - |
| ICDPrimary | Single line of text | - |
| ChargeCodesSecondary | Multiple lines of text | Format: JSON |
| VisitKey | Single line of text | ⚠️ **Enforce unique values** |
| Archived | Choice | Choices: `Yes`, `No` |

**To create unique index on VisitKey:**
1. Click the **VisitKey** column header
2. Select **Column settings**
3. Check ✅ **Enforce unique values**

5. Save the list
6. **Get the list ID:**
   - Go to **List settings** → **Copy the list ID from the URL**
   - Format: `/sites/clinical-rounding/Lists/{ListID}/AllItems.aspx`

```bash
PATIENTS_LIST_ID=abc123-def456-...
```

### 2.4 Create OnCallSchedule List

1. Click **+ New** → **List**
2. Name: `OnCallSchedule`
3. Add columns:

| Column Name | Type |
|---|---|
| Date | Date and Time |
| Provider | Single line of text |
| Hospitals | Multiple lines of text |

4. Get the list ID and save it:
```bash
ONCALL_LIST_ID=abc123-def456-...
```

### 2.5 Create Settings List

1. Click **+ New** → **List**
2. Name: `Settings`
3. Add columns:

| Column Name | Type |
|---|---|
| Key | Single line of text |
| Value | Multiple lines of text |

4. Add sample settings (manually or via API):
   - Row 1: Key=`defaultOnCall`, Value=`Dr. Smith`
   - Row 2: Key=`hospitals`, Value=`WGMC,AWC,BTMC,BEMC,CRMC,AHD,Westgate`
   - Row 3: Key=`complianceMode`, Value=`relaxed`

5. Get the list ID:
```bash
SETTINGS_LIST_ID=abc123-def456-...
```

### 2.6 Create AuditLogs List (Optional)

For compliance auditing:

1. Click **+ New** → **List**
2. Name: `AuditLogs`
3. Add columns:

| Column Name | Type |
|---|---|
| UserIdentity | Single line of text |
| ActionType | Choice (Options: `CREATE`, `UPDATE`, `DELETE`, `EXPORT`, `IMPORT`) |
| RecordId | Single line of text |
| Details | Multiple lines of text |
| Timestamp | Date and Time |

4. Get the list ID:
```bash
AUDIT_LIST_ID=abc123-def456-...
```

---

## Step 3: Host the HTML File

### Option A: Local Testing (Development)

```bash
# On your machine, navigate to the project folder
cd "D:\Code\Clinical Roundup File"

# Start a simple HTTP server
python -m http.server 3000

# Or use Node.js
npx http-server -p 3000

# Access in browser
http://localhost:3000/clinical-rounding-adaptive.html
```

### Option B: SharePoint Document Library (Production)

1. Go to your site: https://yourdomain.sharepoint.com/sites/clinical-rounding
2. Click **Documents** (left menu)
3. Click **Upload** → Upload `clinical-rounding-adaptive.html`
4. Right-click the file → **Copy link**
5. Access via: https://yourdomain.sharepoint.com/sites/clinical-rounding/Documents/clinical-rounding-adaptive.html

⚠️ **Note**: For CORS/authentication, this might not work. See Option C below.

### Option C: Microsoft 365 App (Recommended)

1. Click **+ New** → **App**
2. Upload `clinical-rounding-adaptive.html` as a custom app
3. Users access via Microsoft 365 app launcher

Simplest approach: use **Option A** locally during testing, then discuss deployment with your IT team.

---

## Step 4: Configure the App

### 4.1 Edit HTML Configuration

Open `clinical-rounding-adaptive.html` in a text editor (VS Code recommended).

Find the `<script>` section and locate (or add) this configuration block:

```javascript
// M365 Configuration - UPDATE THESE VALUES
const M365_CONFIG = {
  auth: {
    clientId: 'PASTE_YOUR_CLIENT_ID_HERE',
    authority: 'https://login.microsoftonline.com/PASTE_YOUR_TENANT_ID_HERE',
    redirectUri: window.location.origin,
    cacheLocation: 'sessionStorage',
    scopes: ['Sites.ReadWrite.All', 'Files.ReadWrite', 'User.Read']
  },
  sharepoint: {
    siteId: 'PASTE_YOUR_SITE_ID_HERE',
    lists: {
      patients: 'PASTE_PATIENTS_LIST_ID_HERE',
      onCall: 'PASTE_ONCALL_LIST_ID_HERE',
      settings: 'PASTE_SETTINGS_LIST_ID_HERE'
    }
  }
};
```

### 4.2 Fill in Your Values

Replace placeholders with values you saved in Steps 1 & 2:

```javascript
const M365_CONFIG = {
  auth: {
    clientId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    authority: 'https://login.microsoftonline.com/f1b2c3d4-e5f6-7890-abcd-ef1234567890',
    redirectUri: 'http://localhost:3000',
    cacheLocation: 'sessionStorage',
    scopes: ['Sites.ReadWrite.All', 'Files.ReadWrite', 'User.Read']
  },
  sharepoint: {
    siteId: 'yourdomain.sharepoint.com,abc123,def456',
    lists: {
      patients: 'abc123def456-1234-5678-90ab-cdef12345678',
      onCall: 'def456abc123-1234-5678-90ab-cdef12345678',
      settings: '123456abcdef-1234-5678-90ab-cdef12345678'
    }
  }
};
```

### 4.3 Save and Close

Save the file. You're done with configuration!

---

## Step 5: Test End-to-End

### 5.1 Test Login

1. Open the app in browser: http://localhost:3000/clinical-rounding-adaptive.html
2. Click **Sign In**
3. Enter your organizational email
4. Enter password
5. Verify you see the dashboard ✅

### 5.2 Test Patient CRUD

1. Click **+ Add Patient**
2. Fill in:
   - Room: `101`
   - Date: `Today`
   - Name: `John Doe`
   - MRN: `12345`
   - Hospital: `WGMC`
   - Findings: `Asymptomatic`
   - Plan: `Follow-up`
3. Click **Save**
4. Verify patient appears in table ✅

### 5.3 Test Edit

1. Click the patient row
2. Modify a field (e.g., Plan)
3. Click **Save**
4. Verify change reflected ✅

### 5.4 Test CSV Import

1. Download `Rounding List.csv` (sample file in project)
2. Click **Import**
3. Select the CSV file
4. Verify patients load ✅

### 5.5 Test Excel Export

1. Click **Export to OneDrive**
2. Wait for success toast
3. Check OneDrive:
   - Folder: `/Clinical Rounding`
   - Files: `Rounding List YYYY-MM-DD.xlsx`, `Rounding List - Latest.xlsx`
4. Verify file content ✅

### 5.6 Test Real-Time Sync

1. Open app in two browser windows
2. Add patient in Window 1
3. Wait 15 seconds
4. Verify it appears in Window 2 ✅

### 5.7 Test Offline Mode

1. Open DevTools (F12)
2. Go to **Network** tab
3. Check **Offline** checkbox
4. Verify you can still view cached data ✅
5. Add a test patient (stored in localStorage)
6. Uncheck **Offline**
7. Verify sync happens ✅

---

## Step 6: User Onboarding

### 6.1 Create Entra ID Users

If users don't exist:

1. Go to **Microsoft 365 Admin Center** → https://admin.microsoft.com
2. **Users** → **Active users** → **+ Add a user**
3. Fill in email, name, role
4. Click **Next**
5. Assign licenses (Microsoft 365 E3 or higher)
6. Click **Finish**

### 6.2 Assign App Roles

For each user:

1. Go to **Azure Portal** → **App Registrations** → Your app
2. Go to **Manage** → **Users and groups**
3. Click **+ Add user/group**
4. Select user
5. Assign role (Clinician, Billing, Admin)
6. Click **Assign**

### 6.3 Share App Link

Send users the app URL:

```
http://localhost:3000/clinical-rounding-adaptive.html
(or production URL if hosted)

First login instructions:
1. Click "Sign In"
2. Enter your work email
3. Enter password
4. Approve MFA if prompted
5. You're logged in!
```

### 6.4 Share User Guide

Send them the `USERGUIDE.md` document:
- How to add patients
- How to import/export
- How to use each tab
- Keyboard shortcuts
- Troubleshooting tips

---

## Troubleshooting

### Problem: "Not authorized to access this resource"

**Solution:**
1. Verify user is assigned the app in Entra ID (App Registrations → Users and groups)
2. Grant admin consent for API permissions (Step 1.3)
3. Check SharePoint permissions (user can access site)

### Problem: "CORS error" or "Network blocked"

**Solution:**
1. If hosting from SharePoint, this is expected. Use Option A (local server) instead.
2. Check browser console (F12) for exact error
3. Verify Graph API scopes are granted (Step 1.3)

### Problem: "List not found" or "Site not found"

**Solution:**
1. Verify site ID in config is correct (copy from SharePoint URL)
2. Verify list IDs match actual lists (check SharePoint list settings)
3. Re-test with Graph Explorer: https://developer.microsoft.com/graph/graph-explorer

### Problem: "Patients not syncing between windows"

**Solution:**
1. Check polling is running (open DevTools → Network, should see Graph API calls every 15 sec)
2. Verify no JavaScript errors (DevTools → Console)
3. Check SharePoint list has new items (go to SharePoint and refresh)

### Problem: "Export to OneDrive fails"

**Solution:**
1. Ensure user has OneDrive enabled (Microsoft 365 license includes it)
2. Create `/Clinical Rounding` folder in OneDrive manually first
3. Check `Files.ReadWrite` permission is granted (Step 1.3)
4. Try export again

---

## Post-Deployment

### 7.1 Monitoring

SharePoint automatically logs all changes:

1. Go to **Microsoft Purview** → https://compliance.microsoft.com
2. **Audit Log Search** → View all patient list changes
3. Filter by: Date, user, activity type
4. Export for compliance reviews

### 7.2 Backup Data

SharePoint has built-in backup:

1. SharePoint Admin Center → **Active sites**
2. Your site should show **automatic backup enabled**
3. For manual export: List settings → **Export to Excel**

### 7.3 Performance Tuning

If you have >10,000 patients:

1. Reduce polling interval to 30 seconds (less frequent API calls)
2. Filter patients by date (show last 30 days only)
3. Implement pagination (load 200 at a time)
4. Archive old records regularly

### 7.4 Security Hardening

1. Enable **MFA** for all users:
   - Azure Portal → Users → Enable MFA

2. Set **Conditional Access** policies:
   - Require MFA for clinical staff
   - Block legacy authentication
   - Require compliant devices (if needed)

3. Enable **Data Loss Prevention** (DLP):
   - Microsoft Purview → Data loss prevention
   - Prevent export of patient data outside organization

### 7.5 Regular Maintenance Tasks

| Task | Frequency | Owner |
|---|---|---|
| Review audit logs | Weekly | Compliance officer |
| Archive old records | Monthly | Admin |
| Update user permissions | As needed | IT Admin |
| Backup data | Monthly | IT Operations |
| Review app role assignments | Quarterly | IT Admin |

---

## Verification Checklist

- [ ] Entra ID app registered (client ID saved)
- [ ] API permissions granted (green checkmarks)
- [ ] SharePoint site created
- [ ] 4 lists created (Patients, OnCallSchedule, Settings, AuditLogs)
- [ ] All list IDs captured
- [ ] HTML file updated with config values
- [ ] Login works with organizational account
- [ ] Patient CRUD operations work
- [ ] CSV import tested
- [ ] Excel export to OneDrive tested
- [ ] Real-time sync tested (two windows)
- [ ] Offline mode works
- [ ] Users assigned app roles
- [ ] User guide distributed
- [ ] Audit logging verified in Purview
- [ ] Backup confirmed

---

## References

- [Microsoft 365 Admin Center](https://admin.microsoft.com)
- [Azure Portal (Entra ID)](https://portal.azure.com)
- [SharePoint Online](https://yourdomain.sharepoint.com)
- [Graph API Documentation](https://learn.microsoft.com/en-us/graph/)
- [MSAL.js](https://learn.microsoft.com/en-us/azure/active-directory/develop/msal-browser-use-cases)
- [Microsoft Purview Compliance](https://compliance.microsoft.com)

---

**Version**: 1.0 (Pure M365, No Azure)  
**Last Updated**: January 2026

For support, contact your M365 administrator.
