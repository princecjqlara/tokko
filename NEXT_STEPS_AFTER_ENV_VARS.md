# Next Steps After Adding Environment Variables

## ✅ Step 1: Redeploy in Vercel

1. Go to **Vercel Dashboard** → Your Project → **Deployments** tab
2. Click **"..."** (three dots) on the latest/failed deployment
3. Click **"Redeploy"**
4. Wait for the build to complete (usually 1-2 minutes)

## ✅ Step 2: Check Build Logs

Once deployment starts, check the build logs. You should see:

### Success Indicators:
- ✅ **"Compiled successfully"**
- ✅ **Route list showing API routes:**
  ```
  Route (app)
  ├ ƒ /api/webhooks/facebook    ← Should appear!
  ├ ƒ /api/facebook/pages
  ├ ƒ /api/auth/[...nextauth]
  ...
  ```
- ✅ **Status: "Ready"** (not "Error" or "Building")

## ✅ Step 3: Test Webhook Endpoint

Once deployment shows "Ready", test the webhook:

```bash
curl "https://tokko-official.vercel.app/api/webhooks/facebook?hub.mode=subscribe&hub.verify_token=40ff8ce6a6700d0fa33f97eb9353ec0851bff79b855a13e4902c7ae8e8dc97ac&hub.challenge=test123"
```

**Expected Response:** Should return `test123` (not 404 or error)

## ✅ Step 4: Verify in Facebook

Once the endpoint works:

1. Go to **Facebook Developers** → Your App → **Webhooks**
2. Click **"Edit"** on the webhook subscription
3. Enter:
   - **Callback URL**: `https://tokko-official.vercel.app/api/webhooks/facebook`
   - **Verify Token**: `40ff8ce6a6700d0fa33f97eb9353ec0851bff79b855a13e4902c7ae8e8dc97ac`
4. Click **"Verify and Save"**
5. Should show ✅ **"Webhook verified successfully"**

## ✅ Step 5: Subscribe to Events

After verification:
1. In the webhook settings, subscribe to:
   - ✅ **messages** (for new messages)
   - ✅ **messaging_postbacks** (for button clicks)
   - ✅ **messaging_optins** (for opt-ins)
2. Click **"Save"**

## 🎉 Success!

If all steps complete successfully:
- ✅ Build succeeds with API routes
- ✅ Webhook endpoint returns challenge value
- ✅ Facebook webhook verification succeeds
- ✅ Your app is fully deployed and ready!

## ⚠️ If Build Still Fails

Check the build logs for:
- Missing environment variables (add them)
- TypeScript errors (fix in code)
- Import errors (check dependencies)

## ⚠️ If Webhook Still Returns 404

- Wait 1-2 minutes after deployment completes (propagation delay)
- Check that deployment status is "Ready" (not "Building")
- Verify the route appears in build logs


