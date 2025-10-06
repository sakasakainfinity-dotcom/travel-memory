// src/app/auth/callback/page.tsx
"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  useEffect(() => {
    (async () => {
      try {
        const h = typeof window !== "undefined" ? window.location.hash : "";

        if (h && (h.includes("access_token=") || h.includes("refresh_token="))) {
          // ★ メール／魔法リンク系：URLハッシュにトークンが入ってくる
          // supabase-js の detectSessionInUrl が true なら自動でセッション確定される
          // ここでは少し待ってからホームへ
          await new Promise((r) => setTimeout(r, 300));
          window.location.replace("/");
          return;
        }

        // ★ OAuth(PKCE) 系：code をセッションに交換
        const fn: any = (supabase.auth as any).exchangeCodeForSession;
        if (typeof fn === "function") {
          const res = fn.length === 1 ? await fn(window.location.href) : await fn();
          if (res?.error) console.error("exchange error:", res.error);
        }
      } catch (e) {
        console.error("auth callback error:", e);
      } finally {
        // 何があっても戻す
        window.location.replace("/");
      }
    })();
  }, []);

  return (
    <main style={{ display:"grid", placeItems:"center", height:"100vh", color:"#fff", background:"#0b0f14" }}>
      <div>ログイン処理中…</div>
    </main>
  );
}



