"use client";

import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";

export default function BackToMapButton() {
  const router = useRouter();

  const btnStyle: CSSProperties = {
    position: "fixed",
    // 右下フローティング（ノッチ・ホームバーを避ける）
    right: 16,
    bottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
    zIndex: 50,
    padding: "12px 18px",
    borderRadius: 9999,
    border: "none",
    background: "rgba(37,99,235,0.95)",
    boxShadow: "0 10px 24px rgba(15,23,42,0.35)",
    fontSize: 14,
    fontWeight: 800,
    color: "#fff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
  };

  return (
    <button
      type="button"
      style={btnStyle}
      onClick={() => router.push("/")}
    >
      ← マップに戻る（テスト）
    </button>
  );
}


