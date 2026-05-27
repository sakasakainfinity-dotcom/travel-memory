"use client";

import { useRouter, usePathname } from "next/navigation";

export default function PublicToggle() {
  const router = useRouter();
  const pathname = usePathname();

  const isPublic = pathname.startsWith("/public");

  function toggle() {
    if (isPublic) {
      router.push("/"); // private に戻る
    } else {
      router.push("/public"); // public に移動
    }
  }

  return (
    <button
      onClick={toggle}
      style={{
        position: "fixed",
        top: "12px",
        right: "12px",
        zIndex: 99999,
        padding: "6px 14px",
        borderRadius: "999px",
        border: "1px solid #ccc",
        background: isPublic ? "#2563eb" : "#ddd",
        color: isPublic ? "white" : "#333",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {isPublic ? "Public ON" : "Public OFF"}
    </button>
  );
}
