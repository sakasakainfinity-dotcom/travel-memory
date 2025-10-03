// src/lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key);

// --- デバッグ: ブラウザのConsoleから見えるようにする ---
if (typeof window !== "undefined") {
  console.log("[supabase] using", url);
  (window as any).__SUPABASE_URL__ = url;
  (window as any).__SUPABASE_ANON_HEAD__ = key.slice(0, 16) + "...";
  (window as any).supabase = supabase; // ついでにクライアントも触れるように
}
