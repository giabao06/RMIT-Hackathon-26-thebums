import { createClient } from "@supabase/supabase-js";

// backend/.env.local (git-ignored); real environment variables win in deployment.
try {
  process.loadEnvFile(".env.local");
} catch {
  /* no file: rely on the environment */
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required (backend/.env.local)");

export const db = createClient(url, key, { auth: { persistSession: false } });
