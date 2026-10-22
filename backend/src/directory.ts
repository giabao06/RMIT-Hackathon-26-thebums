import type { SupabaseClient } from "@supabase/supabase-js";
import type { Directory } from "./routes/admin";

/**
 * Looks an email up in Supabase Auth with the service role, inviting the person if they have no
 * account yet. shortcut: scans users page by page, fine for a pilot; use a lookup table past a few thousand.
 */
export function supabaseDirectory(db: SupabaseClient): Directory {
  return {
    async userIdForEmail(email) {
      for (let page = 1; page <= 20; page++) {
        const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
        if (error) throw error;
        const found = data.users.find((u) => u.email?.toLowerCase() === email);
        if (found) return found.id;
        if (data.users.length < 200) break;
      }
      const { data, error } = await db.auth.admin.inviteUserByEmail(email);
      if (error) throw error;
      return data.user?.id ?? null;
    },
  };
}
