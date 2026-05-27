import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseServerEnv } from "./env";

export function getSupabaseAdmin() {
  const { url, serviceRoleKey } = getSupabaseServerEnv();

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
