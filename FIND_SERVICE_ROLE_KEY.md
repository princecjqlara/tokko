# How to Find SUPABASE_SERVICE_ROLE_KEY

## ❌ What You Have
The key you showed is the **anon key** (has `"role": "anon"` in the JWT).

## ✅ What You Need
The **service_role key** (has `"role": "service_role"` in the JWT).

## Step-by-Step Instructions

### Step 1: Go to Supabase Dashboard
1. Go to: https://supabase.com/dashboard
2. Select your project: `ucirfbweulbvjxmvtiox`

### Step 2: Navigate to API Settings
1. Click **"Settings"** in the left sidebar
2. Click **"API"** in the settings menu

### Step 3: Find Service Role Key
You'll see two keys:

1. **anon / public key** (what you have):
   - Starts with: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - Role: `anon`
   - ⚠️ This is NOT the one you need

2. **service_role key** (what you need):
   - Also starts with: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - Role: `service_role`
   - ✅ This is the one you need!
   - Usually labeled as **"service_role"** or **"secret"**
   - May have a **"Reveal"** or **"Show"** button to reveal it

### Step 4: Copy the Service Role Key
1. Click **"Reveal"** or **"Show"** next to the service_role key
2. Copy the entire key (it's long, starts with `eyJ...`)
3. **⚠️ Keep this secret!** Never commit it to git or share it publicly

## How to Verify It's the Right Key

The service_role key will decode to show:
```json
{
  "role": "service_role",  ← This is the key difference!
  "iss": "supabase",
  "ref": "ucirfbweulbvjxmvtiox",
  ...
}
```

## Security Note
- ✅ **Anon key**: Safe to expose (used in frontend)
- ❌ **Service role key**: **NEVER expose** - it bypasses all security!
- Only use service_role key in server-side code (Vercel environment variables)

## After Getting the Key
1. Add it to Vercel as `SUPABASE_SERVICE_ROLE_KEY`
2. Set for Production, Preview, and Development
3. Redeploy your application

