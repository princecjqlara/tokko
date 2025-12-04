# Vercel Deployment Guide

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub Repository**: Push your code to GitHub
3. **Facebook App Configuration**: Update your Facebook app with production URLs

## Step 1: Push to GitHub

```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

## Step 2: Deploy to Vercel

### Option A: Via Vercel Dashboard (Recommended)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Vercel will auto-detect Next.js settings
4. Click "Deploy"

### Option B: Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# For production deployment
vercel --prod
```

## Step 3: Configure Environment Variables

In your Vercel project dashboard, go to **Settings → Environment Variables** and add:

### Required Variables:

**Important**: In Vercel, enter the KEY and VALUE separately (not as "KEY=VALUE"):

1. **NEXTAUTH_URL**
   - Key: `NEXTAUTH_URL`
   - Value: `https://tokko-official.vercel.app`

2. **NEXTAUTH_SECRET**
   - Key: `NEXTAUTH_SECRET`
   - Value: `+oPlWVRGkbtIHjPYtEZg0A7qSaIVfcvpWRBLrs2X8eo=`

3. **FACEBOOK_CLIENT_ID**
   - Key: `FACEBOOK_CLIENT_ID`
   - Value: `1350694239880908`

4. **FACEBOOK_CLIENT_SECRET**
   - Key: `FACEBOOK_CLIENT_SECRET`
   - Value: `da01b7d8d749d6e9f89cb23618c9e87d`

5. **FACEBOOK_WEBHOOK_VERIFY_TOKEN**
   - Key: `FACEBOOK_WEBHOOK_VERIFY_TOKEN`
   - Value: `40ff8ce6a6700d0fa33f97eb9353ec0851bff79b855a13e4902c7ae8e8dc97ac`

6. **FACEBOOK_APP_SECRET**
   - Key: `FACEBOOK_APP_SECRET`
   - Value: `da01b7d8d749d6e9f89cb23618c9e87d`

7. **NEXT_PUBLIC_SUPABASE_URL**
   - Key: `NEXT_PUBLIC_SUPABASE_URL`
   - Value: `https://ucirfbweulbvjxmvtiox.supabase.co`

8. **NEXT_PUBLIC_SUPABASE_ANON_KEY**
   - Key: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjaXJmYndldWxidmp4bXZ0aW94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3Nzc0NzQsImV4cCI6MjA4MDM1MzQ3NH0.rQSJ88EFI6yRY1uFO0k8uj__A9Tdo9kxAqKYueIKVJc`

9. **SUPABASE_SERVICE_ROLE_KEY**
   - Key: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: (your service role key from Supabase)

10. **SUPABASE_DB_URL**
    - Key: `SUPABASE_DB_URL`
    - Value: `postgresql://postgres:demet5732595@db.ucirfbweulbvjxmvtiox.supabase.co:5432/postgres`

11. **SUPABASE_DB_POOLER_TRANSACTION**
    - Key: `SUPABASE_DB_POOLER_TRANSACTION`
    - Value: `postgresql://postgres.ucirfbweulbvjxmvtiox:demet5732595@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres`

12. **SUPABASE_DB_POOLER_SESSION**
    - Key: `SUPABASE_DB_POOLER_SESSION`
    - Value: `postgresql://postgres.ucirfbweulbvjxmvtiox:demet5732595@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres`

### Optional Variables:

```
SUPABASE_DB_URL=your-database-url
SUPABASE_DB_POOLER_TRANSACTION=your-pooler-transaction-url
SUPABASE_DB_POOLER_SESSION=your-pooler-session-url
```

**Important**: 
- Set these for **Production**, **Preview**, and **Development** environments
- `NEXTAUTH_URL` should be your Vercel deployment URL: `https://tokko-official.vercel.app`
- Generate `NEXTAUTH_SECRET` using: `openssl rand -base64 32`

## Step 4: Update Facebook App Settings

1. Go to [Facebook Developers](https://developers.facebook.com/apps/)
2. Select your app
3. Go to **Settings → Basic**
4. Add to **App Domains**: `tokko-official.vercel.app`
5. Go to **Facebook Login → Settings**
6. Add to **Valid OAuth Redirect URIs**:
   - `https://tokko-official.vercel.app/api/auth/callback/facebook`
   - `https://tokko-official.vercel.app/api/auth/callback/facebook/popup`

## Step 5: Configure Facebook Webhooks

1. Go to **Webhooks** in your Facebook App dashboard
2. Add webhook URL: `https://tokko-official.vercel.app/api/webhooks/facebook`
3. Subscribe to these events:
   - `messages`
   - `messaging_postbacks`
   - `messaging_optins`
   - `messaging_deliveries`
   - `messaging_reads`
4. Verify the webhook using the verification token

## Step 6: Verify Deployment

1. Visit your Vercel deployment URL
2. Test Facebook login
3. Test contact fetching
4. Test message sending
5. Check Vercel logs for any errors

## Troubleshooting

### Build Errors

- Check Vercel build logs in the dashboard
- Ensure all environment variables are set
- Verify TypeScript compilation passes locally: `npm run build`

### Authentication Issues

- Verify `NEXTAUTH_URL` matches your Vercel URL exactly
- Check Facebook app redirect URIs are correct
- Ensure `NEXTAUTH_SECRET` is set

### Database Connection Issues

- Verify Supabase environment variables are correct
- Check Supabase RLS policies allow server-side access
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is set for server operations

### Webhook Issues

- Verify webhook URL is accessible (not behind authentication)
- Check webhook verification token matches
- Review Vercel function logs for webhook errors

## Custom Domain (Optional)

1. In Vercel dashboard, go to **Settings → Domains**
2. Add your custom domain
3. Update `NEXTAUTH_URL` environment variable
4. Update Facebook app redirect URIs with new domain

## Continuous Deployment

Vercel automatically deploys:
- **Production**: Pushes to `main` branch
- **Preview**: Pull requests and other branches

Each deployment gets a unique URL for testing.

