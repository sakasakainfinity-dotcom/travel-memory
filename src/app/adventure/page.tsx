"use client";

import type { CSSProperties } from "react";
import AppMenu from "@/components/AppMenu";

export default function AdventurePage() {
  return (
    <main style={styles.main}>
      <AppMenu current="adventure-book" />
      <h1 style={styles.title}>冒険の書</h1>
      <p style={styles.text}>称号・ポイント・特典メーターをここに表示します（準備中）</p>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  main: { minHeight: "100vh", background: "#f8fafc", padding: "24px 14px" },
  title: { marginTop: 28, fontSize: 24, fontWeight: 900 },
  text: { color: "#475569" },
};
