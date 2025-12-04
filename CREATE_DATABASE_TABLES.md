# Create Database Tables in Supabase

## ✅ Step 1: Open SQL Editor in Supabase

1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click **"SQL Editor"** in the left sidebar
4. Click **"New query"** button

## ✅ Step 2: Create `facebook_pages` Table

1. Copy and paste this SQL:

```sql
CREATE TABLE IF NOT EXISTS public.facebook_pages (
    page_id TEXT PRIMARY KEY,
    page_name TEXT NOT NULL,
    page_access_token TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_facebook_pages_updated_at ON public.facebook_pages(updated_at DESC);

ALTER TABLE public.facebook_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage all pages" ON public.facebook_pages;

CREATE POLICY "Service role can manage all pages"
    ON public.facebook_pages
    FOR ALL
    USING (true)
    WITH CHECK (true);
```

2. Click **"Run"** button (or press Ctrl+Enter)
3. You should see: **"Success. No rows returned"**

## ✅ Step 3: Create `user_pages` Table

1. Click **"New query"** button again
2. Copy and paste this SQL:

```sql
CREATE TABLE IF NOT EXISTS public.user_pages (
    user_id TEXT NOT NULL,
    page_id TEXT NOT NULL,
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, page_id),
    CONSTRAINT fk_user_pages_facebook_pages 
        FOREIGN KEY (page_id) 
        REFERENCES public.facebook_pages(page_id) 
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_pages_user_id ON public.user_pages(user_id);
CREATE INDEX IF NOT EXISTS idx_user_pages_page_id ON public.user_pages(page_id);
CREATE INDEX IF NOT EXISTS idx_user_pages_connected_at ON public.user_pages(connected_at DESC);

ALTER TABLE public.user_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage all user pages" ON public.user_pages;

CREATE POLICY "Service role can manage all user pages"
    ON public.user_pages
    FOR ALL
    USING (true)
    WITH CHECK (true);
```

3. Click **"Run"** button (or press Ctrl+Enter)
4. You should see: **"Success. No rows returned"**

## ✅ Step 4: Verify Tables Were Created

1. Click **"Table Editor"** in the left sidebar
2. You should see two new tables:
   - ✅ `facebook_pages`
   - ✅ `user_pages`

## ✅ Step 5: Test Message Sending

1. Go to: https://tokko-official.vercel.app/bulk-message
2. Select some contacts
3. Type a message
4. Click **"Send Broadcast"**
5. Should work without errors! 🎉

## Troubleshooting

### If you get an error:
- **"relation already exists"**: The table already exists, that's okay!
- **"permission denied"**: Make sure you're running as the project owner
- **"syntax error"**: Double-check you copied the entire SQL

### If tables don't appear:
- Refresh the Table Editor page
- Check the SQL Editor for any error messages

