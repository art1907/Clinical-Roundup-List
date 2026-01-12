# Clinical Rounding Platform - Installation Guide

This guide provides step-by-step instructions to set up and deploy the Clinical Rounding Platform on Azure with SharePoint Lists backend.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Step 1: Set Up Azure Resources](#step-1-set-up-azure-resources)
4. [Step 2: Configure Entra ID (Azure AD)](#step-2-configure-entra-id-azure-ad)
5. [Step 3: Create SharePoint Lists](#step-3-create-sharepoint-lists)
6. [Step 4: Deploy Azure Functions API](#step-4-deploy-azure-functions-api)
7. [Step 5: Update HTML File](#step-5-update-html-file)
8. [Step 6: Deploy to Azure Static Web Apps](#step-6-deploy-to-azure-static-web-apps)
9. [Step 7: Configure Environment Variables](#step-7-configure-environment-variables)
10. [Step 8: Verify Permissions](#step-8-verify-permissions)
11. [Step 9: Test End-to-End](#step-9-test-end-to-end)
12. [Post-Deployment](#post-deployment)

---

## Prerequisites

Before starting, ensure you have:

### Required Access

- ✅ **Azure Subscription** - Active, with owner/contributor permissions
- ✅ **Microsoft 365 Tenant** - With SharePoint Online access
- ✅ **GitHub Account** - For version control (if using GitHub Actions)
- ✅ **Administrative Access** - To create Entra ID app, SharePoint sites, etc.

### Required Tools

Install on your local machine:

```bash
# Azure CLI
https://learn.microsoft.com/en-us/cli/azure/install-azure-cli

# Node.js (v18 or later)
https://nodejs.org/

# Git
https://git-scm.com/

# Visual Studio Code (optional but recommended)
https://code.visualstudio.com/
```

### Verify Installations

```bash
az --version          # Azure CLI
node --version        # Node.js (should be v18+)
git --version         # Git
npm --version         # npm (comes with Node)
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (HTML/JS)                         │
│     (MSAL.js auth + polling + localStorage caching)          │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS (Bearer token)
                     │
┌────────────────────▼────────────────────────────────────────┐
│              Azure Static Web Apps                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Azure Functions API (/api/*)                        │   │
│  │  ├─ /patients (CRUD)                                 │   │
│  │  ├─ /backfeed (copy previous visit)                  │   │
│  │  ├─ /onCallSchedule                                  │   │
│  │  ├─ /settings                                        │   │
│  │  └─ /export (OneDrive upload)                        │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │ Graph API (Managed Identity)
         ┌───────────┴───────────┐
         │                       │
    ┌────▼─────┐         ┌──────▼──────┐
    │ SharePoint│         │  OneDrive   │
    │   Lists   │         │  (export)   │
    └───────────┘         └─────────────┘

Authentication: Entra ID (Azure AD) with app roles
Audit: SharePoint AuditLogs list
```

---

## Step 1: Set Up Azure Resources

### 1.1 Create Resource Group

```bash
az group create \
  --name clinical-rounding-rg \
  --location eastus
```

### 1.2 Create Azure Static Web App

```bash
az staticwebapp create \
  --name clinical-rounding-app \
  --resource-group clinical-rounding-rg \
  --source https://github.com/YOUR_ORG/clinical-rounding-repo \
  --location eastus \
  --branch main \
  --app-location "/" \
  --api-location "api" \
  --output-location ""
```

**Notes**:
- Replace `YOUR_ORG` with your GitHub organization
- This creates the SWA resource but doesn't deploy yet
- GitHub Actions will be configured automatically (next steps)

### 1.3 Get Static Web App Details

```bash
az staticwebapp show \
  --name clinical-rounding-app \
  --resource-group clinical-rounding-rg \
  --query "{id:id, name:name, defaultHostname:defaultHostname}"
```

**Note**: Save the `defaultHostname` (e.g., `calm-tree-abc123.azurestaticapps.net`)

### 1.4 Enable System-Assigned Managed Identity

The Functions need a Managed Identity to access SharePoint without storing secrets:

```bash
# Get the Static Web App resource ID
SWAPP_RESOURCE_ID=$(az staticwebapp show \
  --name clinical-rounding-app \
  --resource-group clinical-rounding-rg \
  --query id -o tsv)

# Enable system-assigned managed identity
az staticwebapp identity assign \
  --name clinical-rounding-app \
  --resource-group clinical-rounding-rg \
  --identity-type SystemAssigned
```

---

## Step 2: Configure Entra ID (Azure AD)

### 2.1 Register Application

1. Go to **Azure Portal** → **App Registrations** → **New Registration**
2. Name: `Clinical Rounding Platform`
3. Supported account types: **Accounts in this organizational directory only**
4. Redirect URI:
   - Platform: **Web**
   - URI: `https://<your-swa-hostname>/.auth/login/aad/callback`
   - (Replace `<your-swa-hostname>` with your Static Web App hostname from Step 1.3)
5. Click **Register**

### 2.2 Note Application Credentials

After registration, save:

- **Application (client) ID** - Under "Overview"
- **Directory (tenant) ID** - Under "Overview"

```bash
# Save these - you'll need them later
TENANT_ID="your-tenant-id"
CLIENT_ID="your-client-id"
```

### 2.3 Create Client Secret

1. Go to **Certificates & secrets**
2. Click **New client secret**
3. Description: `API Backend Authentication`
4. Expiration: **12 months**
5. Copy the **Value** (not the ID)

```bash
CLIENT_SECRET="your-secret-value"
```

⚠️ **Important**: Save this secret securely. You won't be able to see it again.

### 2.4 Grant API Permissions

1. Go to **API permissions**
2. Click **Add a permission**
3. Select **Microsoft Graph**
4. Select **Application permissions**
5. Search and add:
   - ✅ `Sites.ReadWrite.All` (SharePoint access)
   - ✅ `Files.ReadWrite.All` (OneDrive export)
   - ✅ `User.Read.All` (for user profile info)
6. Click **Grant admin consent**

### 2.5 Create App Roles

1. Go to **App roles**
2. Click **Create app role**
3. Create three roles:

| Role Name | Value | Enabled |
|-----------|-------|---------|
| Clinician | `clinician` | ✅ Yes |
| Billing | `billing` | ✅ Yes |
| Administrator | `admin` | ✅ Yes |

### 2.6 Add Users to Roles

1. Go to **Manage** → **Users and groups**
2. For each user:
   - Click **Add user**
   - Select user
   - Select role
   - Click **Assign**

Example assignments:
- Physicians: `clinician` role
- Finance staff: `billing` role
- IT staff: `admin` role

---

## Step 3: Create SharePoint Lists

### 3.1 Access SharePoint Site

1. Go to your **Microsoft 365 site** (e.g., `https://yourdomain.sharepoint.com/sites/clinical-rounding`)
2. If the site doesn't exist, create it:
   - SharePoint → **Create site**
   - Site name: `Clinical Rounding`
   - Site type: **Team site**

### 3.2 Create Patients List

1. Click **+ New** → **List**
2. Name: `Patients`
3. Click **Create**
4. Add columns (click **+ Add column**):

| Column Name | Type | Details |
|-------------|------|---------|
| VisitKey | Single line of text | **Index this** (must be unique) |
| Room | Single line of text | - |
| Date | Date and Time | - |
| Name | Single line of text | - |
| DOB | Single line of text | - |
| MRN | Single line of text | **Index this** (for backfeed queries) |
| Hospital | Choice | Options: Abrazo West, BEMC, BTMC, Westgate, CRMC, WGMC, AHD |
| FindingsData | Multiple lines of text | **Format**: JSON |
| FindingsText | Multiple lines of text | - |
| Plan | Multiple lines of text | - |
| SupervisingMD | Single line of text | - |
| Pending | Multiple lines of text | - |
| FollowUp | Multiple lines of text | - |
| Priority | Choice | Options: Yes, No |
| ProcedureStatus | Choice | Options: To-Do, In-Progress, Completed, Post-Op |
| CPTPrimary | Single line of text | - |
| ICDPrimary | Single line of text | - |
| ChargeCodesSecondary | Multiple lines of text | - |
| Archived | Choice | Options: Yes, No |

**To create a unique index on VisitKey**:
1. Click **VisitKey** column header
2. Select **Column settings**
3. Check **Enforce unique values**

### 3.3 Create OnCallSchedule List

1. Create new list: `OnCallSchedule`
2. Add columns:

| Column Name | Type |
|-------------|------|
| Date | Date and Time |
| Provider | Single line of text |
| Hospitals | Multiple lines of text |

### 3.4 Create Settings List

1. Create new list: `Settings`
2. Add columns:

| Column Name | Type |
|-------------|------|
| OnCall | Single line of text |
| Hospitals | Multiple lines of text |
| ComplianceMode | Choice (Options: relaxed, hipaa_strict, sox_strict) |

### 3.5 Create AuditLogs List

1. Create new list: `AuditLogs`
2. Add columns:

| Column Name | Type |
|-------------|------|
| UserIdentity | Single line of text |
| ActionType | Choice (Options: READ, CREATE, UPDATE, DELETE, EXPORT) |
| AffectedRecords | Multiple lines of text |
| Timestamp | Date and Time |
| Details | Multiple lines of text |

### 3.6 Get List IDs

For each list, copy the URL and extract the list ID:

```
URL format: /sites/clinical-rounding/Lists/{ListID}/AllItems.aspx
Extract the ListID part
```

Or use Graph API:

```bash
# Authenticate to Graph API
az login

# Get site ID
SITE_ID=$(az rest --method GET \
  --uri "https://graph.microsoft.com/v1.0/sites/yourdomain.sharepoint.com:/sites/clinical-rounding" \
  --query "id" -o tsv)

# Get list IDs
az rest --method GET \
  --uri "https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists" \
  --query "value[].{name:name, id:id}" -o table
```

Save all four list IDs:

```bash
PATIENTS_LIST_ID="..."
ONCALL_LIST_ID="..."
SETTINGS_LIST_ID="..."
AUDIT_LIST_ID="..."
```

---

## Step 4: Deploy Azure Functions API

### 4.1 Prepare API Code

```bash
# Clone or navigate to your repo with api/ folder
cd /path/to/clinical-rounding-repo

# Navigate to api folder
cd api

# Install dependencies
npm install

# Verify functions.json exists for each endpoint
ls -la */function.json
```

Should see:
```
patients/function.json
backfeed/function.json
onCallSchedule/function.json
settings/function.json
export/function.json
```

### 4.2 Test Locally (Optional)

```bash
# Start Functions locally
npm start

# Should output:
# Azure Functions Core Tools
# Worker process started and initialized
# Functions runtime started
```

In another terminal, test an endpoint:

```bash
curl http://localhost:7071/api/patients \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json"
```

### 4.3 Deploy to Azure

The deployment happens via GitHub Actions when you push:

```bash
# Commit and push to main branch
git add .
git commit -m "Deploy Clinical Rounding Azure migration"
git push origin main
```

GitHub Actions will:
1. Build the Functions project
2. Run npm install and build
3. Deploy to your Static Web App's /api endpoint
4. Logs available in GitHub Actions tab

**Verify deployment**:

```bash
# Check Functions health endpoint (if public)
curl https://<your-swa-hostname>/api/health

# Or check Azure Portal → Static Web App → Functions
```

---

## Step 5: Update HTML File

Follow the detailed instructions in **`HTML_INTEGRATION_GUIDE.md`**:

1. Replace Firebase SDK with MSAL.js
2. Add hospital dropdown to patient modal
3. Add "Copy from Previous Visit" button
4. Add hospital column to table
5. Wire up CSV import handler
6. Add Excel export function

**Estimated time**: 30-45 minutes

---

## Step 6: Deploy to Azure Static Web Apps

### 6.1 Prepare GitHub Repository

If not already done:

```bash
# Initialize git repo (if needed)
git init

# Add remote
git remote add origin https://github.com/YOUR_ORG/clinical-rounding-repo.git

# Create main branch
git branch -M main
```

### 6.2 Create GitHub Actions Workflow

Create `.github/workflows/azure-static-web-apps.yml`:

```yaml
name: Azure Static Web Apps CI/CD

on:
  push:
    branches: [ main ]
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches: [ main ]

env:
  APP_LOCATION: "/"
  API_LOCATION: "api"
  OUTPUT_LOCATION: ""

jobs:
  build_and_deploy_job:
    if: github.event_name == 'push' || (github.event_name == 'pull_request' && github.event.action != 'closed')
    runs-on: ubuntu-latest
    name: Build and Deploy Job
    steps:
      - uses: actions/checkout@v3
        with:
          submodules: true

      - name: Build And Deploy
        id: builddeploy
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: ${{ env.APP_LOCATION }}
          api_location: ${{ env.API_LOCATION }}
          output_location: ${{ env.OUTPUT_LOCATION }}

  close_pull_request_job:
    if: github.event_name == 'pull_request' && github.event.action == 'closed'
    runs-on: ubuntu-latest
    name: Close Pull Request Job
    steps:
      - name: Close Pull Request
        id: closepullrequest
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_TOKEN }}
          action: "close"
```

### 6.3 Push to GitHub

```bash
# Stage all changes
git add .

# Commit
git commit -m "Add Clinical Rounding Platform with Azure integration"

# Push to main
git push origin main
```

### 6.4 Link GitHub to Azure (if needed)

If deployment doesn't auto-trigger:

1. Azure Portal → Static Web Apps → Your app
2. Click **Settings** → **Deployment**
3. Click **Disconnect**, then **Connect**
4. Select GitHub organization, repository, branch

---

## Step 7: Configure Environment Variables

### 7.1 Add Secrets to GitHub Actions

1. GitHub → Your repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add:

```
AZURE_STATIC_WEB_APPS_TOKEN=<value from Azure Portal>
```

To get the token:
- Azure Portal → Static Web Apps → Your app
- Click **Manage deployment token**
- Copy the token

### 7.2 Add Environment Variables to Static Web App

1. Azure Portal → Static Web App → **Configuration** → **Application settings**
2. Click **Add** and add:

| Name | Value |
|------|-------|
| SHAREPOINT_SITE_ID | Your SharePoint site ID |
| PATIENTS_LIST_ID | From Step 3.6 |
| ONCALL_LIST_ID | From Step 3.6 |
| SETTINGS_LIST_ID | From Step 3.6 |
| AUDIT_LIST_ID | From Step 3.6 |
| AZURE_CLIENT_ID | From Step 2.2 |
| AZURE_TENANT_ID | From Step 2.2 |
| AZURE_CLIENT_SECRET | From Step 2.3 |

### 7.3 Get SharePoint Site ID

```bash
# Get your site ID
az rest --method GET \
  --uri "https://graph.microsoft.com/v1.0/sites/yourdomain.sharepoint.com:/sites/clinical-rounding" \
  --query "id" -o tsv
```

---

## Step 8: Verify Permissions

### 8.1 Grant Managed Identity Permissions to SharePoint

The Functions' Managed Identity needs permissions to access SharePoint Lists:

```bash
# Get the Managed Identity object ID
IDENTITY_OBJECT_ID=$(az staticwebapp identity show \
  --name clinical-rounding-app \
  --resource-group clinical-rounding-rg \
  --query principalId -o tsv)

# Note: Azure doesn't directly assign SharePoint permissions via CLI
# Instead, use the SharePoint admin center or PowerShell:

# PowerShell (run as admin):
$siteUrl = "https://yourdomain.sharepoint.com/sites/clinical-rounding"
$spAdmin = Connect-PnPOnline -Url $siteUrl -Interactive

# Grant full control to Managed Identity service principal
# (This is complex and typically done by SharePoint admin)
```

**Easier approach**: Give your Entra ID app **Sites.ReadWrite.All** permission (already done in Step 2.4), and the Functions will use the app's identity.

### 8.2 Verify Graph API Permissions

Ensure the app has these permissions (check Azure Portal):

- ✅ `Sites.ReadWrite.All` - Application
- ✅ `Files.ReadWrite.All` - Delegated
- ✅ `User.Read.All` - Application

---

## Step 9: Test End-to-End

### 9.1 Access the App

1. Navigate to: `https://<your-swa-hostname>`
2. You should see the login page

### 9.2 Test Login

1. Click **Sign In**
2. Enter your organizational email
3. Enter password
4. Verify you can sign in

### 9.3 Test Patient CRUD

1. Click **+ Add Patient**
2. Fill in patient form
3. Click **Save**
4. Verify patient appears in table
5. Click on patient to edit
6. Verify edit works
7. Test archive/restore

### 9.4 Test Data Sync

1. Open app in two browser windows (same user)
2. Add patient in Window 1
3. Verify it appears in Window 2 after ~15 seconds
4. Update patient in Window 2
5. Verify it reflects in Window 1

### 9.5 Test CSV Import

1. Download `Rounding List.csv` from your project
2. Click **Import**
3. Select the CSV file
4. Verify patients load
5. Check that on-call schedule updated

### 9.6 Test Excel Export

1. Click **Export to OneDrive**
2. Wait for success message
3. Check your OneDrive:
   - `/Clinical Rounding/Rounding List YYYY-MM-DD.xlsx`
   - `/Clinical Rounding/Rounding List - Latest.xlsx`
4. Verify file content

### 9.7 Test Role-Based Access

1. Assign yourself different roles (Admin → Clinician)
2. Sign out and sign back in
3. Verify:
   - Clinician: Can't see billing codes (show as ***)
   - Clinician: Can't delete patients
   - Billing: Sees billing codes
   - Admin: Full access

### 9.8 Check Audit Logs

1. Go to SharePoint → **AuditLogs** list
2. Verify entries for each action (create, update, delete)
3. Check timestamps and user identity

---

## Post-Deployment

### 10.1 Monitoring

Set up alerts for your Static Web App:

```bash
# Azure CLI: Create alert for 5xx errors
az monitor metrics alert create \
  --name "Clinical Rounding 5xx Errors" \
  --resource-group clinical-rounding-rg \
  --scopes $(az staticwebapp show --name clinical-rounding-app --resource-group clinical-rounding-rg --query id -o tsv) \
  --condition "avg Http5xx > 1" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action myactiongroup
```

### 10.2 Backup SharePoint Data

Set up recurring backups:

1. SharePoint Admin Center → **Backup and migration**
2. Configure automated backup schedule (weekly/monthly)
3. Export to OneDrive

### 10.3 Security Hardening

#### Conditional Access

1. Entra ID → **Security** → **Conditional Access**
2. Create policy:
   - Users/groups: Clinical staff
   - Conditions: Require MFA, restrict locations, block legacy auth
   - Grant: Require MFA, compliant device (if needed)

#### API Rate Limiting

Azure Functions automatically rate-limit. To customize:

1. Azure Portal → Static Web App → **Configuration**
2. Add custom rate limit rules (if supported)

#### Enable Audit Logging

Ensure SharePoint audit is enabled:

1. SharePoint Admin Center → **Settings** → **Audit**
2. Ensure **Record all activities** is selected

### 10.4 User Onboarding

1. Create new Entra ID users
2. Assign app roles (clinician/billing/admin)
3. Send them the app URL and USERGUIDE.md
4. Schedule training session

### 10.5 Documentation

Keep updated:

- [x] `USERGUIDE.md` - For end users
- [x] `AZURE_MIGRATION.md` - For architects
- [x] `HTML_INTEGRATION_GUIDE.md` - For developers
- [x] `INSTALLATION_GUIDE.md` - This file
- [ ] Create runbook for common admin tasks (optional)

### 10.6 Regular Maintenance

Schedule recurring tasks:

| Task | Frequency | Owner |
|------|-----------|-------|
| Review audit logs | Weekly | Admin |
| Update Entra ID roles | As needed | Admin |
| Backup SharePoint | Monthly | IT Ops |
| Review error logs | Daily | Dev Team |
| Security patches | Immediately | IT Ops |

---

## Troubleshooting Installation

### Problem: GitHub Actions deployment fails

**Solution**:
1. Check GitHub Actions logs (Repo → Actions tab)
2. Verify `azure-static-web-apps.yml` exists in `.github/workflows/`
3. Ensure `AZURE_STATIC_WEB_APPS_TOKEN` secret is set
4. Check that `api/` folder has `function.json` for each endpoint

### Problem: Functions return 401 Unauthorized

**Solution**:
1. Verify `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_CLIENT_SECRET` are set in configuration
2. Check that Entra ID app has Graph API permissions
3. Ensure app roles (clinician/billing/admin) are assigned to users

### Problem: SharePoint List items not syncing

**Solution**:
1. Verify list IDs in configuration are correct (copy from URL)
2. Check that Managed Identity has permissions
3. Test Graph API directly with token:
   ```bash
   curl https://graph.microsoft.com/v1.0/sites/{SITE_ID}/lists/{LIST_ID}/items \
     -H "Authorization: Bearer $TOKEN"
   ```

### Problem: CSV import fails

**Solution**:
1. Verify CSV format matches template (Row 1-3: on-call, Row 4: headers, Row 5+: data)
2. Check browser console (F12) for error messages
3. Ensure MRN is unique (no duplicates with same date)

### Problem: OneDrive export shows permission error

**Solution**:
1. Verify user has OneDrive access
2. Create `/Clinical Rounding` folder in OneDrive manually
3. Check that `Files.ReadWrite` permission is granted to Entra ID app
4. Run `az ad app permission admin-consent` to grant admin consent

---

## Post-Installation Checklist

- [ ] Azure Static Web App created and deployed
- [ ] Entra ID app registered with client ID and secret
- [ ] SharePoint site created with 4 lists
- [ ] All list IDs captured and added to configuration
- [ ] Managed Identity enabled on Static Web App
- [ ] Permissions granted (Sites.ReadWrite.All, Files.ReadWrite.All)
- [ ] GitHub Actions workflow file created
- [ ] Environment variables configured in Static Web App
- [ ] HTML file updated with Azure integration
- [ ] Functions deployed successfully
- [ ] Login works with organizational account
- [ ] Patient CRUD operations verified
- [ ] CSV import tested
- [ ] Excel export to OneDrive tested
- [ ] Role-based access tested (clinician/billing/admin)
- [ ] Audit logs verified
- [ ] User roles assigned in Entra ID
- [ ] USERGUIDE.md shared with end users
- [ ] Backup and monitoring configured
- [ ] Security hardening applied (MFA, Conditional Access)

---

## Support & Escalation

### Common Issues

For detailed troubleshooting, see:
- **AZURE_MIGRATION.md** - Architecture and deployment details
- **HTML_INTEGRATION_GUIDE.md** - Frontend troubleshooting
- **USERGUIDE.md** - User-reported issues

### Escalation Path

1. **Development Issue** → Dev team → Check logs in Functions
2. **Permission Issue** → IT Admin → Check Entra ID and SharePoint permissions
3. **Performance Issue** → Azure support → Scale up Functions or optimize queries
4. **Data Issue** → Backup team → Restore from SharePoint backup

---

## References

- [Azure Static Web Apps Documentation](https://learn.microsoft.com/en-us/azure/static-web-apps/)
- [Azure Functions Node.js Guide](https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-node)
- [Microsoft Graph API](https://learn.microsoft.com/en-us/graph/api/overview)
- [SharePoint Lists REST API](https://learn.microsoft.com/en-us/sharepoint/dev/sp-add-ins/working-with-lists-and-list-items-with-rest)
- [Entra ID App Roles](https://learn.microsoft.com/en-us/azure/active-directory/develop/howto-add-app-roles-in-apps)

---

## Version History

**v1.0** (Jan 2026) - Initial installation guide for Azure/M365 migration

---

**Last Updated**: January 12, 2026

For support, contact your IT administrator or development team.
