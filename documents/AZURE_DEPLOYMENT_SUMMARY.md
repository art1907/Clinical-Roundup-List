# ✅ Azure Static Web Apps - Ready to Deploy!

## 📦 What's Included (Already in Your Repo)

Your Clinical Rounding application is **fully configured** for Azure Static Web Apps deployment:

### ✅ Configuration Files
- **`staticwebapp.config.json`** - Azure SWA configuration with Entra ID auth
- **`.github/workflows/azure-static-web-apps.yml`** - GitHub Actions workflow for CI/CD
- **`api/` folder** - Azure Functions backend (Node.js 18)
- **`api/host.json`** - Azure Functions runtime configuration

### ✅ Documentation Created
1. **[AZURE_DEPLOY_QUICKSTART.md](./AZURE_DEPLOY_QUICKSTART.md)** - 15-minute deployment checklist
2. **[AZURE_STATIC_WEB_APP_DEPLOYMENT.md](./AZURE_STATIC_WEB_APP_DEPLOYMENT.md)** - Complete deployment guide (600+ lines)
3. **Updated [README.md](../README.md)** - Added deployment options section

### ✅ Existing Documentation (Referenced)
- **[_archive/AZURE_MIGRATION.md](../_archive/AZURE_MIGRATION.md)** - Architecture details
- **[INSTALLATION_GUIDE.md](./INSTALLATION_GUIDE.md)** - General installation instructions
- **[USERGUIDE.md](./USERGUIDE.md)** - End-user documentation
- **[M365_MIGRATION.md](./M365_MIGRATION.md)** - M365 integration details

---

## 🚀 Next Steps (What You Need to Do)

### Step 1: Deploy to Azure (15 minutes)

**Easiest Path: Azure Portal**

1. Go to https://portal.azure.com
2. Click **"Create a resource"** → Search **"Static Web App"**
3. Fill in:
   - **Name**: `clinical-rounding-app` (or your choice)
   - **Region**: Choose closest to your users
   - **Source**: GitHub
   - **Sign in to GitHub** and authorize
   - **Repository**: `Clinical-Roundup-List`
   - **Branch**: `main`
   - **App location**: `/`
   - **API location**: `api`
   - **Output location**: `` (leave empty)
4. Click **"Create"**

Azure will:
- ✅ Create your Static Web App
- ✅ Auto-generate GitHub Actions workflow (if not already present)
- ✅ Deploy automatically
- ✅ Give you a URL: `https://your-app-name.azurestaticapps.net`

⏱️ **Takes ~3-5 minutes**

---

### Step 2: Set Up Entra ID Authentication (5 minutes)

1. **Entra ID** → **App registrations** → **New registration**
2. **Name**: `Clinical Rounding App`
3. **Redirect URI**: `https://YOUR-APP-NAME.azurestaticapps.net/.auth/login/aad/callback`
4. **Create client secret**, note:
   - Application (client) ID
   - Directory (tenant) ID
   - Client secret value
5. **Create app roles**: `clinician`, `billing`, `admin`

---

### Step 3: Create SharePoint Lists (5 minutes)

Create 4 lists in your SharePoint site:
1. **Patients** (main patient records)
2. **OnCallSchedule** (on-call schedule)
3. **Settings** (app settings)
4. **AuditLogs** (compliance audit trail)

