# Vercel Environment Variables Setup

## ❌ Build Error
The build is failing because `NEXTAUTH_SECRET` (and possibly other environment variables) are not set in Vercel.

## ✅ Solution: Add Environment Variables in Vercel

### Step 1: Go to Environment Variables
1. Go to Vercel Dashboard → Your Project → **Settings** → **Environment Variables**

### Step 2: Add Each Variable
Click **"Add New"** and add each variable below. Make sure to:
- Set for **Production**, **Preview**, and **Development** (or at least **Production**)
- Copy the **exact value** (no extra spaces)

### Required Environment Variables

#### 1. NEXTAUTH_SECRET
- **Key**: `NEXTAUTH_SECRET`
- **Value**: (Generate one or use your existing secret)
- **How to generate**: Run `openssl rand -base64 32` in terminal, or use any random string generator
- **Required for**: Authentication

#### 2. NEXTAUTH_URL
- **Key**: `NEXTAUTH_URL`
- **Value**: `https://tokko-official.vercel.app`
- **Required for**: Authentication callbacks

#### 3. FACEBOOK_CLIENT_ID
- **Key**: `FACEBOOK_CLIENT_ID`
- **Value**: (Your Facebook App ID)
- **Required for**: Facebook OAuth

#### 4. FACEBOOK_CLIENT_SECRET
- **Key**: `FACEBOOK_CLIENT_SECRET`
- **Value**: (Your Facebook App Secret)
- **Required for**: Facebook OAuth

#### 5. FACEBOOK_APP_SECRET
- **Key**: `FACEBOOK_APP_SECRET`
- **Value**: (Your Facebook App Secret - same as FACEBOOK_CLIENT_SECRET usually)
- **Required for**: Webhook signature verification

#### 6. FACEBOOK_WEBHOOK_VERIFY_TOKEN
- **Key**: `FACEBOOK_WEBHOOK_VERIFY_TOKEN`
- **Value**: `40ff8ce6a6700d0fa33f97eb9353ec0851bff79b855a13e4902c7ae8e8dc97ac`
- **Required for**: Webhook verification

#### 7. SUPABASE_URL
- **Key**: `SUPABASE_URL`
- **Value**: (Your Supabase project URL)
- **Required for**: Database connection

#### 8. SUPABASE_SERVICE_ROLE_KEY
- **Key**: `SUPABASE_SERVICE_ROLE_KEY`
- **Value**: (Your Supabase service role key)
- **Required for**: Database operations

## Step 3: Save and Redeploy
1. After adding all variables, click **"Save"**
2. Go to **Deployments** tab
3. Click **"..."** on the failed deployment
4. Click **"Redeploy"**
5. The build should now succeed!

## Quick Checklist
- [ ] NEXTAUTH_SECRET
- [ ] NEXTAUTH_URL
- [ ] FACEBOOK_CLIENT_ID
- [ ] FACEBOOK_CLIENT_SECRET
- [ ] FACEBOOK_APP_SECRET
- [ ] FACEBOOK_WEBHOOK_VERIFY_TOKEN
- [ ] SUPABASE_URL
- [ ] SUPABASE_SERVICE_ROLE_KEY

## Important Notes
- **No spaces**: Make sure there are no extra spaces before/after values
- **Case sensitive**: Variable names are case-sensitive
- **Set for Production**: Make sure variables are set for at least the Production environment
- **Redeploy required**: After adding variables, you must redeploy for them to take effect

## After Adding Variables
Once you've added all variables and redeployed:
1. Build should succeed
2. API routes should be accessible
3. Webhook endpoint should work


