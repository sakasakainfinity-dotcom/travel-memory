"use client";

const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
const inApp = /FBAN|FBAV|Instagram|Line|Twitter|TwitterLite|MicroMessenger|GSA|Gmail|YahooMobile/i.test(ua);


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

{inApp && (
  <div style={{
    marginBottom: 12, padding: "10px 12px", borderRadius: 12,
    background: "rgba(255,200,0,.12)", border: "1px solid rgba(255,200,0,.35)"
  }}>
    <b>アプリ内ブラウザを検出:</b> 正常にログインできん場合があるけぇ、右上メニューから
    <b>「ブラウザで開く」</b> を選んでね（Safari/Chrome推奨）。<br/>
    それか <b>6桁コード</b> でログインしてもOK。
  </div>
)}
