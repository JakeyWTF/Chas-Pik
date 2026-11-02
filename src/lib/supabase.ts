import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://boutcreozkvvycbmvwok.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_5ZfnfFO0ghpOMK4vBbPlQA_zU3G5yzs';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
