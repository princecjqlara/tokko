# Copy-Paste Ready: Vercel Environment Variables

## Quick Instructions
1. Go to: **Vercel Dashboard → Your Project → Settings → Environment Variables**
2. Click **"Add New"** for each variable below
3. Copy the **Key** and **Value** exactly as shown
4. Set for: **Production**, **Preview**, and **Development** (or at least **Production**)
5. Click **"Save"**
6. Go to **Deployments** → Click **"..."** → **"Redeploy"**

---

## Environment Variables (Copy-Paste Ready)

### Variable 1:
**Key:**
```
NEXTAUTH_SECRET
```
**Value:**
```
+oPlWVRGkbtIHjPYtEZg0A7qSaIVfcvpWRBLrs2X8eo=
```

---

### Variable 2:
**Key:**
```
NEXTAUTH_URL
```
**Value:**
```
https://tokko-official.vercel.app
```

---

### Variable 3:
**Key:**
```
FACEBOOK_CLIENT_ID
```
**Value:**
```
1350694239880908
```

---

### Variable 4:
**Key:**
```
FACEBOOK_CLIENT_SECRET
```
**Value:**
```
da01b7d8d749d6e9f89cb23618c9e87d
```

---

### Variable 5:
**Key:**
```
FACEBOOK_APP_SECRET
```
**Value:**
```
da01b7d8d749d6e9f89cb23618c9e87d
```

---

### Variable 6:
**Key:**
```
FACEBOOK_WEBHOOK_VERIFY_TOKEN
```
**Value:**
```
40ff8ce6a6700d0fa33f97eb9353ec0851bff79b855a13e4902c7ae8e8dc97ac
```

---

### Variable 7:
**Key:**
```
NEXT_PUBLIC_SUPABASE_URL
```
**Value:**
```
https://ucirfbweulbvjxmvtiox.supabase.co
```

---

### Variable 8:
**Key:**
```
NEXT_PUBLIC_SUPABASE_ANON_KEY
```
**Value:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjaXJmYndldWxidmp4bXZ0aW94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3Nzc0NzQsImV4cCI6MjA4MDM1MzQ3NH0.rQSJ88EFI6yRY1uFO0k8uj__A9Tdo9kxAqKYueIKVJc
```

---

### Variable 9 (REQUIRED for server-side operations):
**Key:**
```
SUPABASE_SERVICE_ROLE_KEY
```
**Value:**
```
(Get this from Supabase Dashboard → Settings → API → service_role key)
```
**Important:** This is required for server-side database operations. Without it, the build may fail or database operations will be blocked by RLS policies.

---

## ⚠️ Important Notes
- **No spaces** before or after the values
- **Case sensitive** - copy variable names exactly
- Set for **Production** environment (at minimum)
- **Redeploy** after adding all variables

## ✅ After Adding All Variables
1. Click **"Save"** at the bottom
2. Go to **Deployments** tab
3. Click **"..."** on the failed deployment
4. Click **"Redeploy"**
5. Build should now succeed! 🎉


