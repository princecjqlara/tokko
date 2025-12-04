# Deploy to Vercel - Quick Guide

## ✅ Code is Pushed
Your code has been successfully pushed to GitHub and linked to Vercel project: `herman`

## ⚠️ Required: Set Environment Variables

The deployment failed because environment variables are missing. Follow these steps:

### Step 1: Go to Vercel Dashboard
1. Open: https://vercel.com/samanthha-kristinas-projects/herman
2. Click **Settings** → **Environment Variables**

### Step 2: Add These Variables

Add each variable one by one (click "Add New" for each):

#### 1. NEXTAUTH_SECRET
```
Key: NEXTAUTH_SECRET
Value: +oPlWVRGkbtIHjPYtEZg0A7qSaIVfcvpWRBLrs2X8eo=
Environment: Production, Preview, Development (select all)
```

#### 2. NEXTAUTH_URL
```
Key: NEXTAUTH_URL
Value: https://tokko-official.vercel.app
Environment: Production, Preview, Development (select all)
```

#### 3. FACEBOOK_CLIENT_ID
```
Key: FACEBOOK_CLIENT_ID
Value: 1350694239880908
Environment: Production, Preview, Development (select all)
```

#### 4. FACEBOOK_CLIENT_SECRET
```
Key: FACEBOOK_CLIENT_SECRET
Value: da01b7d8d749d6e9f89cb23618c9e87d
Environment: Production, Preview, Development (select all)
```

#### 5. FACEBOOK_APP_SECRET
```
Key: FACEBOOK_APP_SECRET
Value: da01b7d8d749d6e9f89cb23618c9e87d
Environment: Production, Preview, Development (select all)
```

#### 6. FACEBOOK_WEBHOOK_VERIFY_TOKEN
```
Key: FACEBOOK_WEBHOOK_VERIFY_TOKEN
Value: 40ff8ce6a6700d0fa33f97eb9353ec0851bff79b855a13e4902c7ae8e8dc97ac
Environment: Production, Preview, Development (select all)
```

#### 7. NEXT_PUBLIC_SUPABASE_URL
```
Key: NEXT_PUBLIC_SUPABASE_URL
Value: https://ucirfbweulbvjxmvtiox.supabase.co
Environment: Production, Preview, Development (select all)
```

#### 8. NEXT_PUBLIC_SUPABASE_ANON_KEY
```
Key: NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjaXJmYndldWxidmp4bXZ0aW94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3Nzc0NzQsImV4cCI6MjA4MDM1MzQ3NH0.rQSJ88EFI6yRY1uFO0k8uj__A9Tdo9kxAqKYueIKVJc
Environment: Production, Preview, Development (select all)
```

#### 9. SUPABASE_SERVICE_ROLE_KEY (Optional but Recommended)
```
Key: SUPABASE_SERVICE_ROLE_KEY
Value: [Get from Supabase Dashboard → Settings → API → service_role key]
Environment: Production, Preview, Development (select all)
```

### Step 3: Redeploy
After adding all variables:
1. Go to **Deployments** tab
2. Click **"..."** on the failed deployment
3. Click **"Redeploy"**
4. Or push a new commit to trigger auto-deployment

## 🔗 Quick Links
- **Vercel Project**: https://vercel.com/samanthha-kristinas-projects/herman
- **GitHub Repo**: https://github.com/princecjqlara/tokko

## ✅ After Deployment
Once deployment succeeds, your app will be available at:
- **Production**: https://tokko-official.vercel.app (or the URL shown in Vercel)

