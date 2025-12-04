# Connect Vercel to Different GitHub Account

## Problem
- GitHub account: `princecjqlara` (where your code is)
- Vercel account: Different account (can't access the repo)

## Solution: Grant Vercel Access to GitHub Repository

### Option 1: Connect Vercel Account to GitHub (Recommended)

#### Step 1: Link GitHub Account to Vercel
1. Go to Vercel Dashboard → Click your **profile icon** (top right)
2. Go to **Settings** → **Connected Accounts** (or **Integrations**)
3. Look for **GitHub** integration
4. Click **"Connect"** or **"Add GitHub"**
5. You'll be redirected to GitHub to authorize Vercel
6. **IMPORTANT**: Make sure you're logged into the **correct GitHub account** (`princecjqlara`)
7. Authorize Vercel to access your repositories
8. You may need to grant access to specific repositories or all repositories

#### Step 2: Connect Repository to Project
1. Go to your Vercel project → **Settings** → **Git**
2. If GitHub isn't connected, you'll see an option to connect
3. Click **"Connect Git Repository"**
4. Select **GitHub** as the provider
5. You should now see `princecjqlara/tokko` in the list
6. Select it and choose branch `main`
7. Click **"Connect"**

### Option 2: Use GitHub App Installation (If Option 1 doesn't work)

#### Step 1: Install Vercel GitHub App
1. Go to: https://github.com/apps/vercel
2. Click **"Configure"** or **"Install"**
3. **IMPORTANT**: Make sure you're logged into the **correct GitHub account** (`princecjqlara`)
4. Choose:
   - **"Only select repositories"** → Select `tokko`
   - OR **"All repositories"** (if you want)
5. Click **"Install"**

#### Step 2: Connect in Vercel
1. Go to Vercel Dashboard → Your Project → **Settings** → **Git**
2. Click **"Connect Git Repository"**
3. Select **GitHub**
4. You should now see `princecjqlara/tokko`
5. Select it and connect

### Option 3: Use Deploy Hooks (Temporary Workaround)

If you can't connect accounts, you can use Deploy Hooks:

1. Go to Vercel Dashboard → Your Project → **Settings** → **Git**
2. Look for **"Deploy Hooks"** section
3. Create a new deploy hook
4. Use this hook URL to trigger deployments (can be called from GitHub Actions or manually)

But **Option 1 or 2 is better** for automatic deployments.

## After Connecting

Once connected:
1. Vercel will automatically detect new commits
2. It will deploy from `princecjqlara/tokko`
3. All API routes will be included
4. Webhook endpoint will work

## Troubleshooting

### "Repository not found" error
- Make sure you authorized the correct GitHub account
- Check that the repository is not private (or grant Vercel access to private repos)

### "Access denied" error
- Re-authorize Vercel in GitHub settings
- Check GitHub → Settings → Applications → Authorized OAuth Apps → Vercel

### Still can't see the repository
- Make sure you're logged into the correct GitHub account when authorizing
- Try disconnecting and reconnecting the GitHub integration


