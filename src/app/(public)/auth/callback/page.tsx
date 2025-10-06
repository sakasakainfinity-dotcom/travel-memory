"use client";
import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic"; 

export default function AuthCallbackPage() {
  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);

        // 1) メール（token系）
        const hp = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : "");
        const access_token  = hp.get("access_token")  ?? url.searchParams.get("access_token");
        const refresh_token = hp.get("refresh_token") ?? url.searchParams.get("refresh_token");

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) console.error("setSession error:", error);
          window.location.replace("/");
          return;
        }

        // 2) Google OAuth (PKCE)
        const { error } = await (supabase.auth as any).exchangeCodeForSession(window.location.href);
        if (error) console.error("exchange error:", error);
      } catch (e) {
        console.error("callback fatal:", e);
      } finally {
        window.location.replace("/");
      }
    })();
  }, []);

  return (
    <main style={{ display:"grid", placeItems:"center", height:"100vh" }}>
      <div>ログイン処理中…</div>
    </main>
  );
}




