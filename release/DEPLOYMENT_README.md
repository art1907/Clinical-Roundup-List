# Clinical Rounding Platform - Deployment Package

## Contents

This release package contains everything needed to deploy the Clinical Rounding Platform:

### Core Files (Required)
- `clinical-rounding-adaptive.html` - Main application (single-page HTML app)
- `m365-integration.js` - Microsoft 365 integration module
- `INSTALLATION_GUIDE.md` - Complete setup instructions
- `USERGUIDE.md` - End-user documentation

### Sample Data (Optional)
- `samples/data/Rounding List.csv` - Example CSV file for testing bulk import

## Quick Deployment

### Option 1: Local Testing (Immediate)
1. Open `clinical-rounding-adaptive.html` in any modern web browser
2. App runs in **Local Mode** (no setup needed, data in browser memory)
3. Test all features: add patients, import CSV, export Excel

---

### Option 2: Web Server Deployment

#### 2A. IIS (Windows Server)
1. **Install IIS** (if not already installed):
   - Server Manager → Add Roles → Web Server (IIS)
   
2. **Create Application Directory**:
   ```
   C:\inetpub\wwwroot\clinical-rounding\
   ```
   
3. **Copy Files**:
   - Extract all files from release package to the directory above
   
4. **Configure MIME Types** (IIS Manager):
   - Open IIS Manager → Select Site → MIME Types
   - Ensure these exist:
     - `.html` → `text/html`
     - `.js` → `application/javascript`
     - `.css` → `text/css`
   
5. **Enable HTTPS** (Recommended):
   - IIS Manager → Site → Bindings → Add HTTPS binding
   - Add SSL certificate (self-signed for testing, CA-signed for production)
   
6. **Set Permissions**:
   - Right-click folder → Properties → Security
   - Grant `IIS_IUSRS` read access
   
7. **Access Application**:
   - Local: `http://localhost/clinical-rounding/clinical-rounding-adaptive.html`
   - Network: `http://your-server/clinical-rounding/clinical-rounding-adaptive.html`

#### 2B. Apache (Linux/Windows)
1. **Install Apache** (if not already installed):
   ```bash
   # Ubuntu/Debian
   sudo apt install apache2
   
   # CentOS/RHEL
   sudo yum install httpd
   ```
   
2. **Create Application Directory**:
   ```bash
   sudo mkdir /var/www/html/clinical-rounding
   ```
   
3. **Copy Files**:
   ```bash
   sudo cp -r release/* /var/www/html/clinical-rounding/
   sudo chown -R www-data:www-data /var/www/html/clinical-rounding
   sudo chmod -R 755 /var/www/html/clinical-rounding
   ```
   
4. **Configure Apache** (optional - create virtual host):
   ```bash
   sudo nano /etc/apache2/sites-available/clinical-rounding.conf
   ```
   
   Add:
   ```apache
   <VirtualHost *:80>
       ServerName clinical-rounding.yourdomain.com
       DocumentRoot /var/www/html/clinical-rounding
       
       <Directory /var/www/html/clinical-rounding>
           Options -Indexes +FollowSymLinks
           AllowOverride None
           Require all granted
       </Directory>
       
       ErrorLog ${APACHE_LOG_DIR}/clinical-rounding-error.log
       CustomLog ${APACHE_LOG_DIR}/clinical-rounding-access.log combined
   </VirtualHost>
   ```
   
5. **Enable Site & Restart**:
   ```bash
   sudo a2ensite clinical-rounding.conf
   sudo systemctl reload apache2
   ```
   
6. **Access Application**:
   - `http://your-server/clinical-rounding/clinical-rounding-adaptive.html`

#### 2C. Nginx (Linux)
1. **Install Nginx**:
   ```bash
   sudo apt install nginx
   ```
   
2. **Create Application Directory**:
   ```bash
   sudo mkdir /var/www/clinical-rounding
   sudo cp -r release/* /var/www/clinical-rounding/
   sudo chown -R www-data:www-data /var/www/clinical-rounding
   ```
   
3. **Configure Nginx**:
   ```bash
   sudo nano /etc/nginx/sites-available/clinical-rounding
   ```
   
   Add:
   ```nginx
   server {
       listen 80;
       server_name clinical-rounding.yourdomain.com;
       root /var/www/clinical-rounding;
       index clinical-rounding-adaptive.html;
       
       location / {
           try_files $uri $uri/ =404;
       }
       
       location ~* \.(js|css|html)$ {
           expires 1d;
           add_header Cache-Control "public, immutable";
       }
   }
   ```
   
