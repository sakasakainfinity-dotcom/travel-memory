// src/lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});

// ---- デバッグ（本番でも見えるようにしとく） ----
if (typeof window !== "undefined") {
  (window as any).__SB_URL__ = url;
  (window as any).__SB_KEY_PRESENT__ = !!key;
  (window as any).supabase = supabase;
  console.log("[supabase] url:", url, "anon key set:", !!key);
}

