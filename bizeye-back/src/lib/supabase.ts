import { createClient } from '@supabase/supabase-js';
import { requireServerEnv } from '../config/env';

export const createSupabaseAdminClient = () => {
  const env = requireServerEnv();

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

