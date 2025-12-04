# Deployment Checklist for Vercel

## ✅ Completed Steps

### 1. Environment Variables Updated
- ✅ `.env.local` updated with new webhook verify token
- ✅ `NEXTAUTH_URL` updated to `https://tokko-official.vercel.app`
- ✅ Removed ngrok references

### 2. Webhook Verify Token Generated
**Token**: `40ff8ce6a6700d0fa33f97eb9353ec0851bff79b855a13e4902c7ae8e8dc97ac`

## ⚠️ Required Actions

### Step 1: Deploy to Vercel
1. Push your code to GitHub:
   ```bash
   git add .
   git commit -m "Update for Vercel deployment"
   git push origin main
   ```

2. Deploy to Vercel:
   - Go to https://vercel.com/new
   - Import your GitHub repository
   - Vercel will auto-detect Next.js
   - Click "Deploy"

### Step 2: Set Environment Variables in Vercel
Go to your Vercel project → **Settings → Environment Variables** and add:

```
NEXTAUTH_URL=https://tokko-official.vercel.app
NEXTAUTH_SECRET=+oPlWVRGkbtIHjPYtEZg0A7qSaIVfcvpWRBLrs2X8eo=
FACEBOOK_CLIENT_ID=1350694239880908
FACEBOOK_CLIENT_SECRET=da01b7d8d749d6e9f89cb23618c9e87d
FACEBOOK_WEBHOOK_VERIFY_TOKEN=40ff8ce6a6700d0fa33f97eb9353ec0851bff79b855a13e4902c7ae8e8dc97ac
FACEBOOK_APP_SECRET=da01b7d8d749d6e9f89cb23618c9e87d
NEXT_PUBLIC_SUPABASE_URL=https://ucirfbweulbvjxmvtiox.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjaXJmYndldWxidmp4bXZ0aW94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3Nzc0NzQsImV4cCI6MjA4MDM1MzQ3NH0.rQSJ88EFI6yRY1uFO0k8uj__A9Tdo9kxAqKYueIKVJc
SUPABASE_DB_URL=postgresql://postgres:demet5732595@db.ucirfbweulbvjxmvtiox.supabase.co:5432/postgres
SUPABASE_DB_POOLER_TRANSACTION=postgresql://postgres.ucirfbweulbvjxmvtiox:demet5732595@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres
SUPABASE_DB_POOLER_SESSION=postgresql://postgres.ucirfbweulbvjxmvtiox:demet5732595@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres
```

**Important**: Set these for **Production**, **Preview**, and **Development** environments.

### Step 3: Wait for Deployment
After setting environment variables, Vercel will automatically redeploy. Wait for the deployment to complete.

### Step 4: Verify Webhook Endpoint is Live
Test the webhook endpoint:
```bash
curl "https://tokko-official.vercel.app/api/webhooks/facebook?hub.mode=subscribe&hub.verify_token=40ff8ce6a6700d0fa33f97eb9353ec0851bff79b855a13e4902c7ae8e8dc97ac&hub.challenge=test123"
```

Expected response: `test123` (the challenge value)

### Step 5: Configure Facebook Webhook
Once the endpoint is live:

1. Go to Facebook App Dashboard: https://developers.facebook.com/apps/1350694239880908/
2. Navigate to **Webhooks** → **Page**
3. Click **Add Webhook** or **Edit**
4. Enter:
   - **Callback URL**: `https://tokko-official.vercel.app/api/webhooks/facebook`
   - **Verify Token**: `40ff8ce6a6700d0fa33f97eb9353ec0851bff79b855a13e4902c7ae8e8dc97ac`
5. Click **Verify and Save**
6. Subscribe to webhook fields:
   - `messages`
   - `messaging_postbacks`
   - `messaging_optins`
   - `messaging_deliveries`
   - `messaging_reads`

### Step 6: Update Facebook OAuth Redirect URIs
1. Go to **Facebook Login → Settings**
2. Add to **Valid OAuth Redirect URIs**:
   - `https://tokko-official.vercel.app/api/auth/callback/facebook`
   - `https://tokko-official.vercel.app/api/auth/callback/facebook/popup`

## Troubleshooting

### Webhook Verification Fails
- ✅ Ensure Vercel deployment is complete
- ✅ Verify `FACEBOOK_WEBHOOK_VERIFY_TOKEN` is set in Vercel
- ✅ Check that the token matches exactly (no extra spaces)
- ✅ Test the endpoint manually with curl first

### 404 Error on Webhook
- The route might not be deployed yet
- Wait for Vercel deployment to complete
- Check Vercel function logs for errors

### Environment Variables Not Working
- After adding variables, Vercel needs to redeploy
- Go to **Deployments** tab and trigger a new deployment
- Or push a new commit to trigger auto-deployment

