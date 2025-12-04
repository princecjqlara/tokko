# Add Service Role Key to Vercel

## ✅ You Have the Correct Key!
The key you provided is the **service_role** key (has `"role": "service_role"` in the JWT).

## Step-by-Step: Add to Vercel

### Step 1: Go to Vercel Environment Variables
1. Go to: https://vercel.com/dashboard
2. Select your project: **tokko**
3. Click **"Settings"** (top navigation)
4. Click **"Environment Variables"** (left sidebar)

### Step 2: Add the Key
1. Click **"Add New"** button
2. Enter:
   - **Key**: `SUPABASE_SERVICE_ROLE_KEY`
   - **Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjaXJmYndldWxidmp4bXZ0aW94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc3NzQ3NCwiZXhwIjoyMDgwMzUzNDc0fQ.to6dmDwHoYeqyXAaU51PnM6SG2CJhRxl9KNEjWoDMiw`
3. **IMPORTANT**: Select all three environments:
   - ✅ Production
   - ✅ Preview
   - ✅ Development
4. Click **"Save"**

## ✅ After Adding

Once you've added the key:
1. Go to **Deployments** tab
2. Click **"..."** on the latest deployment
3. Click **"Redeploy"**
4. Wait for deployment to complete

## Next Steps After This

After adding the key and redeploying:
1. ✅ Create database tables in Supabase (run SQL migrations)
2. ✅ Test message sending


