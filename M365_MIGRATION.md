# Clinical Rounding Platform - Pure M365 Migration

This document outlines the migration from Firebase/Google to **Microsoft 365 (pure ecosystem)** with NO Azure services required.

## Architecture Overview

**Pure M365 Stack**:
- **Authentication**: Entra ID (Azure AD) with MSAL.js
- **Data Storage**: SharePoint Lists (included in M365 license)
- **File Storage**: OneDrive (included in M365 license)
- **Frontend**: Static HTML/JS served via SharePoint or simple HTTP server
- **Sync**: Direct Graph API calls from browser (no backend)

```
┌──────────────────────────────────────────────────────┐
│      Browser (HTML + MSAL.js)                        │
│   Direct Graph API calls (delegated scopes)          │
└────────────────────┬─────────────────────────────────┘
                     │
        ┌───────────┴───────────┐
        │                       │
   ┌────▼─────┐         ┌──────▼──────┐
   │SharePoint │         │  OneDrive   │
   │  Lists    │         │  (export)   │
   │ + Audit   │         │  (import)   │
   └───────────┘         └─────────────┘

Authentication: Entra ID
Cost: ~$5-10/user/month (M365 license)
Deployment: Serve single HTML file
Ops: Minimal (SharePoint handles everything)
```

## Key Advantages

1. **No backend deployment** - Single static HTML file
2. **No infrastructure costs** - Uses existing M365 licenses
3. **Simpler security** - No backend secrets to manage
4. **Built-in audit** - SharePoint auto-logs all changes
5. **Easier troubleshooting** - Everything in M365 console
6. **Lower latency** - Direct Graph API calls

## SharePoint Lists Schema

### 1. Patients List
Create a SharePoint List named **`Patients`** with these columns:

| Column Name | Type | Notes |
|---|---|---|
| Title (auto) | Text | System field (keep for audit) |
| VisitKey | Text | **Enforce unique values** (mrn\|date) |
| Room | Text | Room/bed number |
| Date | Date/Time | Date of service |
| Name | Text | Patient name |
| DOB | Text | Date of birth |
| MRN | Text | Medical record number |
| Hospital | Choice | Options: WGMC, AWC, BTMC, BEMC, CRMC, AHD, Westgate |
| FindingsData | Note | JSON-formatted findings codes & values |
| FindingsText | Note | Plain-text findings summary |
| Plan | Note | Treatment/management plan |
| SupervisingMD | Text | Attending physician |
| Pending | Note | Pending tests/consultations |
| FollowUp | Note | Follow-up appointments |
| Priority | Choice | Options: Yes, No |
| ProcedureStatus | Choice | Options: To-Do, In-Progress, Completed, Post-Op |
| CPTPrimary | Text | Primary CPT code |
| ICDPrimary | Text | Primary ICD code |
| ChargeCodesSecondary | Note | Secondary billing codes (JSON) |
| Archived | Choice | Options: Yes, No |

**Index**: Create unique index on `VisitKey` column.

### 2. OnCallSchedule List

| Column Name | Type |
|---|---|
| Title (auto) | Text |
| Date | Date/Time |
| Provider | Text |
| Hospitals | Note |

### 3. Settings List

| Column Name | Type |
|---|---|
| Title (auto) | Text |
| Key | Text |
| Value | Note |

Sample rows:
- Key: `defaultOnCall`, Value: `Dr. Smith`
- Key: `hospitals`, Value: `WGMC,AWC,BTMC,BEMC,CRMC,AHD,Westgate`
- Key: `complianceMode`, Value: `relaxed`

### 4. AuditLogs List (Optional, but recommended)

SharePoint auto-logs all list changes. You can view in **Audit Log Search** under Microsoft Purview. Create this list to store manual audit entries if needed:

| Column Name | Type |
|---|---|
| Title (auto) | Text |
| UserIdentity | Text |
| ActionType | Choice (Options: CREATE, UPDATE, DELETE, EXPORT, IMPORT) |
| RecordId | Text |
| Details | Note |
| Timestamp | Date/Time |

## How It Works: Direct Graph API

The browser uses MSAL.js to:

1. **Authenticate** → Get access token
2. **Fetch patients** → `GET /sites/{siteId}/lists/{listId}/items?$filter=Archived eq 'No'`
3. **Save patient** → `POST /sites/{siteId}/lists/{listId}/items` or `PATCH .../items/{itemId}`
4. **Export to OneDrive** → `PUT /me/drive/root:/Clinical Rounding/Rounding List.xlsx:/content`
5. **Audit logging** → SharePoint handles automatically

## Configuration Steps

### Step 1: Entra ID App Registration

1. Azure Portal → **App Registrations** → **New Registration**
2. Name: `Clinical Rounding Platform`
3. Supported account types: **Accounts in this organizational directory only**
4. Redirect URI:
   - Platform: **Single-page application (SPA)**
   - URI: `http://localhost:3000` (for local testing)
   - URI: `https://yourdomain.sharepoint.com/sites/clinical-rounding` (for production)
5. Copy **Application (client) ID** and **Directory (tenant) ID**

### Step 2: API Permissions

1. Go to **API permissions**
2. Click **Add a permission** → **Microsoft Graph**
3. Select **Delegated permissions** and add:
   - `Sites.ReadWrite.All`
   - `Files.ReadWrite`
   - `User.Read`
4. Click **Grant admin consent**

### Step 3: Create SharePoint Lists

