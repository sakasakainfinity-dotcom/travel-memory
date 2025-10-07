// app/(public)/auth/callback/page.tsx（Google専用シンプル版）
"use client";
import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
export const dynamic = "force-dynamic";

export default function AuthCallbackPage() {
  useEffect(() => {
    (async () => {
      try {
        const url = new URL(location.href);
        if (url.searchParams.has("code")) {
          const { error } = await (supabase.auth as any).exchangeCodeForSession(location.href);
          if (error) console.error("[callback] exchange error:", error);
        }
        // セッション確定待ち
        for (let i = 0; i < 20; i++) {
          const { data } = await supabase.auth.getSession();
          if (data.session?.user) return location.replace("/");
          await new Promise(r => setTimeout(r, 100));
        }
        location.replace("/login?reason=callback");
      } catch (e) {
        console.error("[callback] fatal:", e);
        location.replace("/login?reason=callback-fatal");
      }
    })();
  }, []);
  return <main style={{display:"grid",placeItems:"center",height:"100vh"}}><div>ログイン処理中…</div></main>;
}
