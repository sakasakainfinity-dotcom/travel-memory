// src/app/(public)/auth/callback/page.tsx
"use client";
import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

export default function AuthCallbackPage() {
  useEffect(() => {
    (async () => {
      try {
        const url = new URL(location.href);
        const code = url.searchParams.get("code");
        if (!code) { location.replace("/login?reason=no-code"); return; }

        // 1) code をセッションに交換（v2はURLを渡す）
        const { error } = await (supabase.auth as any).exchangeCodeForSession(location.href);
        if (error) { console.error("exchange error:", error); location.replace("/login?reason=exchange"); return; }

        // 2) セッション確定を待つ（最大3秒）
        for (let i = 0; i < 30; i++) {
          const { data } = await supabase.auth.getSession();
          if (data.session?.user) { location.replace("/"); return; }
          await new Promise(r => setTimeout(r, 100));
        }
        location.replace("/login?reason=no-session");
      } catch (e) {
        console.error("callback fatal:", e);
        location.replace("/login?reason=fatal");
      }
    })();
  }, []);

  return (
    <main style={{ display:"grid", placeItems:"center", height:"100vh" }}>
      <div>ログイン処理中…</div>
    </main>
  );
}

