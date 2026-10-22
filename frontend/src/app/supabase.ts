import { createClient } from '@supabase/supabase-js'

// The publishable key is public by design; row access is denied by the database, not by hiding this key.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
)
