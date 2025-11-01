// src/app/(public)/login/page.tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function loginWithGoogle() {
    setBusy(true);
    try {
      await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}/` } });
    } finally {
      setBusy(false);
    }
  }

  async function loginWithEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${location.origin}/` },
      });
      if (error) throw error;
      alert("メールのリンクを確認してください。");
    } catch (err: any) {
      alert(err.message || "ログインに失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
      <div style={{ width: 360, padding: 24, borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid #333" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>サインイン</h1>
        <p style={{ color: "#aaa", marginBottom: 16 }}>ログインすると、地図と投稿機能が使えるようになるよ。</p>

        <button onClick={loginWithGoogle} disabled={busy} style={{ width: "100%", padding: 12, fontWeight: 700 }}>
          Googleでサインイン
        </button>

        <div style={{ margin: "12px 0", color: "#888", textAlign: "center" }}>または</div>

        <form onSubmit={loginWithEmail} style={{ display: "grid", gap: 8 }}>
          <input
            type="email"
            placeholder="メールアドレス"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ padding: 10 }}
          />
          <button type="submit" disabled={busy} style={{ padding: 10, fontWeight: 700 }}>
            リンクをメールで受け取る
          </button>
        </form>
      </div>
    </div>
  );
}
