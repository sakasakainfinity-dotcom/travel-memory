"use client";

import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";

export default function BackToMapButton() {
  const router = useRouter();

  const btnStyle: CSSProperties = {
    position: "fixed",
    // ★ 画面の一番上から少し下げる＋ノッチぶんも考慮
    top: "calc(env(safe-area-inset-top, 0px) + 32px)",
    left: 16,
    zIndex: 50,
    padding: "8px 12px",
    borderRadius: 9999,
    border: "1px solid rgba(15,23,42,0.12)",
    background: "rgba(255,255,255,0.92)",
    boxShadow: "0 6px 18px rgba(15,23,42,0.18)",
    fontSize: 13,
    fontWeight: 700,
    color: "#0f172a",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 4,
  };

  return (
    <button
      type="button"
      style={btnStyle}
      onClick={() => router.push("/")}
    >
      ← マップに戻る
    </button>
  );
}

