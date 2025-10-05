// src/app/login/page.tsx
"use client";

import PairingButtons from "@/components/PairingButtons";

export default function LoginPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#0b0f14",
        color: "white",
      }}
    >
      <div
        style={{
          width: "min(520px, 92vw)",
          padding: 24,
          borderRadius: 16,
          background: "#121820",
          boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: 12 }}>サインイン</h1>
        <p style={{ color: "#9aa4b2", marginTop: 0 }}>
          ログインすると、地図と投稿機能が使えるようになるよ。
        </p>
        <PairingButtons />
      </div>
    </main>
  );
}

