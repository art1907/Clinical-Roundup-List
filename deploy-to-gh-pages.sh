#!/bin/bash
# Manual deployment script for copying SPA files from main to gh-pages
# This script can be run locally to manually deploy the SPA files

set -e  # Exit on error

echo "🚀 Clinical Rounding List - Manual Deployment to gh-pages"
echo "=========================================================="

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Error: Not in a git repository"
    exit 1
fi

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
echo "📍 Current branch: $CURRENT_BRANCH"

# Check for uncommitted changes
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "⚠️  Warning: You have uncommitted changes"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Checkout main branch
echo "🔄 Switching to main branch..."
git checkout main
git pull origin main

# Create temporary directory for SPA files
TEMP_DIR=$(mktemp -d)
echo "📦 Copying SPA files to temporary directory: $TEMP_DIR"

# Copy SPA files
cp clinical-rounding-adaptive.html "$TEMP_DIR/"
cp azure-integration.js "$TEMP_DIR/"
cp m365-integration.js "$TEMP_DIR/"
cp staticwebapp.config.json "$TEMP_DIR/"

# Create index.html redirect
cat > "$TEMP_DIR/index.html" << 'EOF'
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0; url=clinical-rounding-adaptive.html">
  <title>Clinical Rounding List</title>
</head>
<body>
  <p>Redirecting to <a href="clinical-rounding-adaptive.html">Clinical Rounding List</a>...</p>
</body>
</html>
EOF

# Create .nojekyll file
touch "$TEMP_DIR/.nojekyll"

echo "📋 Files prepared:"
ls -lh "$TEMP_DIR"

# Checkout gh-pages branch
echo "🔄 Switching to gh-pages branch..."
if ! git show-ref --verify --quiet refs/heads/gh-pages; then
    echo "📝 Creating gh-pages branch..."
    git checkout --orphan gh-pages
    git rm -rf .
else
    git checkout gh-pages
    git pull origin gh-pages
fi

# Copy files from temporary directory
echo "📥 Copying files to gh-pages branch..."
cp "$TEMP_DIR"/* .

# Clean up temporary directory
rm -rf "$TEMP_DIR"

# Check if there are changes to commit
if git diff --quiet && git diff --cached --quiet; then
    echo "ℹ️  No changes to commit - gh-pages is already up to date"
else
    # Add and commit changes
    echo "💾 Committing changes..."
    git add clinical-rounding-adaptive.html \
           azure-integration.js \
           m365-integration.js \
           staticwebapp.config.json \
           index.html \
           .nojekyll
    
    git commit -m "Deploy SPA files from main (manual deployment - $(date +%Y-%m-%d))"
    
    # Push to origin
    echo "⬆️  Pushing to origin/gh-pages..."
    git push origin gh-pages
    
    echo "✅ Successfully deployed to gh-pages!"
fi

# Switch back to original branch
echo "🔄 Switching back to $CURRENT_BRANCH..."
git checkout "$CURRENT_BRANCH"

echo ""
echo "=========================================================="
echo "✨ Deployment complete!"
echo "🌐 Your site will be available at:"
echo "   https://[username].github.io/Clinical-Roundup-List/"
echo "=========================================================="
