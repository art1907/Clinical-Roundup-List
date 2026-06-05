# Clinical Rounding Platform - Configuration Checklist

This file lists all configuration entries required to let users access and use the patient list.

## 1. Access Models

Choose one deployment mode:

1. Local-only mode (no user access control, no cloud sync)
2. M365 browser mode (recommended): Entra login + SharePoint Lists + Graph API from browser
3. Azure Static Web App mode (optional): hosted frontend + Azure Functions + SharePoint backend

---

## 2. Tenant-Level Configuration (One-Time)

Complete these once per environment (Dev/Test/Prod).

## 2.1 Entra App Registration

Portal URLs:

1. Entra Admin Center: https://entra.microsoft.com
2. Azure Portal App Registrations: https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade

Required entries:

1. Application name: Clinical Rounding Platform
2. Supported account type: Single tenant (organization only)
3. Redirect URIs (SPA):
   1. http://localhost:3000/clinical-rounding-adaptive.html
   2. Production app URL (SharePoint-hosted or Azure Static Web App URL)

Capture and store:

1. CLIENT_ID = Application (client) ID
2. TENANT_ID = Directory (tenant) ID

Required delegated Graph permissions:

1. Sites.ReadWrite.All
2. Files.ReadWrite
3. User.Read

Action required:

1. Grant admin consent for tenant

Optional app roles (if RBAC enforced):

1. clinician
2. billing
3. admin

---

## 2.2 SharePoint Site + Lists

Portal URLs:

1. SharePoint Admin Center: https://admin.microsoft.com/Adminportal/Home#/SharePoint
2. SharePoint site root pattern: https://<tenant>.sharepoint.com/sites/<site-name>

Required site:

1. Clinical Rounding site (Team or Communication site)

Capture and store:

1. SHAREPOINT_SITE_ID

Required lists and IDs:

1. PATIENTS_LIST_ID
2. ONCALL_LIST_ID
3. SETTINGS_LIST_ID
4. AUDIT_LIST_ID (optional but recommended)

Critical list requirement:

1. Patients list column VisitKey must enforce unique values

Useful tool URL to fetch IDs:

1. Graph Explorer: https://developer.microsoft.com/graph/graph-explorer

Common Graph calls:

1. GET https://graph.microsoft.com/v1.0/sites/<tenant>.sharepoint.com:/sites/<site-name>
2. GET https://graph.microsoft.com/v1.0/sites/<site-id>/lists

---

## 3. App Configuration Entries

Current app reads config from [m365-integration.js](../m365-integration.js).

## 3.1 M365_CONFIG (Browser Mode)

Set these entries in M365_CONFIG:

1. auth.clientId = CLIENT_ID
2. auth.authority = https://login.microsoftonline.com/<TENANT_ID>
3. auth.redirectUri = exact app URL users open
4. sharepoint.siteId = SHAREPOINT_SITE_ID
5. sharepoint.lists.patients = PATIENTS_LIST_ID
6. sharepoint.lists.onCallSchedule = ONCALL_LIST_ID
7. sharepoint.lists.settings = SETTINGS_LIST_ID
8. sharepoint.lists.auditLogs = AUDIT_LIST_ID (optional)
9. scopes = [Sites.ReadWrite.All, Files.ReadWrite, User.Read]

Optional entries:

1. sharepoint.drives.patientDocuments (if document library integration is used)
2. pollInterval (default 15000)

---

## 3.2 Azure Static Web App Configuration (Optional Hosting)

Portal URL:

1. Azure Static Web Apps blade: https://portal.azure.com/#view/HubsExtension/BrowseResource/resourceType/Microsoft.Web%2FstaticSites

If using Azure SWA + Functions, set app settings:

1. SHAREPOINT_SITE_ID
2. PATIENTS_LIST_ID
3. ONCALL_LIST_ID
4. SETTINGS_LIST_ID
5. AUDIT_LIST_ID
6. AZURE_TENANT_ID
7. AZURE_CLIENT_ID
8. AZURE_CLIENT_SECRET

Also verify SWA auth issuer in [staticwebapp.config.json](staticwebapp.config.json):

1. openIdIssuer = https://login.microsoftonline.com/<TENANT_ID>/v2.0

