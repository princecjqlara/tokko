# Next Steps Checklist - Fix Message Sending

## ✅ Step 1: Get Service Role Key from Supabase

1. In Supabase Dashboard, click **"Project Settings"** in the left sidebar (at the bottom)
2. Click **"API"** (in the PROJECT SETTINGS section)
3. Find **"service_role secret"** key
4. Click **"Reveal"** to show it
5. **Copy the entire key** (it's long, starts with `eyJ...`)

## ✅ Step 2: Add Service Role Key to Vercel

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Click **"Add New"**
3. Add:
   - **Key**: `SUPABASE_SERVICE_ROLE_KEY`
   - **Value**: (paste the service_role key you copied)
   - Set for: **Production**, **Preview**, and **Development**
4. Click **"Save"**

## ✅ Step 3: Create Database Tables in Supabase

### Option A: Using SQL Editor (Recommended)

1. In Supabase Dashboard, click **"SQL Editor"** in the left sidebar
2. Click **"New query"**
3. Copy and paste the SQL from `supabase_migrations/create_facebook_pages_table.sql`
4. Click **"Run"** (or press Ctrl+Enter)
5. You should see "Success. No rows returned"
6. Click **"New query"** again
7. Copy and paste the SQL from `supabase_migrations/create_user_pages_table.sql`
8. Click **"Run"**
9. You should see "Success. No rows returned"

### Option B: Using Table Editor

1. Click **"Table Editor"** in the left sidebar
2. Click **"Create a new table"**
3. Create `facebook_pages` table with columns:
   - `page_id` (text, primary key)
   - `page_name` (text)
   - `page_access_token` (text)
   - `updated_at` (timestamptz)
   - `created_at` (timestamptz)
4. Create `user_pages` table with columns:
   - `user_id` (text)
   - `page_id` (text)
   - `connected_at` (timestamptz)
   - `created_at` (timestamptz)
   - Primary key: (user_id, page_id)

**Note:** Option A (SQL Editor) is easier and faster!

## ✅ Step 4: Redeploy in Vercel

1. Go to **Vercel Dashboard** → Your Project → **Deployments**
2. Click **"..."** on the latest deployment
3. Click **"Redeploy"**
4. Wait for deployment to complete (1-2 minutes)

## ✅ Step 5: Test Message Sending

1. Go to your app: https://tokko-official.vercel.app/bulk-message
2. Select some contacts
3. Type a message
4. Click **"Send Broadcast"**
5. Should work without errors! ✅

## Quick Summary

1. ✅ Get service_role key from Supabase → API Keys
2. ✅ Add `SUPABASE_SERVICE_ROLE_KEY` to Vercel
3. ✅ Run SQL migrations in Supabase SQL Editor
4. ✅ Redeploy in Vercel
5. ✅ Test sending messages

## Files Created for You

- `supabase_migrations/create_facebook_pages_table.sql` - SQL to create facebook_pages table
- `supabase_migrations/create_user_pages_table.sql` - SQL to create user_pages table
- `FIX_MESSAGE_SENDING.md` - Detailed fix instructions


