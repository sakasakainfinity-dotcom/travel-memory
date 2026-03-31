"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SharePage() {
  const router = useRouter();
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  async function copyApp() {
    await navigator.clipboard.writeText(`${origin}\n旅のしおりをAIで作って共有できます！`);
    alert("共有文をコピーしました");
  }

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "20px 14px 100px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 900 }}>シェアする</h1>
      <p style={{ color: "#475569", fontSize: 13, lineHeight: 1.6 }}>
        共有まとめ機能は廃止されました。これからは「旅のしおり」を作成して共有できます。
      </p>

      <section style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, marginTop: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>アプリを紹介する</h2>
        <div style={{ marginTop: 8, fontSize: 12, wordBreak: "break-all" }}>{origin || "読み込み中..."}</div>
        <button onClick={() => void copyApp()} style={btn}>URLをコピー</button>
      </section>

      <section style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, marginTop: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>旅のしおりを共有する</h2>
        <p style={{ fontSize: 13, color: "#475569" }}>
          「旅のしおり」で公開範囲を public に設定すると、しおり詳細から共有リンクを発行できます。
        </p>
        <button onClick={() => router.push("/plans")} style={btn}>旅のしおりへ移動</button>
      </section>
    </main>
  );
}

const btn: React.CSSProperties = {
  marginTop: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  borderRadius: 999,
  padding: "8px 12px",
  fontWeight: 800,
};
