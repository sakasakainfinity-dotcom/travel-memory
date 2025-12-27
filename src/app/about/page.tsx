// src/app/about/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/* ------------------------
   丸アイコンコンポーネント
------------------------- */
function CircleImage({ src, size = 90 }: { src: string; size?: number }) {
  return (
    <img
      src={src}
      alt=""
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        objectFit: "cover",
        border: "2px solid #334155",
      }}
    />
  );
}

export default function AboutPage() {
  const router = useRouter();
  const [feedback, setFeedback] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <div
      style={{
        padding: "20px",
        maxWidth: 720,
        margin: "0 auto",
        color: "#e2e8f0",
        background: "#0f172a",
        minHeight: "100vh",
        lineHeight: 1.6,
      }}
    >
      

      {/* 開発者プロフィール */}
      <section
        style={{
          background: "rgba(15,23,42,0.9)",
          borderRadius: 16,
          padding: 18,
          border: "1px solid rgba(148,163,184,0.4)",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 10,
          }}
        >
          <CircleImage src="/profile-dev.jpg" size={85} />
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
              開発者：かずき
            </h2>
            <div style={{ fontSize: 13, color: "#94a3b8" }}>
              TripMemory 制作者
            </div>
          </div>
        </div>

        <p style={{ fontSize: 14 }}>
          茨城県で「まちやど Motomachi」「古民家宿 Tabi湊」を運営しながら、
          旅の思い出をちゃんと残せるアプリを作りたくて
          TripMemory を開発しています。
        </p>
      </section>

       {/* TripMemory 使い方案内 */}
<section
  style={{
    background: "rgba(15,23,42,0.9)",
    borderRadius: 16,
    padding: 18,
    border: "1px solid rgba(148,163,184,0.4)",
    marginBottom: 20,
  }}
>
  <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
    TripMemory の使い方
  </h2>

  <p style={{ fontSize: 14, color: "#e2e8f0", marginBottom: 12 }}>
    旅の写真を地図に残して、  
    行きたい場所・行った場所をまとめて管理できるアプリです。
  </p>

  <a
    href="https://daigo-machiyado.jp/feature/triomemory/"
    target="_blank"
    rel="noopener noreferrer"
    style={{
      display: "block",
      width: "100%",
      textAlign: "center",
      padding: "12px 0",
      background: "#3b82f6",
      color: "#fff",
      borderRadius: 12,
      fontWeight: 800,
      fontSize: 14,
      textDecoration: "none",
      boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
    }}
  >
    ▶ TripMemory の使い方はこちら
  </a>
</section>


      {/* まちやど Motomachi */}
      <section
        style={{
          background: "rgba(15,23,42,0.9)",
          borderRadius: 16,
          padding: 18,
          border: "1px solid rgba(148,163,184,0.4)",
          marginBottom: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <CircleImage src="/motomachi.jpg" size={70} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              まちやど「Motomachi」
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>茨城県大子町</div>
          </div>
        </div>

        <p style={{ marginTop: 10, fontSize: 13 }}>
          商店街の一角にある、小さなまちやど。  
          「旅人と地元が自然につながる場所」を目指しています。
        </p>

        <a
          href="https://daigo-machiyado.jp/"
          target="_blank"
          style={{
            marginTop: 10,
            display: "inline-block",
            fontSize: 13,
            color: "#60a5fa",
          }}
        >
          ▶ 公式サイトを見る
        </a>
      </section>

      {/* Tabi湊 */}
      <section
        style={{
          background: "rgba(15,23,42,0.9)",
          borderRadius: 16,
          padding: 18,
          border: "1px solid rgba(148,163,184,0.4)",
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <CircleImage src="/tabiminato.jpg" size={70} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              古民家宿「Tabi湊」
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>
              茨城県ひたちなか市
            </div>
          </div>
        </div>

        <p style={{ marginTop: 10, fontSize: 13 }}>
          海沿いの静かな古民家を一棟貸しした宿。  
          特に BBQ や家族旅行に人気です。
        </p>

        <a
          href="https://tabiminatoinn.com/"
          target="_blank"
          style={{
            marginTop: 10,
            display: "inline-block",
            fontSize: 13,
            color: "#60a5fa",
          }}
        >
          ▶ 公式サイトを見る
        </a>
      </section>

       {/* 🔙 戻る（右下固定） */}
<button
  onClick={() => router.back()}
  style={{
    position: "fixed",
    right: "20px",
    bottom: "20px",
    zIndex: 9999,
    padding: "10px 16px",
    background: "#111827",
    color: "#fff",
    borderRadius: "999px",
    border: "1px solid #000",
    fontSize: "14px",
    fontWeight: 700,
    boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
    cursor: "pointer",
  }}
>
  戻る
</button>

      {/* フィードバック */}
      <section
        style={{
          background: "rgba(15,23,42,0.9)",
          borderRadius: 16,
          padding: 18,
          border: "1px solid rgba(148,163,184,0.4)",
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>
          アプリ改善のご意見・フィードバック
        </h3>

        {sent ? (
          <div style={{ color: "#4ade80", fontSize: 14 }}>
            送信ありがとう！  
            しっかり目を通して、改善に活かすけぇね！
          </div>
        ) : (
          <>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="不具合、改善してほしい点、追加してほしい機能など…"
              style={{
                width: "100%",
                height: 140,
                borderRadius: 12,
                padding: 12,
                border: "1px solid #475569",
                background: "#1e293b",
                color: "#fff",
                fontSize: 14,
              }}
            />

            <button
              onClick={() => {
                console.log("feedback:", feedback); // ★後で supabase に保存可
                setSent(true);
              }}
              style={{
                marginTop: 12,
                width: "100%",
                padding: "10px 0",
                background: "#3b82f6",
                color: "#fff",
                borderRadius: 10,
                border: "none",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              送信する
            </button>
          </>
        )}
      </section>
    </div>
  );
}

