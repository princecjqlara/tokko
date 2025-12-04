# Missing Supabase Environment Variable

## ❌ Error
```
Error: Missing Supabase environment variables
```

## ✅ Fix: Add Missing Variable

The code needs `NEXT_PUBLIC_SUPABASE_URL` (not just `SUPABASE_URL`).

### Add This Variable in Vercel:

**Key:**
```
NEXT_PUBLIC_SUPABASE_URL
```

**Value:**
```
https://ucirfbweulbvjxmvtiox.supabase.co
```

## Updated Complete List

Make sure you have ALL of these in Vercel:

1. ✅ `NEXTAUTH_SECRET`
2. ✅ `NEXTAUTH_URL`
3. ✅ `FACEBOOK_CLIENT_ID`
4. ✅ `FACEBOOK_CLIENT_SECRET`
5. ✅ `FACEBOOK_APP_SECRET`
6. ✅ `FACEBOOK_WEBHOOK_VERIFY_TOKEN`
7. ✅ `NEXT_PUBLIC_SUPABASE_URL` ← **ADD THIS ONE!**
8. ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## After Adding
1. Click **"Save"**
2. Go to **Deployments** → Click **"..."** → **"Redeploy"**
3. Build should succeed!


