import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Use service role key for server-side operations to bypass RLS
// This is safe because it's only used server-side and never exposed to the client
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  const missingVars = [];
  if (!supabaseUrl) missingVars.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseServiceRoleKey) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      missingVars.push('SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }
  }
  throw new Error(`Missing Supabase environment variables: ${missingVars.join(', ')}. Please set these in Vercel environment variables.`);
}

// Log which key is being used (for debugging)
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('✅ Using SUPABASE_SERVICE_ROLE_KEY for server-side operations (RLS bypassed)');
} else {
  console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY not set - using anon key. RLS policies may block database operations.');
  console.warn('⚠️ To fix: Add SUPABASE_SERVICE_ROLE_KEY to .env.local');
}

// Server-side Supabase client with service role key (bypasses RLS)
// This is necessary because we're using NextAuth, not Supabase Auth
export const supabaseServer = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