4. **Enable & Restart**:
   ```bash
   sudo ln -s /etc/nginx/sites-available/clinical-rounding /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

#### 2D. Python Simple Server (Testing Only)
```bash
# Navigate to release folder
cd release

# Python 3
python -m http.server 8080

# Access at http://localhost:8080/clinical-rounding-adaptive.html
```

---

### Option 3: SharePoint Deployment

#### 3A. Upload to SharePoint Document Library (Simple)
1. **Navigate to SharePoint Site**:
   - Go to your SharePoint site (e.g., `https://yourcompany.sharepoint.com/sites/clinical`)
   
2. **Create or Select Document Library**:
   - Site Contents → + New → Document Library
   - Name: "Clinical Rounding App"
   
3. **Upload Files**:
   - Click Upload → Files
   - Select all files from `release/` folder
   - Upload `clinical-rounding-adaptive.html` and `m365-integration.js`
   
4. **Access Application**:
   - Click `clinical-rounding-adaptive.html` in document library
   - Opens in browser with SharePoint authentication
   - Works in Local Mode by default

#### 3B. SharePoint with M365 Integration (Full Setup)
1. **Create SharePoint Lists** (for data storage):
   
   **List 1: Patients**
   - Site Contents → + New → List → Blank List → Name: "Patients"
   - Add columns (all Single line of text except where noted):
     - `VisitKey` (Single line, Enforce unique values: Yes)
     - `Room`, `Date` (Date and time), `Name`, `DOB`, `MRN`
     - `Hospital` (Choice: WGMC, AWC, BTMC, Westgate, CRMC, AHD, BEMC)
     - `FindingsData` (Multiple lines of text)
     - `FindingsText` (Multiple lines of text)
     - `Plan` (Multiple lines of text)
     - `SupervisingMD`, `Pending`, `FollowUp`
     - `Priority` (Choice: Yes, No)
     - `ProcedureStatus` (Choice: To-Do, In-Progress, Completed, Post-Op)
     - `CPTPrimary`, `ICDPrimary`
     - `ChargeCodesSecondary` (Multiple lines of text)
     - `CreatedBy` (Single line of text)
     - `Archived` (Choice: Yes, No)
   
   **List 2: OnCallSchedule**
   - Create list named "OnCallSchedule"
   - Columns: `Date` (Date and time), `Provider`, `Hospitals` (Multiple lines)
   
   **List 3: Settings**
   - Create list named "Settings"
   - Columns: `Key` (Single line), `Value` (Multiple lines)
   
   **List 4: AuditLogs** (Optional)
   - Create list named "AuditLogs"
   - Columns: `UserIdentity`, `ActionType`, `RecordId`, `Details`, `Timestamp` (Date and time)

2. **Get List IDs**:
   - Each list → Settings → Copy URL
   - Extract GUID from URL: `...Lists/{GUID}/...`
   - Or use PowerShell:
     ```powershell
     Connect-PnPOnline -Url "https://yourcompany.sharepoint.com/sites/clinical" -Interactive
     Get-PnPList | Select-Object Title, Id
     ```

3. **Get SharePoint Site ID**:
   - Navigate to: `https://graph.microsoft.com/v1.0/sites/yourcompany.sharepoint.com:/sites/clinical`
   - Copy the `id` field value

4. **Create Entra ID App Registration**:
   - Go to Azure Portal → Entra ID → App registrations → + New registration
   - Name: "Clinical Rounding Platform"
   - Supported account types: "Accounts in this organizational directory only"
   - Redirect URI: `https://yourcompany.sharepoint.com/sites/clinical/ClinicalRoundingApp/clinical-rounding-adaptive.html`
   - Click Register
   - Copy **Application (client) ID** and **Directory (tenant) ID**
   
5. **Configure API Permissions**:
   - App registration → API permissions → + Add a permission
   - Microsoft Graph → Delegated permissions
   - Add: `Sites.ReadWrite.All`, `Files.ReadWrite`, `User.Read`
   - Click "Grant admin consent"

