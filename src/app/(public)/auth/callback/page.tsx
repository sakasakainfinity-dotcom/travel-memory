"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);

        // 1) メール: #access_token / #refresh_token
        const hash = url.hash.startsWith("#") ? url.hash.slice(1) : "";
        const hp = new URLSearchParams(hash);
        const hAccess = hp.get("access_token");
        const hRefresh = hp.get("refresh_token");

        // 2) 一部メーラー: ?access_token / ?refresh_token
        const qAccess = url.searchParams.get("access_token");
        const qRefresh = url.searchParams.get("refresh_token");

        const access_token = hAccess ?? qAccess;
        const refresh_token = hRefresh ?? qRefresh;

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) console.error("setSession error:", error);
          await new Promise((r) => setTimeout(r, 150));
          window.location.replace("/");
          return;
        }

        // 3) OAuth(PKCE): code/state
        const fn: any = (supabase.auth as any).exchangeCodeForSession;
        if (typeof fn === "function") {
          const res = fn.length === 1 ? await fn(window.location.href) : await fn();
          if (res?.error) console.error("exchange error:", res.error);
        }
      } catch (e) {
        console.error("auth callback fatal:", e);
      } finally {
        window.location.replace("/");
      }
    })();
  }, []);

  return (
    <main style={{ display: "grid", placeItems: "center", height: "100vh" }}>
      <div>ログイン処理中…</div>
    </main>
  );
}
