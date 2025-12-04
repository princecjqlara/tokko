# Fix: Message Sending Failed

## Issues Found

1. ❌ **Missing `SUPABASE_SERVICE_ROLE_KEY`** in Vercel environment variables
2. ❌ **Missing database tables**: `facebook_pages` and `user_pages`

## Solution

### Step 1: Add SUPABASE_SERVICE_ROLE_KEY to Vercel

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Click **"Add New"**
3. Add:
   - **Key**: `SUPABASE_SERVICE_ROLE_KEY`
   - **Value**: (Get this from your Supabase project settings)
4. Set for: **Production**, **Preview**, and **Development**
5. Click **"Save"**

#### How to Get SUPABASE_SERVICE_ROLE_KEY:
1. Go to: https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** → **API**
4. Find **"service_role"** key (NOT the anon key)
5. Copy it (it starts with `eyJ...`)

### Step 2: Create Missing Database Tables

Run these SQL migrations in your Supabase SQL Editor:

#### Migration 1: Create `facebook_pages` table
Go to: https://supabase.com/dashboard → Your Project → **SQL Editor**

Run the SQL from: `supabase_migrations/create_facebook_pages_table.sql`

#### Migration 2: Create `user_pages` table
Run the SQL from: `supabase_migrations/create_user_pages_table.sql`

### Step 3: Redeploy

After adding the environment variable and creating tables:
1. Go to **Vercel Dashboard** → **Deployments**
2. Click **"..."** → **"Redeploy"**
3. Wait for deployment to complete

## After Fix

Once fixed:
- ✅ Messages will send successfully
- ✅ Page access tokens will be stored correctly
- ✅ User-page relationships will work
- ✅ No more "table not found" errors

## Quick Checklist

- [ ] Add `SUPABASE_SERVICE_ROLE_KEY` to Vercel
- [ ] Run `create_facebook_pages_table.sql` in Supabase
- [ ] Run `create_user_pages_table.sql` in Supabase
- [ ] Redeploy in Vercel
- [ ] Test sending a message