---

## 4. Per-User Access Entries (Every User)

Each user must have all required identity and SharePoint access configured.

## 4.1 User Identity and License

Portals:

1. M365 Admin Users: https://admin.microsoft.com/Adminportal/Home#/users
2. Entra Users: https://entra.microsoft.com/#view/Microsoft_AAD_IAM/UsersManagementMenuBlade/~/AllUsers

Required entries per user:

1. Active Entra user account
2. Valid M365 license including SharePoint Online
3. MFA policy assignment (recommended/required by org)

## 4.2 App Assignment / Role Assignment

Portals:

1. Entra Enterprise Apps: https://entra.microsoft.com/#view/Microsoft_AAD_IAM/StartboardApplicationsMenuBlade/~/AppAppsPreview
2. App Registration roles view: Entra app -> Users and groups

Required entries per user:

1. User assigned to app (if assignment required)
2. Role assignment (clinician, billing, or admin) if RBAC is used

## 4.3 SharePoint Site Permissions

Portal pattern:

1. https://<tenant>.sharepoint.com/sites/<site-name>/_layouts/15/user.aspx

Required entries per user/group:

1. Site membership with at least edit rights for clinical users
2. Read rights only for viewers (if needed)
3. Owners/admin group for administrators

Recommendation:

1. Use Entra security groups mapped to SharePoint groups instead of individual user grants

---

## 5. Copy/Paste Configuration Template

Fill this section for your environment:

1. ENVIRONMENT_NAME =
2. APP_URL =
3. CLIENT_ID =
4. TENANT_ID =
5. AUTHORITY_URL = https://login.microsoftonline.com/<TENANT_ID>
6. REDIRECT_URI =
7. SHAREPOINT_SITE_URL =
8. SHAREPOINT_SITE_ID =
9. PATIENTS_LIST_ID =
10. ONCALL_LIST_ID =
11. SETTINGS_LIST_ID =
12. AUDIT_LIST_ID =
13. DOCUMENTS_DRIVE_ID =
14. RBAC_ENABLED = Yes/No
15. DEFAULT_USER_ROLE = clinician

Per-user onboarding template:

1. USER_UPN =
2. LICENSE_ASSIGNED = Yes/No
3. MFA_ENABLED = Yes/No
4. APP_ASSIGNED = Yes/No
5. ROLE_ASSIGNED = clinician/billing/admin
6. SHAREPOINT_PERMISSION = Read/Edit/Owner
7. ACCESS_VERIFIED = Yes/No

---

## 6. Validation Checklist (Go-Live)

1. User can open app URL
2. User can sign in successfully
3. User sees Connected status in app
4. User can read patient list
5. User can create/update a patient
6. User can load tabs (Census, Surgical, Calendar, Staffing, Timeline, Analytics)
7. User role restrictions behave correctly (if RBAC enabled)
8. Audit log entries are being written (if enabled)

---

## 7. Quick Reference URLs

1. Microsoft 365 Admin Center: https://admin.microsoft.com
2. Azure Portal: https://portal.azure.com
3. Entra Admin Center: https://entra.microsoft.com
4. SharePoint Admin Center: https://admin.microsoft.com/Adminportal/Home#/SharePoint
5. Graph Explorer: https://developer.microsoft.com/graph/graph-explorer
6. Azure Static Web Apps docs: https://learn.microsoft.com/azure/static-web-apps/
7. MSAL.js docs: https://learn.microsoft.com/entra/msal/javascript/browser/
8. Microsoft Graph overview: https://learn.microsoft.com/graph/overview

---

## 8. Notes for This Repository

1. Active app configuration currently lives in [m365-integration.js](../m365-integration.js).
2. Main app file is [clinical-rounding-adaptive.html](../clinical-rounding-adaptive.html).
3. Azure hosting guidance is in [AZURE_DEPLOY_QUICKSTART.md](AZURE_DEPLOY_QUICKSTART.md) and [AZURE_STATIC_WEB_APP_DEPLOYMENT.md](AZURE_STATIC_WEB_APP_DEPLOYMENT.md).
4. Installation baseline is in [INSTALLATION_GUIDE.md](INSTALLATION_GUIDE.md).