6. **Update Configuration**:
   - Download `m365-integration.js` from SharePoint library
   - Edit configuration section:
   ```javascript
   const M365_CONFIG = {
       auth: {
           clientId: 'YOUR_CLIENT_ID_HERE',  // From step 4
           authority: 'https://login.microsoftonline.com/YOUR_TENANT_ID_HERE',  // From step 4
           redirectUri: 'https://yourcompany.sharepoint.com/sites/clinical/...'
       },
       sharepoint: {
           siteId: 'YOUR_SITE_ID_HERE',  // From step 3
           lists: {
               patients: 'PATIENTS_LIST_ID',  // From step 2
               onCallSchedule: 'ONCALL_LIST_ID',  // From step 2
               settings: 'SETTINGS_LIST_ID',  // From step 2
               auditLogs: 'AUDIT_LIST_ID'  // From step 2 (optional)
           }
       },
       // ... rest of config
   };
   ```
   - Save and re-upload to SharePoint

7. **Test M365 Integration**:
   - Open `clinical-rounding-adaptive.html` from SharePoint
   - Should prompt for M365 login
   - After authentication, data syncs to SharePoint Lists
   - Check connection status at top (should show "Connected")

---

### Option 4: Microsoft 365 Integration (Any Web Server)
Follow Option 3B steps 1-6, but:
- Deploy HTML/JS files to your web server (Option 2)
- Update `redirectUri` to match your web server URL:
  ```javascript
  redirectUri: 'https://your-server/clinical-rounding/clinical-rounding-adaptive.html'
  ```
- Users access app via web server URL
- App authenticates with M365 and syncs data to SharePoint Lists

## System Requirements

### Browser Support
- Chrome 90+
- Edge 90+
- Safari 14+
- Firefox 88+

### For M365 Integration
- Microsoft 365 E3 license (or higher)
- SharePoint Online
- Entra ID (Azure AD)
- OneDrive for Business

## Zero Dependencies

No installation, no npm, no build process:
- Pure HTML + JavaScript + Tailwind CSS (CDN)
- All libraries loaded from CDN
- Works offline after first load
- No server-side code required

## Security Features

### Built-in
- Role-based access control (RBAC)
- Field-level data masking
- Audit logging (when M365 connected)
- Session management
- Compliance modes: relaxed, HIPAA-strict, SOX-strict

### M365 Integration
- Entra ID authentication (SSO)
- SharePoint security & permissions
- Microsoft DLP policies apply automatically
- Audit logs via SharePoint

## Data Storage

### Local Mode
- Browser localStorage (500 records cached)
- No persistence after browser clear
- Perfect for testing/demos

### M365 Mode
- SharePoint Lists (30M item limit per list)
- OneDrive for Excel exports
- Automatic backups via SharePoint
- Retention policies configurable

## File Size

Total package: ~1.5 MB
- HTML: ~800 KB (includes all UI)
- m365-integration.js: ~35 KB
- Documentation: ~600 KB

## Troubleshooting

### "Cannot load m365-integration.js"
- Ensure both HTML and JS files are in same directory
- Check web server MIME types include `.js` → `application/javascript`

### "Access Denied" on SharePoint
- Verify SharePoint library permissions (Read access minimum)
- Check that users have SharePoint site access

### M365 Login Fails
- Verify `clientId` and `tenantId` in m365-integration.js
- Check Redirect URI matches exactly in Entra ID app
- Ensure API permissions granted and admin consented

### Data Not Syncing
- Check browser console (F12) for errors
- Verify SharePoint List IDs are correct
- Confirm user has Edit permissions on SharePoint Lists

### HTTPS Required for M365
- M365 authentication requires HTTPS in production
- Use self-signed cert for testing, CA-signed for production
- Or deploy to SharePoint (HTTPS automatic)

## Support & Updates

For complete setup assistance, refer to `INSTALLATION_GUIDE.md`
For usage instructions, refer to `USERGUIDE.md`

## Post-Deployment Checklist

- [ ] Application accessible via URL/SharePoint
- [ ] Users can open HTML file in browser
- [ ] Local Mode works (add patient, import CSV)
- [ ] If M365: Login prompts appear
- [ ] If M365: Data syncs to SharePoint Lists
- [ ] If M365: On-call schedule saves/loads
- [ ] Excel export downloads successfully
- [ ] Multiple users can access simultaneously

## Version

Release Date: January 2026
Version: 1.0.0
Architecture: Pure Microsoft 365 (no Azure Functions/backend)

---

**Ready to Deploy**: Copy all files to your web server or SharePoint document library and open the HTML file.
