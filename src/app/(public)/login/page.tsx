"use client";

import PairingButtons from "@/components/PairingButtons";

export default function LoginPage() {
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

