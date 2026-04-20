import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Public, stateless Supabase client — no cookies, no auth session.
// Safe to call inside unstable_cache() in Next 16 (which forbids
// accessing dynamic data sources like cookies from cached functions).
// Use for public routes that only need anon-scoped RLS access.
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}
