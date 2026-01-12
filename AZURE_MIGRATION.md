# Clinical Rounding Platform - Azure Migration

This document outlines the migration from Firebase/Google to Azure/Microsoft 365 ecosystem.

## Architecture

- **Frontend**: Azure Static Web Apps (free tier) hosting the HTML client
- **Backend**: Azure Functions (Node.js 18) API
- **Authentication**: Microsoft Entra ID (Azure AD) with app roles
- **Data Storage**: SharePoint Lists via Microsoft Graph API
- **File Storage**: OneDrive via Microsoft Graph API
- **Auth Method**: MSAL.js 2.x with organizational login

## SharePoint List Schema

### 1. Patients List

| Column Name | Type | Description |
|-------------|------|-------------|
| Title | Single line of text | Auto-generated |
| VisitKey | Single line of text (unique) | `{mrn}\|{date}` for uniqueness |
| Room | Single line of text | Room number |
| Date | Date and Time | Service date |
| Name | Single line of text | Patient name |
| DOB | Single line of text | Date of birth |
| MRN | Single line of text | Medical record number (indexed) |
| Hospital | Choice | Hospital location (WGMC, AWC, BTMC, etc.) |
| FindingsData | Multiple lines of text | JSON: `{"codes": [], "values": {}}` |
| FindingsText | Multiple lines of text | Additional findings text |
| Plan | Multiple lines of text | Treatment plan |
| SupervisingMD | Person or Group | Supervising physician |
| Pending | Multiple lines of text | Pending tests/info |
| FollowUp | Multiple lines of text | Follow-up appointments |
| Priority | Choice | Yes/No (STAT flag) |
| ProcedureStatus | Choice | To-Do, In-Progress, Completed, Post-Op |
| CPTPrimary | Single line of text | Primary CPT code |
| ICDPrimary | Single line of text | Primary ICD-10 code |
| ChargeCodesSecondary | Multiple lines of text | Secondary billing codes |
| Archived | Choice | Yes/No |

**Indexes**: 
- VisitKey (unique)
- MRN (for backfeed queries)
- Date (for filtered views)

### 2. OnCallSchedule List

| Column Name | Type | Description |
|-------------|------|-------------|
| Title | Single line of text | Auto-generated |
| Date | Date and Time | On-call date |
| Provider | Single line of text | Provider name (e.g., "Jain") |
| Hospitals | Multiple lines of text | Comma-separated hospitals |

### 3. Settings List

| Column Name | Type | Description |
|-------------|------|-------------|
| Title | Single line of text | "Global" |
| OnCall | Single line of text | Default on-call provider |
| Hospitals | Multiple lines of text | Comma-separated hospital list |
| ComplianceMode | Choice | relaxed, hipaa_strict, sox_strict |

### 4. AuditLogs List

| Column Name | Type | Description |
|-------------|------|-------------|
| Title | Single line of text | Action description |
| UserIdentity | Single line of text | User ID from Entra ID |
| ActionType | Choice | READ, CREATE, UPDATE, DELETE, EXPORT |
| AffectedRecords | Multiple lines of text | Record IDs/keys |
| Timestamp | Date and Time | Auto-generated |
| Details | Multiple lines of text | JSON details |

## Entra ID App Roles

Configure the following app roles in your Entra ID app registration:

1. **clinician** - Can view and create/edit patient records (no billing access)
2. **billing** - Can view all fields including billing codes
3. **admin** - Full access including delete, settings, and on-call schedule

## Environment Variables

Set these in Azure Static Web Apps Configuration:

```
SHAREPOINT_SITE_ID=<your-site-id>
PATIENTS_LIST_ID=<patients-list-id>
ONCALL_LIST_ID=<oncall-list-id>
SETTINGS_LIST_ID=<settings-list-id>
AUDIT_LIST_ID=<audit-list-id>
AZURE_CLIENT_ID=<entra-id-client-id>
AZURE_TENANT_ID=<entra-id-tenant-id>
AZURE_CLIENT_SECRET=<entra-id-client-secret>
```

