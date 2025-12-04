# Where to Find Service Role Key in Supabase

## ✅ Click This:
**"API Keys"** (in the PROJECT SETTINGS section)

It's located:
- Below "Data API"
- Above "JWT Keys"

## What You'll See:
After clicking "API Keys", you'll see:

1. **Project URL** - Your Supabase project URL
2. **anon public** key - This is the one you already have (starts with `eyJ...`)
3. **service_role secret** key - This is what you need!

## Steps:
1. Click **"API Keys"** in the left menu
2. Look for **"service_role"** or **"secret"** key
3. Click **"Reveal"** or **"Show"** button to see it
4. Copy the entire key (it's long, starts with `eyJ...`)

## Important:
- The service_role key is usually hidden by default
- You may need to click a "Reveal" button to see it
- It will be labeled as "service_role" or "secret"
- It's different from the "anon public" key

## After Getting It:
1. Copy the service_role key
2. Add it to Vercel as `SUPABASE_SERVICE_ROLE_KEY`
3. Set for Production, Preview, and Development
4. Redeploy


