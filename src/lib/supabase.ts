import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://eeekhudbcztguvuzhwiy.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_1MiegrSpoAIQjxVzROIWZw_pnNRB61P';

export const supabase = createClient(supabaseUrl, supabaseKey);