"use client";

import type { CSSProperties } from "react";
import AppMenu from "@/components/AppMenu";

export default function MunicipalitiesPage() {
  return (
    <main style={styles.main}>
      <AppMenu current="municipality-search" />
      <h1 style={styles.title}>市町村検索</h1>
      <p style={styles.text}>ここでは市町村を検索できるようにします（準備中）</p>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  main: { minHeight: "100vh", background: "#f8fafc", padding: "24px 14px" },
  title: { marginTop: 28, fontSize: 24, fontWeight: 900 },
  text: { color: "#475569" },
};
