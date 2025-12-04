# Quick Fix: Webhook 404 Error

## Problem
The webhook endpoint is returning 404 even after Vercel deployment.

## Solution

### Step 1: Push Latest Code to GitHub
```bash
git add .
git commit -m "Fix webhook route and add runtime config"
git push origin main
```

### Step 2: Verify Environment Variable in Vercel
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Check that `FACEBOOK_WEBHOOK_VERIFY_TOKEN` exists
3. **Key**: `FACEBOOK_WEBHOOK_VERIFY_TOKEN`
4. **Value**: `40ff8ce6a6700d0fa33f97eb9353ec0851bff79b855a13e4902c7ae8e8dc97ac`
5. Make sure it's set for **Production** environment

### Step 3: Trigger New Deployment
After pushing to GitHub, Vercel should auto-deploy. If not:
1. Go to Vercel Dashboard → Deployments
2. Click "Redeploy" on the latest deployment
3. Or push a new commit

### Step 4: Wait for Deployment
Wait 1-2 minutes for deployment to complete.

### Step 5: Test the Endpoint
Once deployed, test:
```bash
curl "https://tokko-official.vercel.app/api/webhooks/facebook?hub.mode=subscribe&hub.verify_token=40ff8ce6a6700d0fa33f97eb9353ec0851bff79b855a13e4902c7ae8e8dc97ac&hub.challenge=test123"
```

**Expected**: Should return `test123` (not 404)

### Step 6: Verify in Facebook
Once the endpoint returns the challenge value, try verifying in Facebook again.

## Troubleshooting

### Still Getting 404?
1. Check Vercel deployment logs for errors
2. Verify the route file exists: `app/api/webhooks/facebook/route.ts`
3. Check that the file exports `GET` and `POST` functions
4. Ensure environment variable is set correctly (no extra spaces)

### Getting 403 Forbidden?
- The verify token doesn't match
- Check Vercel environment variable matches exactly
- No extra spaces or newlines in the token

### Getting 500 Error?
- Check Vercel function logs
- Verify all environment variables are set
- Check that Supabase credentials are correct

