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

        // メールトークンは使わない運用ならこのブロックは不要（残すならこのまま）
        const hp = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : "");
        const at = hp.get("access_token") ?? url.searchParams.get("access_token");
        const rt = hp.get("refresh_token") ?? url.searchParams.get("refresh_token");
        if (at && rt) {
          await supabase.auth.setSession({ access_token: at, refresh_token: rt }).catch(console.error);
          // セッション待ち
          for (let i = 0; i < 30; i++) {
            const { data } = await supabase.auth.getSession();
            if (data.session?.user) return location.replace("/");
            await new Promise(r => setTimeout(r, 100));
          }
          return location.replace("/login?reason=no-session");
        }

        // Google（PKCE）
        const code = url.searchParams.get("code");
        const src = url.searchParams.get("src") || "google";
        if (!code) return location.replace(`/login?reason=no-code&src=${src}`);

        const { error } = await (supabase.auth as any).exchangeCodeForSession(location.href);
        if (error) return location.replace(`/login?reason=exchange&src=${src}`);

        // セッション待ち
        for (let i = 0; i < 30; i++) {
          const { data } = await supabase.auth.getSession();
          if (data.session?.user) return location.replace("/");
          await new Promise(r => setTimeout(r, 100));
        }
        location.replace(`/login?reason=no-session&src=${src}`);
      } catch (e) {
        console.error("callback fatal:", e);
        location.replace("/login?reason=fatal&src=google");
      }
    })();
  }, []);

  return (
    <main style={{ display:"grid", placeItems:"center", height:"100vh" }}>
      <div>ログイン処理中…</div>
    </main>
  );
}

