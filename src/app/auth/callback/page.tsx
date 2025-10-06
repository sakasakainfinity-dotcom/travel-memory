// src/app/auth/callback/page.tsx
"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);

        // 1) メールリンク想定（普通は hash に access_token / refresh_token）
        const hash = url.hash.startsWith("#") ? url.hash.slice(1) : "";
        const hashParams = new URLSearchParams(hash);
        const hAccess = hashParams.get("access_token");
        const hRefresh = hashParams.get("refresh_token");

        // 2) メーラーや中継で # が ? に変わるケース（クエリ側を見る）
        const qAccess = url.searchParams.get("access_token");
        const qRefresh = url.searchParams.get("refresh_token");

        // 3) どちらかで token が来てたら setSession で確定
        const access_token = hAccess ?? qAccess;
        const refresh_token = hRefresh ?? qRefresh;

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) console.error("setSession error:", error);
          // セッション確定に少し猶予
          await new Promise((r) => setTimeout(r, 150));
          window.location.replace("/");
          return;
        }

        // 4) ここまで来たら PKCE(OAuth) 想定 → code をセッションに交換
        //   exchangeCodeForSession は v2 で引数数の差異があるため安全に呼び分け
        const fn: any = (supabase.auth as any).exchangeCodeForSession;
        if (typeof fn === "function") {
          try {
            const res = fn.length === 1 ? await fn(window.location.href) : await fn();
            if (res?.error) console.error("exchange error:", res.error);
          } catch (e) {
            console.error("exchange threw:", e);
          }
        }
      } catch (e) {
        console.error("auth callback fatal:", e);
      } finally {
        window.location.replace("/"); // 何があってもホームへ
      }
    })();
  }, []);

  return (
    <main style={{ display:"grid", placeItems:"center", height:"100vh", color:"#e7eef7", background:"#0b0f14" }}>
      <div>ログイン処理中…</div>
    </main>
  );
}


