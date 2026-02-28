"use client";

import { useRouter } from "next/navigation";

export default function PlansSuccessPage() {
  const router = useRouter();

  return (
    <div
      style={{
        minHeight: "100svh",
        background: "linear-gradient(135deg, #05070c, #0b1220, #060a12)",
        color: "#f8fafc",
        padding: 24,
        display: "grid",
        placeItems: "center",
      }}
    >
      <div
        style={{
          width: "min(720px, 92vw)",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.06)",
          boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
          padding: 18,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>
          ✅ プレミアム登録が完了しました
        </h1>
        <p style={{ marginTop: 10, color: "rgba(226,232,240,0.8)", lineHeight: 1.7 }}>
          ありがとう。プレミアム機能が使えるようになっとるよ。<br />
          もし反映が遅いときは、いったんページ更新してみて。
        </p>

        <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
          <button
            onClick={() => router.push("/plans")}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.14)",
              background:
                "linear-gradient(135deg, rgba(124,58,237,0.95), rgba(59,130,246,0.85))",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            プラン画面へ戻る
          </button>

          <button
            onClick={() => router.push("/")}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.04)",
              color: "rgba(226,232,240,0.85)",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            ホームへ
          </button>
        </div>
      </div>
    </div>
  );
}
