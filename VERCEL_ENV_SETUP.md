# Vercel Environment Variables Setup Guide

## ⚠️ IMPORTANT: How to Enter Variables in Vercel

In Vercel's environment variable interface, you enter the **KEY** and **VALUE** in **separate fields**, NOT as "KEY=VALUE" in one field.

## Step-by-Step Instructions

### For Each Environment Variable:

1. Click **"Add New"** button
2. In the **"Key"** field: Enter just the variable name (e.g., `FACEBOOK_WEBHOOK_VERIFY_TOKEN`)
3. In the **"Value"** field: Enter just the value (e.g., `40ff8ce6a6700d0fa33f97eb9353ec0851bff79b855a13e4902c7ae8e8dc97ac`)
4. Select which environments: **Production**, **Preview**, **Development** (or all)
5. Click **"Save"**

## Complete List of Variables to Add

### 1. NEXTAUTH_URL
- **Key**: `NEXTAUTH_URL`
- **Value**: `https://tokko-official.vercel.app`
- **Environments**: Production, Preview, Development

### 2. NEXTAUTH_SECRET
- **Key**: `NEXTAUTH_SECRET`
- **Value**: `+oPlWVRGkbtIHjPYtEZg0A7qSaIVfcvpWRBLrs2X8eo=`
- **Environments**: Production, Preview, Development

### 3. FACEBOOK_CLIENT_ID
- **Key**: `FACEBOOK_CLIENT_ID`
- **Value**: `1350694239880908`
- **Environments**: Production, Preview, Development

### 4. FACEBOOK_CLIENT_SECRET
- **Key**: `FACEBOOK_CLIENT_SECRET`
- **Value**: `da01b7d8d749d6e9f89cb23618c9e87d`
- **Environments**: Production, Preview, Development

### 5. FACEBOOK_WEBHOOK_VERIFY_TOKEN ⭐ (For Webhook)
- **Key**: `FACEBOOK_WEBHOOK_VERIFY_TOKEN`
- **Value**: `40ff8ce6a6700d0fa33f97eb9353ec0851bff79b855a13e4902c7ae8e8dc97ac`
- **Environments**: Production, Preview, Development

### 6. FACEBOOK_APP_SECRET
- **Key**: `FACEBOOK_APP_SECRET`
- **Value**: `da01b7d8d749d6e9f89cb23618c9e87d`
- **Environments**: Production, Preview, Development

### 7. NEXT_PUBLIC_SUPABASE_URL
- **Key**: `NEXT_PUBLIC_SUPABASE_URL`
- **Value**: `https://ucirfbweulbvjxmvtiox.supabase.co`
- **Environments**: Production, Preview, Development

### 8. NEXT_PUBLIC_SUPABASE_ANON_KEY
- **Key**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjaXJmYndldWxidmp4bXZ0aW94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3Nzc0NzQsImV4cCI6MjA4MDM1MzQ3NH0.rQSJ88EFI6yRY1uFO0k8uj__A9Tdo9kxAqKYueIKVJc`
- **Environments**: Production, Preview, Development

### 9. SUPABASE_SERVICE_ROLE_KEY
- **Key**: `SUPABASE_SERVICE_ROLE_KEY`
- **Value**: (Get from Supabase Dashboard → Settings → API → service_role key)
- **Environments**: Production, Preview, Development

### 10. SUPABASE_DB_URL
- **Key**: `SUPABASE_DB_URL`
- **Value**: `postgresql://postgres:demet5732595@db.ucirfbweulbvjxmvtiox.supabase.co:5432/postgres`
- **Environments**: Production, Preview, Development

### 11. SUPABASE_DB_POOLER_TRANSACTION
- **Key**: `SUPABASE_DB_POOLER_TRANSACTION`
- **Value**: `postgresql://postgres.ucirfbweulbvjxmvtiox:demet5732595@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres`
- **Environments**: Production, Preview, Development

### 12. SUPABASE_DB_POOLER_SESSION
- **Key**: `SUPABASE_DB_POOLER_SESSION`
- **Value**: `postgresql://postgres.ucirfbweulbvjxmvtiox:demet5732595@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres`
- **Environments**: Production, Preview, Development

## Common Mistakes to Avoid

❌ **WRONG**: 
- Key: (empty)
- Value: `FACEBOOK_WEBHOOK_VERIFY_TOKEN=40ff8ce6a6700d0fa33f97eb9353ec0851bff79b855a13e4902c7ae8e8dc97ac`

✅ **CORRECT**:
- Key: `FACEBOOK_WEBHOOK_VERIFY_TOKEN`
- Value: `40ff8ce6a6700d0fa33f97eb9353ec0851bff79b855a13e4902c7ae8e8dc97ac`

## After Adding Variables

1. Vercel will automatically trigger a new deployment
2. Wait for deployment to complete (check Deployments tab)
3. Test the webhook endpoint:
   ```bash
   curl "https://tokko-official.vercel.app/api/webhooks/facebook?hub.mode=subscribe&hub.verify_token=40ff8ce6a6700d0fa33f97eb9353ec0851bff79b855a13e4902c7ae8e8dc97ac&hub.challenge=test123"
   ```
4. Expected response: `test123` (the challenge value)
5. Then verify in Facebook webhook settings


