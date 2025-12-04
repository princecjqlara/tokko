# Click "API Keys" in Supabase

## ✅ What to Click:
In the left sidebar, under **PROJECT SETTINGS**, click:

**"API Keys"**

It's located:
- Below "Data API"
- Above "JWT Keys"

## What You'll See:
After clicking "API Keys", you'll see:

1. **Project URL** - Your Supabase project URL
2. **anon public** key - The one you already have
3. **service_role secret** key - The one you need! (may be hidden)

## Next Steps After Clicking:
1. Look for **"service_role"** or **"secret"** key
2. Click **"Reveal"** or **"Show"** button to see it
3. Copy the entire key (it's long, starts with `eyJ...`)
4. Add it to Vercel as `SUPABASE_SERVICE_ROLE_KEY`

