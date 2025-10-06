// src/components/PairingButtons.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function PairingButtons() {
  const [email, setEmail] = useState("");
  const [authed, setAuthed] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sent, setSent] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  const router = useRouter();

  // セッション監視
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setAuthed(!!data.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setAuthed(!!s?.user);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Google でログイン
  const loginGoogle = async () => {
    try {
      setLoadingGoogle(true);
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
    } catch (e) {
      console.error(e);
      alert("Googleログインでエラーが出たよ。時間をおいて再試行してね。");
      setLoadingGoogle(false);
    }
  };

  // メールでログイン（マジックリンク）
  const loginEmail = async () => {
    if (!email) {
      alert("メールアドレスを入れてね");
      return;
    }
    try {
      setSendingEmail(true);
      await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      setSent(true);
      alert(
        "ログイン用リンクを送ったよ。\nメールアプリで開くと別ブラウザになることがあるけぇ、その場合は『ブラウザで開く』を選んでね。"
      );
    } catch (e) {
      console.error(e);
      alert("メール送信に失敗したみたい。アドレスを確認して、もう一度ためして。");
    } finally {
      setSendingEmail(false);
    }
  };

  // ログアウト → すぐ /login
  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      router.replace("/login");
    }
  };

  // 未ログイン時のUI
  if (!authed) {
    return (
      <div className="auth-buttons">
        <button
          className="btn btn-primary w-full"
          onClick={loginGoogle}
          disabled={loadingGoogle}
          aria-busy={loadingGoogle}
        >
          {loadingGoogle ? "処理中…" : "Googleでログイン"}
        </button>

        <div className="auth-row">
          <input
            type="email"
            className="input flex-1"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={sent || sendingEmail}
            inputMode="email"
            autoComplete="email"
          />
          <button
            className="btn"
            onClick={loginEmail}
            disabled={sent || sendingEmail}
            aria-busy={sendingEmail}
          >
            {sent ? "メールを送ったよ" : sendingEmail ? "送信中…" : "メールでログイン"}
          </button>
        </div>
      </div>
    );
  }

  // ログイン済み時のUI（トップ右上などで出す）
  return (
    <div className="auth-buttons">
      <button className="btn" onClick={logout}>
        ログアウト
      </button>
    </div>
  );
}










