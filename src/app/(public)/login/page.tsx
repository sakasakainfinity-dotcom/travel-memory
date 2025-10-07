"use client";
import { useEffect, useState } from "react";
import PairingButtons from "@/components/PairingButtons";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
  let mounted = true;
  (async () => {
    // 既に入ってたら即TOPへ
    const { data } = await supabase.auth.getSession();
    if (!mounted) return;
    if (data.session?.user) return window.location.replace("/");

    // ここから自動リトライ：理由と意図をチェック
    const params = new URLSearchParams(location.search);
    const reason = params.get("reason");   // no-code / exchange / no-session / fatal など
    const src = params.get("src");         // "google" が来る
    const intent = sessionStorage.getItem("oauth_intent");     // "google" を期待
    const retried = sessionStorage.getItem("oauth_retry_once") === "1";

    if (src === "google" && intent === "google" && !retried && reason) {
      // ★1回だけ自動でクリーン→再挑戦
      sessionStorage.setItem("oauth_retry_once", "1");

      await supabase.auth.signOut();
      try {
        localStorage.removeItem("sb-pkce-code-verifier");
        sessionStorage.removeItem("sb-pkce-code-verifier");
        Object.keys(localStorage).filter(k=>k.startsWith("sb-")).forEach(k=>localStorage.removeItem(k));
        Object.keys(sessionStorage).filter(k=>k.startsWith("sb-")).forEach(k=>sessionStorage.removeItem(k));
      } catch {}

      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?src=google`,
          queryParams: { prompt: "select_account" },
          scopes: "openid email profile",
        },
      });
    } else {
      // 何もしない（ユーザーにボタンを見せる）
      setChecking(false);
    }
  })();

  const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
    if (s?.user) window.location.replace("/");
  });
  return () => { mounted = false; sub.subscription.unsubscribe(); };
}, []);


  if (checking) {
    return <main style={{ minHeight:"100vh", display:"grid", placeItems:"center" }}>読み込み中…</main>;
  }

  return (
    <main className="login-wrap">
      <div className="login-bg" />
      <div className="login-card">
        <div className="login-logo">🌀</div>
        <h1 className="login-title">サインイン</h1>
        <p className="login-sub">ログインすると、地図と投稿機能が使えるようになるよ。</p>
        <div style={{ height: 10 }} />
        <PairingButtons />
        <div style={{ height: 8 }} />
        <p className="login-note">
          ログインは <b>Google</b> または <b>メール</b> に対応。メールはリンク or 6桁コードでサインインできるよ。
        </p>
      </div>
    </main>
  );
}
