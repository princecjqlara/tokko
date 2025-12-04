# What to Look For in Vercel Build Logs

## Key Sections to Check

### 1. Route List (Most Important!)
Look for a section that shows:
```
Route (app)
├ ○ /
├ ƒ /api/auth/[...nextauth]
├ ƒ /api/webhooks/facebook    ← Should be here!
├ ƒ /api/facebook/pages
├ ƒ /api/facebook/contacts/stream
...
```

**What to check:**
- ✅ If you see `ƒ /api/webhooks/facebook` = Route is being built correctly
- ❌ If it's missing = Route file isn't being detected

### 2. Build Errors
Look for any red error messages like:
- `Error: ...`
- `Failed to ...`
- `TypeError: ...`
- `Cannot find module ...`

### 3. Build Success Message
At the end, you should see:
```
✓ Build completed successfully
```

### 4. Function List
Sometimes Vercel shows:
```
Functions:
  /api/webhooks/facebook
  /api/facebook/pages
  ...
```

## What to Share
Please copy and paste:
1. **The route list section** (shows all routes)
2. **Any error messages** (if any)
3. **The final build status** (success/failure)

## Quick Test
After checking the logs, you can also test if the route is accessible by checking Vercel Functions:
1. Go to Vercel Dashboard → Your Project → **Functions** tab
2. Look for `/api/webhooks/facebook`
3. If it's listed, the route is deployed
4. Click on it to see function details and logs


