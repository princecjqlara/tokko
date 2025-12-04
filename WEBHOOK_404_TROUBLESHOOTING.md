# Webhook 404 Troubleshooting Guide

## Current Status
- ✅ Code pushed to GitHub (commit `7825be0`)
- ✅ Route file exists: `app/api/webhooks/facebook/route.ts`
- ✅ Route file is in git commit
- ✅ Local build succeeds and detects the route
- ❌ Vercel deployment returns 404 for `/api/webhooks/facebook`

## Possible Causes & Solutions

### 1. Vercel Build Cache Issue
**Solution:** Clear build cache and redeploy
1. Go to Vercel Dashboard → Your Project → Settings → General
2. Scroll to "Build & Development Settings"
3. Click "Clear Build Cache"
4. Go to Deployments → Click "Redeploy" on latest deployment

### 2. Route Not Included in Build
**Check:** Verify the route is in the build output
1. Go to Vercel Dashboard → Your Project → Latest Deployment
2. Click "View Build Logs"
3. Look for the route in the build output (should show `ƒ /api/webhooks/facebook`)
4. If it's missing, there may be a build error

### 3. Environment Variable Missing
**Check:** Verify `FACEBOOK_WEBHOOK_VERIFY_TOKEN` is set
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Verify `FACEBOOK_WEBHOOK_VERIFY_TOKEN` exists
3. Make sure it's set for **Production** environment
4. If missing, add it and redeploy

### 4. Next.js Route Recognition Issue
**Solution:** Try accessing with different path
- Try: `https://tokko-official.vercel.app/api/webhooks/facebook/` (with trailing slash)
- Check Vercel Function logs for any errors

### 5. Deployment Propagation Delay
**Solution:** Wait a few minutes
- Sometimes Vercel takes 2-5 minutes to fully propagate routes
- Try again after 5 minutes

### 6. Check Vercel Function Logs
**Action:** Check for runtime errors
1. Go to Vercel Dashboard → Your Project → Functions tab
2. Look for `/api/webhooks/facebook`
3. Check for any error messages
4. If you see errors, they'll indicate the issue

### 7. Verify Route Structure
The route should be:
```
app/
  api/
    webhooks/
      facebook/
        route.ts  ← Must export GET and POST
```

### 8. Manual Test in Vercel Dashboard
1. Go to Vercel Dashboard → Your Project → Functions
2. Find `/api/webhooks/facebook`
3. Click on it to see function details
4. Check if it shows any errors or warnings

## Quick Fix: Force Redeploy
1. Make a small change to trigger redeploy:
   ```bash
   echo "// Force redeploy" >> app/api/webhooks/facebook/route.ts
   git add app/api/webhooks/facebook/route.ts
   git commit -m "Force redeploy webhook route"
   git push origin main
   ```
2. Wait for Vercel to auto-deploy
3. Test again after deployment completes

## Next Steps
1. Check Vercel build logs for the route
2. Verify environment variables are set
3. Check Vercel function logs for runtime errors
4. Try clearing build cache and redeploying
5. If still 404, check if other API routes work (e.g., `/api/facebook/pages`)

