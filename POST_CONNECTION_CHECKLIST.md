# Post-Connection Checklist

## ✅ What You Did
- Connected Vercel to the correct repository: `princecjqlara/tokko`
- Triggered a new deployment

## 🔍 What to Check Now

### 1. Check Deployment Status
1. Go to Vercel Dashboard → Your Project → **Deployments** tab
2. Look for a new deployment (should be building or ready)
3. Check the **commit** - should show `ab45bbe` or newer (NOT "Initial commit")
4. Check the **branch** - should be `main`

### 2. Check Build Logs
Click on the new deployment and check the build logs. You should see:
```
Route (app)
├ ƒ /api/webhooks/facebook    ← Should appear now!
├ ƒ /api/facebook/pages
├ ƒ /api/auth/[...nextauth]
├ ƒ /api/facebook/contacts/stream
...
```

### 3. Test the Webhook Endpoint
Once deployment is "Ready", test:
```bash
curl "https://tokko-official.vercel.app/api/webhooks/facebook?hub.mode=subscribe&hub.verify_token=40ff8ce6a6700d0fa33f97eb9353ec0851bff79b855a13e4902c7ae8e8dc97ac&hub.challenge=test123"
```

**Expected**: Should return `test123` (not 404)

### 4. Verify in Facebook
Once the endpoint works:
1. Go to Facebook Developers → Your App → Webhooks
2. Enter:
   - **Callback URL**: `https://tokko-official.vercel.app/api/webhooks/facebook`
   - **Verify Token**: `40ff8ce6a6700d0fa33f97eb9353ec0851bff79b855a13e4902c7ae8e8dc97ac`
3. Click "Verify and Save"

## 🎉 Success Indicators
- ✅ Deployment shows latest commit (not "Initial commit")
- ✅ Build logs show API routes
- ✅ Webhook endpoint returns challenge value (not 404)
- ✅ Facebook webhook verification succeeds

## ⚠️ If Still Not Working
- Check build logs for errors
- Verify environment variables are set in Vercel
- Make sure deployment is "Ready" (not "Building" or "Error")


