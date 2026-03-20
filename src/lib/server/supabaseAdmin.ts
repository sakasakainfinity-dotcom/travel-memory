import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseServerEnv } from "./env";

export function getSupabaseAdmin() {
  const { url, serviceRoleKey } = getSupabaseServerEnv();
  return createClient(url, serviceRoleKey);
}
