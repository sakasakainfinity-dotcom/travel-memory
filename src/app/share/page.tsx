"use client";

import { useEffect, useState } from "react";
import AppMenu from "@/components/AppMenu";

export default function SharePage() {
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  async function copyApp() {
    await navigator.clipboard.writeText(`${origin}\n市町村開拓を楽しめる photoMapper をぜひ見てみてください。`);
    alert("共有文をコピーしました");
  }

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "20px 14px 100px" }}>
      <AppMenu current="share" />
      <h1 style={{ fontSize: 24, fontWeight: 900 }}>シェア</h1>
      <p style={{ color: "#475569", fontSize: 13, lineHeight: 1.6 }}>
        photoMapper の紹介テキストをコピーして、友だちに送れます。
      </p>

      <section style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, marginTop: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>アプリを紹介する</h2>
        <div style={{ marginTop: 8, fontSize: 12, wordBreak: "break-all" }}>{origin || "読み込み中..."}</div>
        <button onClick={() => void copyApp()} style={btn}>URLをコピー</button>
      </section>
    </main>
  );
}

const btn = {
  marginTop: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  borderRadius: 999,
  padding: "8px 12px",
  fontWeight: 800,
};
