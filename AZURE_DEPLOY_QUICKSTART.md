# 🚀 Azure Static Web Apps - Quick Deploy Checklist

## ✅ Pre-Deployment (You Have This!)

- [x] Git repository ready
- [x] `staticwebapp.config.json` configured
- [x] API functions in `api/` folder
- [x] GitHub Actions workflow created

---

## 📋 Deployment Steps (15 Minutes)

### Step 1: Create Azure Static Web App (5 min)

**Option A: Azure Portal** (Recommended)
1. Go to https://portal.azure.com
2. Create Resource → "Static Web App"
3. Configure:
   - **Name**: `clinical-rounding-app`
   - **Region**: Choose closest to users
   - **Source**: GitHub
   - **Repo**: `Clinical-Roundup-List`
   - **Branch**: `main`
   - **App location**: `/`
   - **API location**: `api`
   - **Output**: `` (empty)
4. Create

**Option B: Azure CLI**
```powershell
az login
az staticwebapp create --name clinical-rounding-app --resource-group clinical-rounding-rg --source https://github.com/art1907/Clinical-Roundup-List --location eastus --branch main --app-location "/" --api-location "api" --output-location "" --login-with-github
```

---

### Step 2: Register Entra ID App (5 min)

1. **Entra ID** → **App registrations** → **New registration**
2. **Name**: `Clinical Rounding App`
3. **Redirect URI**: `https://YOUR-APP-NAME.azurestaticapps.net/.auth/login/aad/callback`
4. **Create app roles**:
   - `clinician` - Clinical staff
   - `billing` - Billing staff
   - `admin` - Administrators
5. **Create client secret** → Copy value
6. **Note**: Application (client) ID, Directory (tenant) ID

---

### Step 3: Create SharePoint Lists (5 min)

Create 4 lists in SharePoint:

1. **Patients** - Patient records (see full schema in [AZURE_STATIC_WEB_APP_DEPLOYMENT.md](./AZURE_STATIC_WEB_APP_DEPLOYMENT.md#3b-create-lists))
2. **OnCallSchedule** - On-call provider schedule
3. **Settings** - App settings (default provider, hospitals)
4. **AuditLogs** - Audit trail for compliance

**Get List IDs:**
- Use [Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer):
  ```
  GET https://graph.microsoft.com/v1.0/sites/{tenant}.sharepoint.com:/sites/{site-name}
  GET https://graph.microsoft.com/v1.0/sites/{site-id}/lists
  ```

---

### Step 4: Configure Environment Variables (2 min)

Azure Portal → Your Static Web App → **Configuration** → Add:

```
SHAREPOINT_SITE_ID=your-site-id
PATIENTS_LIST_ID=patients-list-id
ONCALL_LIST_ID=oncall-list-id
SETTINGS_LIST_ID=settings-list-id
AUDIT_LIST_ID=audit-list-id
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=app-registration-client-id
AZURE_CLIENT_SECRET=client-secret-value
```

---

### Step 5: Update Config & Deploy (2 min)

1. **Update `staticwebapp.config.json`**:
   ```json
   "openIdIssuer": "https://login.microsoftonline.com/<YOUR_TENANT_ID>/v2.0"
   ```
   Replace `<YOUR_TENANT_ID>` with your actual tenant ID.

2. **Commit and push**:
   ```bash
   git add staticwebapp.config.json
   git commit -m "Configure Entra ID tenant"
   git push origin main
   ```

3. **GitHub Actions auto-deploys!** ✨

---

## 🧪 Testing (5 min)

1. **Access**: `https://YOUR-APP-NAME.azurestaticapps.net`
2. **Sign in** with organizational account
3. **Test features**:
   - ✅ Add patient
   - ✅ Import CSV
   - ✅ Export Excel
   - ✅ On-call schedule
   - ✅ Archive patient
4. **Verify SharePoint**: Check lists for new records

---

## 📚 Detailed Documentation

- **Full Deployment Guide**: [AZURE_STATIC_WEB_APP_DEPLOYMENT.md](./AZURE_STATIC_WEB_APP_DEPLOYMENT.md)
- **Architecture Details**: [_archive/AZURE_MIGRATION.md](./_archive/AZURE_MIGRATION.md)
- **User Guide**: [USERGUIDE.md](./USERGUIDE.md)
- **Installation**: [INSTALLATION_GUIDE.md](./INSTALLATION_GUIDE.md)

---

## 🔍 Quick Troubleshooting

| Issue | Fix |
|-------|-----|
| 401 Unauthorized | Check `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` in Configuration |
| Can't connect to SharePoint | Verify SharePoint IDs, check API permissions in Entra ID |
| GitHub Actions failing | Check Actions tab, verify `api/package.json` exists |
| Users can't see billing | Assign correct role in Entra ID → Enterprise Apps |

---

## 💰 Cost

**Total: $0-5/month**
- Static Web Apps: Free tier
- Azure Functions: ~$0-5 (consumption plan)
- SharePoint/Entra ID: Included in M365 license

---

## 🎯 What Azure Does Automatically

✅ HTTPS certificate (auto-renewed)  
✅ GitHub Actions CI/CD workflow  
✅ Staging environments for PRs  
✅ Global CDN distribution  
✅ Built-in authentication  
✅ Auto-scaling  

---

## 🔐 Security Notes

- ✅ All traffic HTTPS (enforced)
- ✅ Entra ID authentication required
- ✅ Role-based access control (RBAC)
- ✅ API secured with authenticated routes
- ✅ Secrets stored in Azure (not in code)
- ✅ Audit logging enabled
- ⚠️ **Recommended**: Enable MFA for all users

---

## 📞 Support

**Need help?** See detailed troubleshooting in [AZURE_STATIC_WEB_APP_DEPLOYMENT.md](./AZURE_STATIC_WEB_APP_DEPLOYMENT.md#troubleshooting)

**Azure Support**: https://learn.microsoft.com/en-us/azure/static-web-apps/

---

**Ready to deploy?** Start with Step 1 above! ☝️
