// src/app/(public)/auth/callback/page.tsx
"use client";
import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

export default function AuthCallbackPage() {
  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);

        // --- 1) メール（# でも ? でも拾う） ---
        const hp = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : "");
        const access_token  = hp.get("access_token")  ?? url.searchParams.get("access_token");
        const refresh_token = hp.get("refresh_token") ?? url.searchParams.get("refresh_token");

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) console.error("[callback] setSession error:", error);
        } else {
          // --- 2) Google (PKCE): code があるときだけ交換 ---
          const hasCode = url.searchParams.has("code");
          const ex: any = (supabase.auth as any)?.exchangeCodeForSession;
          if (hasCode && typeof ex === "function") {
            const { error } = await ex(window.location.href); // v2 は URL 渡すのが安定
            if (error) console.error("[callback] exchange error:", error);
          }
        }

        // --- 3) セッション確定を待つ（最大 ~2秒） ---
        for (let i = 0; i < 20; i++) {
          const { data } = await supabase.auth.getSession();
          if (data.session?.user) {
            window.location.replace("/");
            return;
          }
          await new Promise((r) => setTimeout(r, 100));
        }

        // ここまでで取れんかったら失敗
        window.location.replace("/login?reason=callback");
      } catch (e) {
        console.error("[callback] fatal:", e);
        window.location.replace("/login?reason=callback-fatal");
      }
    })();
  }, []);

  return (
    <main style={{ display:"grid", placeItems:"center", height:"100vh" }}>
      <div>ログイン処理中…</div>
    </main>
  );
}





