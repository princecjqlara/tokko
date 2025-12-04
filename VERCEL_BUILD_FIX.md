# Fix: Vercel Not Building API Routes

## Problem
- ✅ Local build shows all API routes (including `/api/webhooks/facebook`)
- ❌ Vercel build only shows pages, no API routes

## Solution Applied
1. Removed empty `app/api/auth/callback/facebook/` directory
2. Committed and pushed changes to trigger new build

## Next Steps

### 1. Clear Vercel Build Cache
**CRITICAL:** Vercel might be using a cached build that doesn't include API routes.

1. Go to Vercel Dashboard → Your Project → **Settings** → **General**
2. Scroll to "Build & Development Settings"
3. Click **"Clear Build Cache"**
4. Go to **Deployments** tab
5. Click **"..."** on the latest deployment
6. Click **"Redeploy"**
7. **IMPORTANT:** Uncheck **"Use existing Build Cache"**
8. Click **"Redeploy"**

### 2. Verify Build Output
After redeploy, check the build logs again. You should now see:
```
Route (app)
├ ƒ /api/webhooks/facebook    ← Should appear!
├ ƒ /api/facebook/pages
├ ƒ /api/auth/[...nextauth]
...
```

### 3. Check Vercel Project Settings
1. Go to Vercel Dashboard → Your Project → **Settings** → **General**
2. Verify:
   - **Framework Preset**: `Next.js`
   - **Build Command**: `next build` (or auto-detected)
   - **Output Directory**: `.next` (or auto-detected)
   - **Root Directory**: `.` (root)

### 4. Verify Git Integration
1. Go to **Settings** → **Git**
2. Verify:
   - **Repository**: Correct repo
   - **Production Branch**: `main`
   - **Latest Commit**: Should show the new commit

## Why This Happens
Vercel sometimes caches build outputs. If the API routes weren't in an earlier commit, Vercel might be using a cached build that doesn't include them.

## Alternative: Force Rebuild
If clearing cache doesn't work:
1. Make a small change to trigger rebuild:
   ```bash
   echo "// Force rebuild" >> next.config.ts
   git add next.config.ts
   git commit -m "Force Vercel rebuild"
   git push origin main
   ```

## Expected Result
After clearing cache and redeploying, the build logs should show all API routes, and `/api/webhooks/facebook` should be accessible.


