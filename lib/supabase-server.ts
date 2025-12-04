import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Use service role key for server-side operations to bypass RLS
// This is safe because it's only used server-side and never exposed to the client
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Create client - will work even if env vars are missing (allows build to complete)
// The actual error will occur at runtime when operations are attempted
const placeholderUrl = supabaseUrl || 'https://placeholder.supabase.co';
const placeholderKey = supabaseServiceRoleKey || 'placeholder-key';

// Log which key is being used (for debugging)
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('✅ Using SUPABASE_SERVICE_ROLE_KEY for server-side operations (RLS bypassed)');
} else if (supabaseServiceRoleKey) {
  console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY not set - using anon key. RLS policies may block database operations.');
  console.warn('⚠️ To fix: Add SUPABASE_SERVICE_ROLE_KEY to Vercel environment variables.');
}

// Server-side Supabase client with service role key (bypasses RLS)
// This is necessary because we're using NextAuth, not Supabase Auth
// Note: If env vars are missing, this will use placeholder values and fail at runtime
export const supabaseServer = createClient(placeholderUrl, placeholderKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

