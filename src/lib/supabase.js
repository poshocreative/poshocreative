import { createClient } from '@supabase/supabase-js';

const fallbackSupabaseUrl =
  'https://cocsnjywtqggbenipsoh.supabase.co';

const fallbackSupabasePublishableKey =
  'sb_publishable_eziuJejIeWeiG4s-yqsIIg_dgghwZAB';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  fallbackSupabaseUrl;

const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  fallbackSupabasePublishableKey;

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);