1. Go to your SharePoint site: `https://yourdomain.sharepoint.com/sites/clinical-rounding`
2. Create the 4 lists using schema above
3. For each list, note its ID (from list settings URL)

### Step 4: Get SharePoint Site ID

```bash
# Use Graph Explorer (https://developer.microsoft.com/en-us/graph/graph-explorer)
# GET /sites/yourdomain.sharepoint.com:/sites/clinical-rounding
# Response will show site ID (e.g., "yourdomain.sharepoint.com,abc123,def456")

# Or in JavaScript (within the app):
const response = await fetch(
  'https://graph.microsoft.com/v1.0/sites/yourdomain.sharepoint.com:/sites/clinical-rounding',
  { headers: { 'Authorization': `Bearer ${token}` } }
);
const siteData = await response.json();
console.log(siteData.id); // Copy this value
```

### Step 5: Update HTML Configuration

In `clinical-rounding-adaptive.html`, add at the top of the `<script>` section:

```javascript
// M365 Configuration
const M365_CONFIG = {
  auth: {
    clientId: 'YOUR_APPLICATION_CLIENT_ID',
    authority: 'https://login.microsoftonline.com/YOUR_TENANT_ID',
    redirectUri: window.location.origin,
    cacheLocation: 'sessionStorage'
  },
  graph: {
    endpoints: {
      graphs: 'https://graph.microsoft.com/v1.0'
    }
  },
  sharepoint: {
    siteId: 'yourdomain.sharepoint.com,site-id-guid',
    lists: {
      patients: 'patients-list-id-guid',
      onCall: 'oncall-list-id-guid',
      settings: 'settings-list-id-guid'
    }
  }
};
```

## Implementation: Key Functions

### CSV Import
```javascript
async function importPatients(csvFile) {
  const text = await csvFile.text();
  const results = Papa.parse(text, { header: true, skipEmptyLines: true });
  
  // Pass 1: Parse on-call rows (1-3)
  const onCallData = parseOnCallRows(results.data.slice(0, 3));
  
  // Pass 2: Map columns (row 4)
  const headers = results.data[3];
  
  // Pass 3: Parse patients with hospital auto-detect
  const patients = parsePatientRows(results.data.slice(4), headers);
  
  // Save to SharePoint
  for (const patient of patients) {
    await savePatientToSharePoint(patient);
  }
}
```

### Real-Time Polling
```javascript
async function startPolling() {
  setInterval(async () => {
    const token = await getGraphToken();
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${M365_CONFIG.sharepoint.siteId}/lists/${M365_CONFIG.sharepoint.lists.patients}/items?$select=*,fields(*)`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const data = await response.json();
    updatePatients(data.value);
  }, 15000); // Every 15 seconds
}
```

### OneDrive Export
```javascript
async function exportToOneDrive(workbook) {
  const token = await getGraphToken();
  const blob = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  
  const filename = `Rounding List ${new Date().toISOString().split('T')[0]}.xlsx`;
  
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/root:/Clinical Rounding/${filename}:/content`,
    {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` },
      body: new Blob([blob])
    }
  );
  
  return response.ok;
}
```

## Compliance & Audit

SharePoint automatically logs:
- Who created/modified/deleted records
- When changes occurred
- What changed (version history)

View audit logs:
1. Microsoft Purview → **Audit Log Search**
2. Filter by: SharePoint Lists, activity, date range
3. Export for compliance reviews

For custom audit entries, use the AuditLogs list and add entries manually via Graph API.

## Performance Considerations

1. **Polling interval**: 10-15 seconds balances responsiveness vs. API quota
2. **ETag caching**: Store `lastUpdatedMax` timestamp, skip re-render if unchanged
3. **localStorage**: Cache last 500 records for offline access
4. **Pagination**: Graph API returns max 200 items; use `$top=200&$skip=X` for large datasets

## Limitations & Workarounds

| Limitation | Workaround |
|---|---|
| Max 5,000 items per view | Filter by date (past 30 days) |
| No real-time push | 10-15 sec polling sufficient for rounding |
| No custom business logic | Use Power Automate for workflows |
| Graph API throttling (1200 req/min) | Batch requests, cache aggressively |

## Switching to Azure Later

If you later need:
- Custom business logic
- Real-time updates (SignalR)
- Microservices

Simply:
1. Create Azure Functions that call Graph API (same calls as client)
2. Update HTML to call `/api/*` instead of Graph directly
3. **No data migration** - SharePoint remains the source of truth

## Cost Comparison

| Item | Cost | Notes |
|---|---|---|
| M365 License (E3) | $10/user/month | Includes SharePoint, OneDrive, Teams |
| Azure Static Web Apps | Free | If hosting HTML there |
| Pure M365 Total | **$0 additional** | No new infrastructure |
| vs. Azure Hybrid | **Saves $25/month** | No Functions, no Cosmos |

## References

- [Microsoft Graph API](https://learn.microsoft.com/en-us/graph/api/overview)
- [MSAL.js for SPA](https://learn.microsoft.com/en-us/azure/active-directory/develop/msal-browser-use-cases)
- [SharePoint REST API](https://learn.microsoft.com/en-us/sharepoint/dev/sp-add-ins/working-with-lists-and-list-items-with-rest)
- [OneDrive API](https://learn.microsoft.com/en-us/graph/onedrive-concept-overview)
- [Entra ID App Roles](https://learn.microsoft.com/en-us/azure/active-directory/develop/howto-add-app-roles-in-apps)

---

**Version**: 1.0 (Pure M365, no Azure)  
**Last Updated**: January 2026
