# Azure Static Web Apps Deployment Guide

## Prerequisites

- ✅ Azure subscription
- ✅ Git repository (you have this!)
- ✅ Azure CLI installed ([Download](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli))
- ✅ GitHub account with repo access

## Quick Deployment (5 Minutes)

### Option 1: Azure Portal (Recommended for First Time)

#### Step 1: Create Static Web App

1. Go to [Azure Portal](https://portal.azure.com)
2. Click **"Create a resource"** → Search **"Static Web App"**
3. Click **"Create"**

#### Step 2: Configure Deployment

**Basics Tab:**
- **Subscription**: Select your Azure subscription
- **Resource Group**: Create new: `clinical-rounding-rg`
- **Name**: `clinical-rounding-app` (must be globally unique)
- **Plan type**: Free (perfect for this app)
- **Region**: Choose closest to your users (e.g., East US, West Europe)

**GitHub Integration:**
- **Source**: GitHub
- **Sign in** to GitHub and authorize Azure
- **Organization**: Your GitHub username/org
- **Repository**: `Clinical-Roundup-List`
- **Branch**: `main`

**Build Details:**
- **Build Presets**: Custom
- **App location**: `/` (root directory)
- **Api location**: `api` (your API functions folder)
- **Output location**: `` (leave empty - no build step needed)

#### Step 3: Review and Create

- Click **"Review + Create"**
- Review settings
- Click **"Create"**

Azure will:
1. ✅ Create the Static Web App resource
2. ✅ Auto-create GitHub Actions workflow (`.github/workflows/azure-static-web-apps-*.yml`)
3. ✅ Commit workflow to your repo
4. ✅ Trigger first deployment automatically

**Deployment takes ~2-3 minutes**

---

### Option 2: Azure CLI (Advanced Users)

```powershell
# Login to Azure
az login

# Create resource group
az group create `
  --name clinical-rounding-rg `
  --location eastus

# Create Static Web App
az staticwebapp create `
  --name clinical-rounding-app `
  --resource-group clinical-rounding-rg `
  --source https://github.com/art1907/Clinical-Roundup-List `
  --location eastus `
  --branch main `
  --app-location "/" `
  --api-location "api" `
  --output-location "" `
  --login-with-github

# Get deployment URL
az staticwebapp show `
  --name clinical-rounding-app `
  --resource-group clinical-rounding-rg `
  --query "defaultHostname" -o tsv
```

---

## Post-Deployment Configuration

### 1. Configure Environment Variables

Go to Azure Portal → Your Static Web App → **Configuration** → **Application settings**

Add these variables:

```
SHAREPOINT_SITE_ID=<your-sharepoint-site-id>
PATIENTS_LIST_ID=<patients-list-id>
ONCALL_LIST_ID=<oncall-schedule-list-id>
SETTINGS_LIST_ID=<settings-list-id>
AUDIT_LIST_ID=<audit-logs-list-id>
AZURE_TENANT_ID=<your-entra-id-tenant-id>
AZURE_CLIENT_ID=<entra-app-registration-client-id>
AZURE_CLIENT_SECRET=<entra-app-client-secret>
```

**How to get these values:**
- SharePoint IDs: See "Getting SharePoint IDs" section below
- Tenant ID: Entra ID → Overview → Tenant ID
- Client ID/Secret: See "Entra ID Setup" section below

---

### 2. Entra ID (Azure AD) Setup

#### 2A. Register Application

1. Go to [Entra ID](https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade) → **App registrations**
2. Click **"New registration"**
3. Configure:
   - **Name**: `Clinical Rounding App`
   - **Supported account types**: "Accounts in this organizational directory only"
   - **Redirect URI**: 
     - Type: Web
     - URI: `https://<your-app-name>.azurestaticapps.net/.auth/login/aad/callback`
   - Click **"Register"**

4. **Note the values:**
   - **Application (client) ID** - You'll need this for `AZURE_CLIENT_ID`
   - **Directory (tenant) ID** - You'll need this for `AZURE_TENANT_ID`

#### 2B. Create Client Secret

1. In your app registration → **Certificates & secrets**
2. Click **"New client secret"**
3. Description: `Clinical Rounding SWA`
4. Expires: 24 months (or your preference)
5. Click **"Add"**
6. **Copy the secret VALUE immediately** (you'll need for `AZURE_CLIENT_SECRET`)

#### 2C. Configure App Roles

1. In your app registration → **App roles**
2. Create three roles:

**Role 1: Clinician**
- Display name: `Clinician`
- Allowed member types: Users/Groups
- Value: `clinician`
- Description: `Clinical staff - can view/edit patient records (no billing access)`

**Role 2: Billing**
- Display name: `Billing`
- Allowed member types: Users/Groups
- Value: `billing`
- Description: `Billing staff - can view all fields including billing codes`

**Role 3: Admin**
- Display name: `Admin`
- Allowed member types: Users/Groups
- Value: `admin`
- Description: `Administrators - full access including delete and settings`

#### 2D. Assign Users to Roles

1. Go to **Enterprise applications** → Find "Clinical Rounding App"
2. Click **Users and groups** → **Add user/group**
3. Select user → Select role → Assign

#### 2E. Update staticwebapp.config.json

In your repo, update `staticwebapp.config.json`:

```json
{
  "auth": {
    "identityProviders": {
      "azureActiveDirectory": {
        "registration": {
          "openIdIssuer": "https://login.microsoftonline.com/<YOUR_TENANT_ID>/v2.0",
          "clientIdSettingName": "AZURE_CLIENT_ID",
          "clientSecretSettingName": "AZURE_CLIENT_SECRET"
        }
      }
    }
  }
}
```

Replace `<YOUR_TENANT_ID>` with your actual tenant ID.

Commit and push:
```bash
git add staticwebapp.config.json
git commit -m "Configure Entra ID tenant"
git push origin main
```

---

### 3. Create SharePoint Lists

#### 3A. Create SharePoint Site

1. Go to [SharePoint](https://admin.microsoft.com/sharepoint)
2. Create a site: **"Clinical Rounding Data"** (or use existing)

#### 3B. Create Lists

Create 4 lists with these exact schemas:

**List 1: Patients**

| Column Name | Type | Settings |
|-------------|------|----------|
| Title | Single line text | (Auto) |
| VisitKey | Single line text | **Enforce unique values = Yes** |
| Room | Single line text | |
| Date | Date and Time | Format: Date only |
| Name | Single line text | |
| DOB | Single line text | |
| MRN | Single line text | Indexed = Yes |
| Hospital | Choice | Choices: WGMC, AWC, BTMC, SGMC, BHH |
| FindingsData | Multiple lines text | Plain text |
| FindingsText | Multiple lines text | Plain text |
| Plan | Multiple lines text | Enhanced rich text |
| SupervisingMD | Person or Group | Single user |
| Pending | Multiple lines text | Plain text |
| FollowUp | Multiple lines text | Plain text |
| Priority | Choice | Yes, No |
| ProcedureStatus | Choice | To-Do, In-Progress, Completed, Post-Op |
| CPTPrimary | Single line text | |
| ICDPrimary | Single line text | |
| ChargeCodesSecondary | Multiple lines text | Plain text |
| Archived | Choice | Yes, No (Default: No) |

**List 2: OnCallSchedule**

| Column Name | Type |
|-------------|------|
| Title | Single line text |
| Date | Date and Time |
| Provider | Single line text |
| Hospitals | Multiple lines text |

**List 3: Settings**

| Column Name | Type |
|-------------|------|
| Title | Single line text |
| OnCall | Single line text |
| Hospitals | Multiple lines text |
| ComplianceMode | Choice (relaxed, hipaa_strict, sox_strict) |

**List 4: AuditLogs**

| Column Name | Type |
|-------------|------|
| Title | Single line text |
| UserIdentity | Single line text |
| ActionType | Choice (READ, CREATE, UPDATE, DELETE, EXPORT) |
| AffectedRecords | Multiple lines text |
| Timestamp | Date and Time |
| Details | Multiple lines text |

#### 3C. Get SharePoint Site ID and List IDs

**Method 1: Graph Explorer (Easiest)**

1. Go to [Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer)
2. Sign in with your admin account
3. Run queries:

```
# Get Site ID
GET https://graph.microsoft.com/v1.0/sites/{your-tenant}.sharepoint.com:/sites/{site-name}

# Example:
GET https://graph.microsoft.com/v1.0/sites/contoso.sharepoint.com:/sites/ClinicalRoundingData

# Response includes: "id": "contoso.sharepoint.com,abc-123-def,xyz-789" 
# This whole string is your SHAREPOINT_SITE_ID

# Get List IDs (replace {site-id} with the ID above)
GET https://graph.microsoft.com/v1.0/sites/{site-id}/lists

# Response includes all lists with their IDs:
# - "name": "Patients", "id": "abc-123..."
# - "name": "OnCallSchedule", "id": "def-456..."
# etc.
```

**Method 2: PowerShell**

```powershell
# Install Microsoft Graph PowerShell SDK
Install-Module Microsoft.Graph -Scope CurrentUser

# Connect
Connect-MgGraph -Scopes "Sites.Read.All"

# Get Site ID
$site = Get-MgSite -Search "Clinical Rounding Data"
$siteId = $site.Id
Write-Host "Site ID: $siteId"

# Get List IDs
$lists = Get-MgSiteList -SiteId $siteId
$lists | Select-Object DisplayName, Id
```

**Method 3: From SharePoint URL**

The List ID is in the URL when you view a list:
```
https://{tenant}.sharepoint.com/sites/{site}/Lists/{list-name}/AllItems.aspx?viewid={list-id}
```

---

### 4. Grant API Permissions

Your Azure Functions API needs permission to access SharePoint:

1. Go to Entra ID → **App registrations** → Your app
2. Click **API permissions** → **Add a permission**
3. Choose **Microsoft Graph** → **Application permissions**
4. Add these permissions:
   - `Sites.ReadWrite.All` (for SharePoint Lists)
   - `User.Read.All` (for user lookups)
5. Click **"Grant admin consent"** (requires admin)

---

### 5. Install API Dependencies

Your API functions need npm packages. Azure will install automatically on deployment, but verify `api/package.json` exists:

```json
{
  "dependencies": {
    "@microsoft/microsoft-graph-client": "^3.0.0",
    "isomorphic-fetch": "^3.0.0"
  }
}
```

If missing, add it and push:
```bash
cd api
npm install @microsoft/microsoft-graph-client isomorphic-fetch
git add api/package.json api/package-lock.json
git commit -m "Add API dependencies"
git push origin main
```

---

## Testing Your Deployment

### 1. Access Your App

Go to: `https://<your-app-name>.azurestaticapps.net`

You should see the login page (Entra ID sign-in).

### 2. Test Authentication

- Sign in with an organizational account
- Verify you're redirected to the app after login
- Check browser console for errors

### 3. Test Functionality

- **Add patient** - Fill form, save
- **View patients** - See patient list
- **Import CSV** - Upload `Rounding List.csv`
- **Export Excel** - Download Excel file
- **On-Call schedule** - Add/edit on-call provider
- **Archive** - Archive a patient

### 4. Verify SharePoint Integration

Check SharePoint → Your site → Lists:
- Patients list should show new records
- OnCallSchedule should reflect changes
- AuditLogs should capture actions

---

## Troubleshooting

### Issue: "401 Unauthorized" on API Calls

**Cause**: API permissions not granted or client secret incorrect

**Fix**:
1. Verify `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID` in Configuration
2. Check Entra ID app → API permissions → Ensure "Grant admin consent" clicked
3. Check Managed Identity has Graph permissions

---

### Issue: "Unable to connect to SharePoint"

**Cause**: SharePoint IDs incorrect or Graph permissions missing

**Fix**:
1. Verify SharePoint IDs in Configuration (use Graph Explorer to reconfirm)
2. Check API permissions in Entra ID app registration
3. Test Graph API manually: [Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer)

---

### Issue: Users Can't See Billing Codes

**Cause**: User role not assigned correctly

**Fix**:
1. Go to Entra ID → Enterprise applications → Clinical Rounding App
2. Users and groups → Verify user has `billing` or `admin` role
3. User needs to log out and back in for role to take effect

---

### Issue: GitHub Actions Deployment Failing

**Cause**: Build configuration incorrect

**Fix**:
1. Check GitHub → Actions tab → View failed workflow
2. Common issues:
   - Node version mismatch (should be 18)
   - Missing npm dependencies (check `api/package.json`)
   - Incorrect file paths in workflow YAML

---

### Issue: Custom Domain Not Working

**Fix**: Azure Static Web Apps supports custom domains.

1. Go to Azure Portal → Your Static Web App → **Custom domains**
2. Click **"Add"** → **"Custom domain on other DNS"**
3. Add your domain (e.g., `rounding.yourdomain.com`)
4. Azure will provide CNAME/TXT records
5. Add records to your DNS provider
6. Wait for validation (up to 24 hours)

---

## Monitoring & Logs

### View Deployment Logs

**GitHub Actions**:
- Go to your repo → **Actions** tab
- Click latest workflow run
- View build logs

**Azure Portal**:
- Your Static Web App → **Functions** → **Application Insights**
- View requests, failures, performance

---

## Updating the App

All updates are automatic via GitHub Actions:

```bash
# Make changes to your code
git add .
git commit -m "Update feature XYZ"
git push origin main

# GitHub Actions automatically:
# 1. Builds the app
# 2. Deploys to Azure
# 3. Updates live site (takes ~2 minutes)
```

---

## Cost Breakdown

| Service | Tier | Cost/Month |
|---------|------|------------|
| Azure Static Web Apps | Free | $0 |
| Azure Functions (API) | Consumption | $0-5 |
| SharePoint Lists | M365 license | Included |
| Entra ID | Free | $0 |
| **Total** | | **$0-5/month** |

**Free tier limits** (sufficient for 10-50 users):
- 100 GB bandwidth/month
- Unlimited bandwidth from API
- 1 million API requests/month
- 400,000 GB-seconds compute/month

---

## Next Steps

✅ Deploy to Azure Static Web Apps (complete!)  
✅ Configure Entra ID authentication  
✅ Create SharePoint Lists  
✅ Test with real users  
⬜ Setup custom domain (optional)  
⬜ Enable Application Insights monitoring (optional)  
⬜ Configure backup/retention policies  

---

## Support & Resources

- **Azure Static Web Apps Docs**: https://learn.microsoft.com/en-us/azure/static-web-apps/
- **Microsoft Graph API**: https://learn.microsoft.com/en-us/graph/
- **Entra ID App Registration**: https://learn.microsoft.com/en-us/azure/active-directory/develop/
- **Your Documentation**: See `USERGUIDE.md`, `INSTALLATION_GUIDE.md`

---

## Security Checklist

- ✅ HTTPS enforced (automatic with Azure SWA)
- ✅ Entra ID authentication required
- ✅ Role-based access control (RBAC) configured
- ✅ API secured with authenticated routes
- ✅ Client secrets stored in Azure Configuration (not in code)
- ✅ Audit logging enabled (SharePoint AuditLogs list)
- ✅ Session timeout configured (15 minutes)
- ⬜ Enable MFA for all users (recommended)
- ⬜ Review Entra ID Conditional Access policies

---

**Deployment Date**: _____________  
**Deployed By**: _____________  
**App URL**: `https://_______________.azurestaticapps.net`
