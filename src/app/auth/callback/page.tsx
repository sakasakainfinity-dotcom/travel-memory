import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,     // セッション保持
    autoRefreshToken: true,   // 自動更新
    detectSessionInUrl: true, // /auth/callback での交換を許可
    flowType: "pkce",         // OAuthはPKCE
  },
});

// デバッグは必要なら残してOK
if (typeof window !== "undefined") {
  console.log("[supabase] using", url);
  (window as any).supabase = supabase;
}

