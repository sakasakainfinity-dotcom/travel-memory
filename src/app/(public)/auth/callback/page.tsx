"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic"; // 予防：静的化を避ける

export default function AuthCallbackPage() {
  const [msg, setMsg] = useState("準備中…");

  useEffect(() => {
    (async () => {
      try {
        setMsg("コールバック到着: " + window.location.href);

        const url = new URL(window.location.href);

        // 1) ハッシュ / クエリから token を拾う
        const hash = url.hash.startsWith("#") ? url.hash.slice(1) : "";
        const hp = new URLSearchParams(hash);
        const hAccess = hp.get("access_token");
        const hRefresh = hp.get("refresh_token");
        const qAccess = url.searchParams.get("access_token");
        const qRefresh = url.searchParams.get("refresh_token");

        const access_token = hAccess ?? qAccess;
        const refresh_token = hRefresh ?? qRefresh;

        if (access_token && refresh_token) {
          setMsg("setSession 実行中…");
          const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) throw error;
          setMsg("setSession OK: " + (data.session?.user?.email ?? "no email"));
          return; // ← ここではリダイレクトしない
        }

        // 2) PKCE（Google）: code/state を交換
        setMsg("exchangeCodeForSession 実行中…");
        const fn: any = (supabase.auth as any).exchangeCodeForSession;
        if (typeof fn === "function") {
          const res = fn.length === 1 ? await fn(window.location.href) : await fn();
          if (res?.error) throw res.error;
          setMsg("exchange OK: " + (res?.data?.session?.user?.email ?? "maybe set"));
          return;
        }

        setMsg("なにも拾えんかった（tokenもcodeも無し）");
      } catch (e: any) {
        console.error(e);
        setMsg("エラー: " + (e?.message ?? String(e)));
      }
    })();
  }, []);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <div style={{ maxWidth: 680 }}>
        <h2>/auth/callback デバッグ</h2>
        <pre style={{ whiteSpace: "pre-wrap" }}>{msg}</pre>
        <p>この画面から自動遷移しない：セッション確立の可否をまず確認する。</p>
      </div>
    </main>
  );
}