📖 **See full schemas in**: [AZURE_STATIC_WEB_APP_DEPLOYMENT.md](./AZURE_STATIC_WEB_APP_DEPLOYMENT.md#3b-create-lists)

Get List IDs using [Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer):
```
GET https://graph.microsoft.com/v1.0/sites/{tenant}.sharepoint.com:/sites/{site-name}
GET https://graph.microsoft.com/v1.0/sites/{site-id}/lists
```

---

### Step 4: Configure Environment Variables (2 minutes)

In Azure Portal → Your Static Web App → **Configuration** → Add:

```
SHAREPOINT_SITE_ID=your-site-id-from-graph
PATIENTS_LIST_ID=your-patients-list-id
ONCALL_LIST_ID=your-oncall-list-id
SETTINGS_LIST_ID=your-settings-list-id
AUDIT_LIST_ID=your-audit-list-id
AZURE_TENANT_ID=your-entra-tenant-id
AZURE_CLIENT_ID=your-app-registration-client-id
AZURE_CLIENT_SECRET=your-client-secret-value
```

---

### Step 5: Update Config & Deploy (2 minutes)

1. **Edit `staticwebapp.config.json`** in your repo:
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

3. **GitHub Actions automatically deploys!** 🎉

Check deployment status: GitHub → **Actions** tab

---

### Step 6: Test! (5 minutes)

1. Go to `https://your-app-name.azurestaticapps.net`
2. Sign in with organizational account
3. Test key features:
   - Add patient
   - Import CSV (`samples/data/Rounding List.csv`)
   - Export Excel
   - On-call schedule
   - Archive patient
4. Verify SharePoint lists show new data

---

## 🎯 Quick Deploy Summary

| Step | Time | Tool |
|------|------|------|
| 1. Create Azure SWA | 5 min | Azure Portal |
| 2. Configure Entra ID | 5 min | Entra ID Portal |
| 3. Create SharePoint Lists | 5 min | SharePoint |
| 4. Add Environment Vars | 2 min | Azure Portal |
| 5. Update Config & Push | 2 min | Git |
| 6. Test | 5 min | Web Browser |
| **TOTAL** | **~25 min** | |

---

## 💰 Cost Breakdown

| Service | Tier | Monthly Cost |
|---------|------|--------------|
| Azure Static Web Apps | Free | $0 |
| Azure Functions API | Consumption | $0-5 |
| SharePoint Lists | M365 | Included |
| Entra ID | Free | $0 |
| **TOTAL** | | **$0-5/month** |

**Free tier limits** (sufficient for 10-50 users):
- 100 GB bandwidth/month
- 1M API requests/month
- Unlimited storage (SharePoint)

---

## 📚 Documentation Files

### For Deployment
- **[AZURE_DEPLOY_QUICKSTART.md](./AZURE_DEPLOY_QUICKSTART.md)** ← Start here! (checklist)
- **[AZURE_STATIC_WEB_APP_DEPLOYMENT.md](./AZURE_STATIC_WEB_APP_DEPLOYMENT.md)** ← Complete guide (troubleshooting, security)

### For Architecture
- **[_archive/AZURE_MIGRATION.md](../_archive/AZURE_MIGRATION.md)** - Architecture decisions
- **[M365_MIGRATION.md](./M365_MIGRATION.md)** - SharePoint integration details
- **[AGENTS.md](../AGENTS.md)** - Development conversation log

### For Users
- **[USERGUIDE.md](./USERGUIDE.md)** - How to use the app
- **[INSTALLATION_GUIDE.md](./INSTALLATION_GUIDE.md)** - M365 setup (if not using Azure)

---

## ✨ What You Get with Azure Static Web Apps

✅ **Automatic HTTPS** - SSL certificate auto-provisioned and renewed  
✅ **Global CDN** - Fast loading from anywhere in the world  
✅ **CI/CD** - Push to GitHub → auto-deploy (no manual steps)  
✅ **Staging Environments** - Every PR gets a preview URL  
✅ **Built-in Auth** - Entra ID authentication integrated  
✅ **Scalable API** - Azure Functions backend scales automatically  
✅ **Zero DevOps** - No servers to manage, no infrastructure to maintain  
✅ **Cost Effective** - Free tier covers most use cases  

---

## 🔐 Security Features

✅ All traffic encrypted (HTTPS enforced)  
✅ Entra ID organizational authentication  
✅ Role-based access control (clinician/billing/admin)  
✅ API secured with authenticated routes only  
✅ Client secrets stored in Azure (never in code)  
✅ Audit logging to SharePoint  
✅ 15-minute session timeout  

**Recommended:** Enable MFA (Multi-Factor Authentication) for all users

---

## 🆘 Need Help?

### Common Issues

**"401 Unauthorized"**
→ Check `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` in Configuration

**"Can't connect to SharePoint"**
→ Verify SharePoint IDs correct, check API permissions in Entra ID

**"GitHub Actions failing"**
→ Check Actions tab, ensure `api/package.json` exists with dependencies

**"Users can't see billing codes"**
→ Assign `billing` or `admin` role in Entra ID → Enterprise Apps

### Resources

- **Full Troubleshooting**: [AZURE_STATIC_WEB_APP_DEPLOYMENT.md](./AZURE_STATIC_WEB_APP_DEPLOYMENT.md#troubleshooting)
- **Azure Docs**: https://learn.microsoft.com/en-us/azure/static-web-apps/
- **Microsoft Graph**: https://learn.microsoft.com/en-us/graph/
- **Your User Guide**: [USERGUIDE.md](./USERGUIDE.md)

---

## 🎉 Ready to Go!

Your app is **100% ready** for Azure Static Web Apps deployment. Just follow the 5 steps above and you'll be live in ~25 minutes!

**Start here:** [AZURE_DEPLOY_QUICKSTART.md](./AZURE_DEPLOY_QUICKSTART.md)

---

**Questions?** Check the comprehensive guide: [AZURE_STATIC_WEB_APP_DEPLOYMENT.md](./AZURE_STATIC_WEB_APP_DEPLOYMENT.md)

**Good luck with your deployment! 🚀**
