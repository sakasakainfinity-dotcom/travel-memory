"use client";

import type { CSSProperties } from "react";
import AppMenu from "@/components/AppMenu";

export default function SettingsPage() {
  return (
    <main style={styles.main}>
      <AppMenu current="settings" />
      <h1 style={styles.title}>アプリ設定</h1>
      <p style={styles.text}>通知や表示設定などをここにまとめます（準備中）</p>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  main: { minHeight: "100vh", background: "#f8fafc", padding: "24px 14px" },
  title: { marginTop: 28, fontSize: 24, fontWeight: 900 },
  text: { color: "#475569" },
};
