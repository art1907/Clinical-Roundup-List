# Netlify Deployment Guide - Clinical Rounding Platform

## Quick Deploy (2 minutes)

### Option 1: Drag & Drop (Easiest)
1. Go to [Netlify](https://netlify.com)
2. Sign up or log in
3. Drag & drop the `release/` folder onto the deploy area
4. Done! App is live

### Option 2: Git Integration (Recommended for Teams)
1. Create GitHub repo with these files:
   - `index.html` (renamed from `clinical-rounding-adaptive.html`)
   - `m365-integration.js`
   - `netlify.toml` (required!)
   - `USERGUIDE.md`

2. Go to [Netlify](https://netlify.com)
3. Click "New site from Git"
4. Connect to GitHub repository
5. Netlify auto-deploys on push

### Option 3: Netlify CLI
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Navigate to release folder
cd release

# Deploy
netlify deploy --prod
```

---

## Setup Checklist

### Files Required
- [ ] `index.html` (or keep original name + netlify.toml handles routing)
- [ ] `m365-integration.js` (MUST be in same folder)
- [ ] `netlify.toml` (required for SPA routing)

### What to Do
1. **Rename HTML file** (optional):
   ```
   clinical-rounding-adaptive.html → index.html
   ```
   OR leave as is - netlify.toml handles it

2. **Ensure m365-integration.js exists** in same folder
   - If missing, download from release package

3. **Upload netlify.toml** to Netlify:
   - Required for tab navigation to work
   - Configures SPA routing

---

## Why Tabs Weren't Working

**Problem**: Single Page App (SPA) routing was broken
- When you clicked a tab, browser tried to navigate to `/calendar`, `/staffing`, etc.
- Netlify didn't know to serve `index.html` for these routes
- Resulted in 404 Not Found

**Solution**: `netlify.toml` redirects all routes back to `index.html`
- App loads once
- JavaScript handles tab navigation
- No page reloads needed

---

## Common Issues & Fixes

### Issue 1: "Cannot find m365-integration.js"
**Cause**: File not uploaded to Netlify
**Fix**:
1. Go to Netlify dashboard → Site settings
2. Deploy → Deploys → Trigger deploy
3. Select all files including `m365-integration.js`

### Issue 2: Tabs Still Not Working
**Cause**: `netlify.toml` not configured
**Fix**:
1. Download `netlify.toml` from release package
2. Go to Netlify dashboard → Deploy → Upload files
3. Upload `netlify.toml` to root
4. Trigger redeploy

### Issue 3: Styles Look Broken
**Cause**: Tailwind CSS CDN issue
**Fix**:
- Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
- Clear browser cache
- Check browser console (F12) for errors

### Issue 4: M365 Authentication Not Working
**Cause**: Redirect URI mismatch
**Fix**:
1. Get your Netlify URL (e.g., `https://your-app.netlify.app`)
2. Update `m365-integration.js`:
   ```javascript
   redirectUri: 'https://your-app.netlify.app/index.html'
   ```
3. Update Entra ID app registration with new Redirect URI
4. Redeploy

---

## Performance Tips

1. **Enable Netlify Edge Functions** (free tier):
   - Netlify dashboard → Site settings → Edge Functions
   - Faster response times

2. **Enable Netlify Analytics** (optional, paid):
   - Track app usage

3. **Set up custom domain** (optional):
   - Netlify dashboard → Domain management
   - Much more professional

---

## After Deployment

### Test Your App
1. Open your Netlify URL in browser
2. Click through all tabs (Census, Surgical, Calendar, Staffing, Archive)
3. All should open without page reload
4. Add a test patient
5. Try importing CSV

### Share with Team
- Send URL to your team
- Works on desktop, tablet, mobile
- No installation needed
- All data stored in browser (Local Mode) or SharePoint (M365 Mode)

---

## Size & Performance

- App size: ~234 KB (HTML)
- JS: ~25 KB
- Total: ~260 KB
- Load time: < 1 second (CDN cached)
- No build process needed
- Instant deploys

---

## Rollback / Deployment History

All deployments saved:
1. Netlify dashboard → Deploy log
2. Click any previous deploy to restore
3. Instant rollback if needed

---

## Support

For issues:
1. Check browser console (F12)
2. Check Netlify deploy logs: Dashboard → Deploy log
3. Verify both files uploaded: Dashboard → Site files
4. Test with simple static HTML first

**Verify Deployment Success:**
```bash
# Test from command line
curl https://your-site.netlify.app/index.html
curl https://your-site.netlify.app/m365-integration.js

# Both should return 200 OK
```
