# Verify Vercel Git Connection

## Current Git Status
- **Repository**: Check output above
- **Current Branch**: `main` (likely)
- **Latest Commit**: Check output above

## How to Verify in Vercel Dashboard

### 1. Check Git Integration
1. Go to Vercel Dashboard → Your Project → **Settings** → **Git**
2. Verify:
   - **Repository**: Should match your GitHub repo URL
   - **Production Branch**: Should be `main` (or `master`)
   - **Latest Commit**: Should show the latest commit hash

### 2. Check Deployment Source
1. Go to Vercel Dashboard → Your Project → **Deployments** tab
2. Click on the **latest deployment**
3. Check:
   - **Commit**: Should match your latest commit hash
   - **Branch**: Should be `main`
   - **Author**: Should match your GitHub username

### 3. Verify Files Are in Repository
The file should be in GitHub:
- Go to: `https://github.com/[your-username]/[repo-name]/blob/main/app/api/webhooks/facebook/route.ts`
- Verify the file exists and has content

### 4. Check Root Directory Setting
1. Go to Vercel Dashboard → Your Project → **Settings** → **General**
2. Scroll to "Build & Development Settings"
3. Check **"Root Directory"**:
   - Should be `.` (root) or **empty**
   - If it's set to a subdirectory, that's the problem!

### 5. Common Issues

#### Issue: Root Directory is Wrong
**Symptom**: Vercel is looking in a subdirectory
**Fix**: Set Root Directory to `.` or empty

#### Issue: Wrong Branch
**Symptom**: Vercel is deploying from `master` but you're pushing to `main`
**Fix**: Update Production Branch to `main` in Settings → Git

#### Issue: Wrong Repository
**Symptom**: Vercel is connected to a different repo
**Fix**: Reconnect to the correct repository

#### Issue: Files Not in Git
**Symptom**: Files exist locally but aren't committed
**Fix**: Ensure all files are committed and pushed

## Quick Test
Check if the file exists in GitHub:
```bash
# Replace with your actual GitHub URL
https://github.com/princecjqlara/tokko/blob/main/app/api/webhooks/facebook/route.ts
```

If the file doesn't exist in GitHub, that's the problem!


