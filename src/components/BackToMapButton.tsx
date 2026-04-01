"use client";

import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";

export default function BackToMapButton() {
  const router = useRouter();

  const btnStyle: CSSProperties = {
    position: "fixed",
    right: 16,
    bottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
    zIndex: 50,
    padding: "12px 18px",
    borderRadius: 9999,
    border: "1px solid rgba(148,163,184,0.55)",
    background: "linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.95))",
    boxShadow: "0 12px 30px rgba(2,6,23,0.55)",
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
      ← 地図に戻る
    </button>
  );
}

