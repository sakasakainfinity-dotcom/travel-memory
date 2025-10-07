"use client";
import { useEffect, useState } from "react";
import PairingButtons from "@/components/PairingButtons";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data.session?.user) {
        window.location.replace("/"); // ← 入ってたらマップへ
        return;
      }
      setChecking(false);
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
