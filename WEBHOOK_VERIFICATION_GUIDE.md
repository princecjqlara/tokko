# Webhook Verification Guide

## ✅ If Webhook Endpoint Works

If the endpoint returns `test123` (not 404), proceed to verify in Facebook:

### Step 1: Go to Facebook Developers
1. Go to: https://developers.facebook.com/apps/
2. Select your app
3. Go to **Webhooks** in the left sidebar

### Step 2: Configure Webhook
1. Click **"Add Subscription"** or **"Edit"** on existing webhook
2. Select **"Page"** as the subscription type
3. Enter:
   - **Callback URL**: `https://tokko-official.vercel.app/api/webhooks/facebook`
   - **Verify Token**: `40ff8ce6a6700d0fa33f97eb9353ec0851bff79b855a13e4902c7ae8e8dc97ac`
4. Click **"Verify and Save"**

### Step 3: Subscribe to Events
After verification succeeds, subscribe to:
- ✅ **messages** - New messages sent to your page
- ✅ **messaging_postbacks** - Button clicks, quick replies
- ✅ **messaging_optins** - User opt-ins
- ✅ **messaging_deliveries** - Message delivery status
- ✅ **messaging_reads** - Message read receipts

### Step 4: Select Pages
1. Select which Facebook Pages to receive webhooks for
2. Click **"Subscribe"**

## 🎉 Success!

Once verified:
- ✅ Webhook is active and receiving events
- ✅ Your app will receive real-time updates from Facebook
- ✅ New messages will be processed automatically

## ⚠️ If Verification Fails

### Check:
1. **Callback URL** is exactly: `https://tokko-official.vercel.app/api/webhooks/facebook`
2. **Verify Token** matches exactly (no extra spaces)
3. **Endpoint is accessible** (test with curl first)
4. **Vercel deployment is "Ready"** (not building)

### Common Issues:
- **"Callback URL couldn't be validated"**: Wait 1-2 minutes after deployment, then try again
- **"Verify token doesn't match"**: Double-check the token in Vercel environment variables
- **Timeout**: Check Vercel function logs for errors

## 📝 Next Steps After Verification

1. Test by sending a message to your Facebook Page
2. Check Vercel function logs to see webhook events
3. Verify contacts are being stored in Supabase
4. Test the broadcast messaging feature

