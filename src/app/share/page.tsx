"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SharePage() {
  const [shareUrl, setShareUrl] = useState("");
  const [canWebShare, setCanWebShare] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(window.location.origin); // アプリURL
      setCanWebShare(typeof navigator !== "undefined" && !!navigator.share);
    }
  }, []);

  const title = "TripMemory - 旅の思い出を地図に残そう";
  const text = "TripMemoryで旅の軌跡を地図に残して、家族やパートナーと共有しよう📍";

  async function handleShare(target: "x" | "line" | "instagram" | "threads" | "copy") {
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(text);

    try {
      // Instagram / Threads はまず Web Share API を試す
      if (canWebShare && (target === "instagram" || target === "threads")) {
        await navigator.share({
          title,
          text,
          url: shareUrl,
        });
        return;
      }

      switch (target) {
        case "x": {
          const url = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`;
          window.open(url, "_blank");
          break;
        }
        case "line": {
          const url = `https://line.me/R/share?text=${encodedText}%20${encodedUrl}`;
          window.open(url, "_blank");
          break;
        }
        case "instagram":
        case "threads": {
          await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
          alert(
            `${
              target === "instagram" ? "Instagram" : "Threads"
            }を開いて貼り付けてシェアしてね！\n必要な文はクリップボードにコピーしておいたよ😊`
          );
          break;
        }
        case "copy": {
          await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
          alert("共有用の文をコピーしました！");
          break;
        }
      }
    } catch (e) {
      console.error(e);
      alert("シェアに失敗したみたい… もう一度試してね🥺");
    }
  }

return (
  <div
    style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f172a, #1e293b)",
      color: "#f8fafc",
      padding: "24px",
    }}
  >
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      {/* ← 戻るボタン */}
      <button
        type="button"
        onClick={() => router.back()}
        style={{
          marginBottom: 12,
          padding: "6px 10px",
          borderRadius: 999,
          border: "1px solid #475569",
          background: "rgba(15,23,42,0.9)",
          color: "#e2e8f0",
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        ← 戻る
      </button>

        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>
          アプリをシェアしよう！
        </h1>
        <p style={{ color: "#cbd5e1", fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
          TripMemory を友だちやパートナーに紹介して、いっしょに旅マップを作ろう！
        </p>

        {/* 共有URL + コピー */}
        <div
          style={{
            background: "#0f172a",
            padding: "14px",
            borderRadius: 12,
            border: "1px solid #334155",
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 11, marginBottom: 4, color: "#94a3b8" }}>
            アプリのURL
          </div>
          <div
            style={{
              background: "#020617",
              border: "1px solid #334155",
              padding: "10px",
              borderRadius: 8,
              fontSize: 13,
              wordBreak: "break-all",
            }}
          >
            {shareUrl}
          </div>
          <button
            onClick={() => handleShare("copy")}
            style={{
              marginTop: 8,
              padding: "8px 12px",
              borderRadius: 8,
              background: "#1e293b",
              border: "1px solid #475569",
              color: "#e2e8f0",
              cursor: "pointer",
              width: "100%",
              fontSize: 13,
            }}
          >
            URLと紹介文をコピーする
          </button>
        </div>

        {/* ボタン一覧 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <ShareBtn label="X" emoji="✖️" sub="投稿する" onClick={() => handleShare("x")} />
          <ShareBtn label="LINE" emoji="💬" sub="友だちに送る" onClick={() => handleShare("line")} />
          <ShareBtn label="Instagram" emoji="📸" sub="貼り付けでシェア" onClick={() => handleShare("instagram")} />
          <ShareBtn label="Threads" emoji="🧵" sub="貼り付けでシェア" onClick={() => handleShare("threads")} />
        </div>

        <p style={{ color: "#94a3b8", fontSize: 11, lineHeight: 1.5 }}>
          Instagram / Threads は公式の共有リンクがないため、  
          「コピー → アプリに貼り付け」方式になります。
        </p>
      </div>
    </div>
  );
}

function ShareBtn({
  label,
  emoji,
  sub,
  onClick,
}: {
  label: string;
  emoji: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        background: "#1e293b",
        border: "1px solid #475569",
        color: "#f1f5f9",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>
        {emoji} {label}
      </div>
      <div style={{ fontSize: 11, color: "#cbd5e1" }}>{sub}</div>
    </button>
  );
}