## Getting SharePoint List IDs

Use Graph Explorer or PowerShell:

```powershell
# Get site ID
GET https://graph.microsoft.com/v1.0/sites/{tenant}.sharepoint.com:/sites/{sitename}

# Get list IDs
GET https://graph.microsoft.com/v1.0/sites/{siteId}/lists
```

## Managed Identity Permissions

Grant the Function App's Managed Identity these Microsoft Graph permissions:

- `Sites.ReadWrite.All` - For SharePoint Lists access
- `Files.ReadWrite` - For OneDrive export (user-delegated)

## Deployment Steps

### 1. Create Azure Resources

```bash
# Create resource group
az group create --name clinical-rounding-rg --location eastus

# Create Static Web App
az staticwebapp create \
  --name clinical-rounding-app \
  --resource-group clinical-rounding-rg \
  --source https://github.com/<your-org>/<your-repo> \
  --location eastus \
  --branch main \
  --app-location "/" \
  --api-location "api" \
  --output-location ""
```

### 2. Configure Entra ID Authentication

1. Register app in Entra ID
2. Add redirect URI: `https://<your-app>.azurestaticapps.net/.auth/login/aad/callback`
3. Create app roles (clinician, billing, admin)
4. Generate client secret
5. Update `staticwebapp.config.json` with tenant ID

### 3. Create SharePoint Lists

1. Go to SharePoint site
2. Create 4 lists with schemas above
3. Note the List IDs from URLs or Graph API
4. Configure Choice columns with appropriate values

### 4. Deploy Code

```bash
# Install dependencies
cd api
npm install

# Deploy (GitHub Actions auto-deploys on push)
git push origin main
```

### 5. Test

1. Navigate to `https://<your-app>.azurestaticapps.net`
2. Sign in with Entra ID credentials
3. Verify role-based access (test with different role assignments)
4. Test patient CRUD operations
5. Test Excel import/export

## Migration from Firebase

The HTML client has been updated to:

1. Replace Firebase SDK with MSAL.js
2. Replace Firestore calls with `/api/*` fetch calls
3. Add polling (15 seconds) with ETag optimization
4. Add localStorage caching for offline mode
5. Add hospital field to patient form
6. Add "Copy from Previous Visit" button
7. Implement 3-pass CSV import
8. Build Excel export to OneDrive

## Offline Mode

The app caches data in `localStorage` when online and syncs on reconnect:

- `cached_patients` - Last fetched patient list
- `cached_oncall` - Last fetched on-call schedule
- `cached_settings` - Last fetched settings
- `pending_changes` - Queue of unsaved changes

## Future: Cosmos DB Migration

The data access layer (`dataService.js`) abstracts the storage mechanism. To migrate to Cosmos DB:

1. Create new `cosmosDataService.js` implementing same interface
2. Update Functions to import Cosmos service
3. Frontend remains unchanged (API contract is stable)

Key points for Cosmos:
- Use partition key: `mrn`
- Use document ID: `${mrn}|${date}`
- Migrate data with Azure Data Factory
- Update environment variables

## Compliance Features

All compliance framework code (ComplianceEngine, AuditLogger, SessionManager, etc.) is wired into the API endpoints:

- **Audit logging**: Every API call logs to AuditLogs list
- **Field masking**: Non-billing users see `***` for billing codes
- **RBAC**: Permissions enforced server-side
- **Session timeout**: 15-minute idle timeout (configurable)
- **Compliance modes**: relaxed (default), hipaa_strict, sox_strict

## Costs (Estimated)

- Azure Static Web Apps: **Free tier** (100 GB bandwidth)
- Azure Functions: **~$0-5/month** (Consumption plan, low traffic)
- Microsoft 365: **Included** in existing license (SharePoint + OneDrive)
- Entra ID: **Free tier** (up to 50,000 users)

**Total: ~$0-5/month** (vs. Firebase ~$25-50/month with Firestore)

## Support

For issues, see troubleshooting section in `/docs/troubleshooting.md`
