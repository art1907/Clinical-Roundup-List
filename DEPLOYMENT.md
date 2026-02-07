# GitHub Pages Deployment

This document explains how the Clinical Rounding List SPA files are automatically deployed to the `gh-pages` branch for GitHub Pages hosting.

## Automated Deployment

A GitHub Actions workflow (`.github/workflows/deploy-gh-pages.yml`) automatically copies SPA files from the `main` branch to the `gh-pages` branch whenever changes are pushed to the main branch.

### Files Automatically Deployed

The following SPA files are copied from `main` to `gh-pages`:

1. **clinical-rounding-adaptive.html** - Main application HTML file
2. **azure-integration.js** - Azure backend integration module
3. **m365-integration.js** - Microsoft 365 integration module  
4. **staticwebapp.config.json** - Static web app configuration

### Additional Files

The workflow also creates:

- **index.html** - A simple redirect page that forwards to `clinical-rounding-adaptive.html`
- **.nojekyll** - Prevents Jekyll processing on GitHub Pages

## Triggering a Deployment

Deployments are triggered automatically when:

1. Changes are pushed to any of the SPA files listed above on the `main` branch
2. The workflow is manually triggered via the "Actions" tab in GitHub

## Manual Deployment

### Option 1: Using the Deployment Script (Recommended)

The easiest way to manually deploy is using the provided script:

```bash
./deploy-to-gh-pages.sh
```

This script will:
1. Save your current branch
2. Switch to main and pull latest changes
3. Copy SPA files to a temporary directory
4. Switch to gh-pages branch
5. Copy files and commit changes
6. Push to origin
7. Switch back to your original branch

### Option 2: Manual Steps

If you need to manually deploy the SPA files to `gh-pages`:

```bash
# 1. Ensure you're on the main branch
git checkout main

# 2. Copy the SPA files to a temporary location
mkdir -p /tmp/spa-deploy
cp clinical-rounding-adaptive.html /tmp/spa-deploy/
cp azure-integration.js /tmp/spa-deploy/
cp m365-integration.js /tmp/spa-deploy/
cp staticwebapp.config.json /tmp/spa-deploy/

# 3. Switch to gh-pages branch
git checkout gh-pages

# 4. Copy files from temporary location
cp /tmp/spa-deploy/* .

# 5. Commit and push
git add clinical-rounding-adaptive.html azure-integration.js \
        m365-integration.js staticwebapp.config.json
git commit -m "Manual deployment from main"
git push origin gh-pages

# 6. Switch back to main
git checkout main
```

## GitHub Pages Configuration

To enable GitHub Pages for this repository:

1. Go to **Settings** > **Pages**
2. Under "Build and deployment":
   - Source: Deploy from a branch
   - Branch: `gh-pages`
   - Folder: `/ (root)`
3. Save the configuration

The application will be available at: `https://[username].github.io/Clinical-Roundup-List/`

## Workflow Permissions

The deployment workflow requires:
- **contents: write** permission to push to the `gh-pages` branch

This is configured in the workflow file.

## Troubleshooting

### Workflow fails with permission errors
- Check that the workflow has `contents: write` permission
- Verify that GitHub Actions has permission to push to protected branches (if `gh-pages` is protected)

### Changes not appearing on GitHub Pages
- Check the Actions tab to see if the workflow ran successfully
- GitHub Pages can take a few minutes to update after a push
- Clear your browser cache or try in an incognito/private window

### SPA files not updating
- Verify that the files were changed on the `main` branch
- Check that the file paths in the workflow match the actual file names
- Manually trigger the workflow from the Actions tab

## Related Documentation

- [INSTALLATION_GUIDE.md](../INSTALLATION_GUIDE.md) - Setup instructions for M365 integration
- [README.md](../README.md) - Project overview and features
- [M365_MIGRATION.md](../M365_MIGRATION.md) - M365 architecture details
