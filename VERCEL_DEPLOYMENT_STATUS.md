# Vercel Deployment Status Check

## ✅ Code Pushed to GitHub
- All files have been committed and pushed to `main` branch
- Commit: `7825be0` - "Add webhook endpoint, fix broadcast messaging, update for Vercel deployment"

## 🔍 Next Steps to Verify Deployment

### 1. Check Vercel Dashboard
1. Go to https://vercel.com/dashboard
2. Find your project: `tokko-official` (or your project name)
3. Click on the project
4. Go to **Deployments** tab
5. Look for the latest deployment (should show "Building" or "Ready")
6. If it shows an error, click on it to see the build logs

### 2. Verify Environment Variables
1. In Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
2. Verify these are set for **Production**:
   - `FACEBOOK_WEBHOOK_VERIFY_TOKEN` = `40ff8ce6a6700d0fa33f97eb9353ec0851bff79b855a13e4902c7ae8e8dc97ac`
   - `NEXTAUTH_SECRET` (should be set)
   - `NEXTAUTH_URL` = `https://tokko-official.vercel.app`
   - `FACEBOOK_CLIENT_ID` (should be set)
   - `FACEBOOK_CLIENT_SECRET` (should be set)
   - `FACEBOOK_APP_SECRET` (should be set)
   - `SUPABASE_URL` (should be set)
   - `SUPABASE_SERVICE_ROLE_KEY` (should be set)

### 3. Test the Webhook Endpoint
Once deployment is complete (status shows "Ready"), test:

```bash
curl "https://tokko-official.vercel.app/api/webhooks/facebook?hub.mode=subscribe&hub.verify_token=40ff8ce6a6700d0fa33f97eb9353ec0851bff79b855a13e4902c7ae8e8dc97ac&hub.challenge=test123"
```

**Expected Response**: Should return `test123` (not 404)

### 4. If Still Getting 404
If the endpoint still returns 404 after deployment completes:

1. **Check Build Logs**: Look for any errors in the Vercel deployment logs
2. **Verify Route File**: Ensure `app/api/webhooks/facebook/route.ts` exists in the deployment
3. **Check Function Logs**: In Vercel Dashboard → Your Project → **Functions** tab, check for any runtime errors
4. **Redeploy**: Try manually triggering a redeploy from the Vercel dashboard

### 5. Verify in Facebook
Once the endpoint returns the challenge value correctly:
1. Go to Facebook Developers → Your App → Webhooks
2. Click "Edit" on the webhook subscription
3. Enter:
   - **Callback URL**: `https://tokko-official.vercel.app/api/webhooks/facebook`
   - **Verify Token**: `40ff8ce6a6700d0fa33f97eb9353ec0851bff79b855a13e4902c7ae8e8dc97ac`
4. Click "Verify and Save"

## 🐛 Troubleshooting

### Deployment Failed?
- Check build logs in Vercel dashboard
- Verify all dependencies are in `package.json`
- Check for TypeScript errors

### Endpoint Returns 500?
- Check Vercel function logs
- Verify environment variables are set correctly
- Check that `FACEBOOK_WEBHOOK_VERIFY_TOKEN` matches exactly

### Endpoint Returns 403?
- Verify token matches exactly (no extra spaces)
- Check that environment variable is set for Production environment

