"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import AppMenu from "@/components/AppMenu";
import MunicipalitySearchBox from "@/components/MunicipalitySearchBox";
import { MUNICIPALITIES, searchMunicipalities } from "@/lib/municipalities";

export default function MunicipalitiesPage() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const results = useMemo(() => searchMunicipalities(MUNICIPALITIES, query), [query]);

  return (
    <main style={styles.main}>
      <AppMenu current="municipality-search" />

      <section style={styles.content}>
        <h1 style={styles.title}>市町村検索</h1>
        <p style={styles.description}>市町村を探して、その場所の開拓状況を見たり、地図へ移動できます</p>

        <div>
          <MunicipalitySearchBox
            items={MUNICIPALITIES}
            maxResults={10}
            placeholder="市町村名で検索（例：大子町、渋谷区、札幌市）"
            query={query}
            onQueryChange={setQuery}
            onPick={(item) => setQuery(item.fullName)}
          />
        </div>

        <div style={styles.countText}>検索結果: {results.length}件</div>

        <div style={styles.resultList}>
          {results.map((item) => (
            <article key={item.id} style={styles.card}>
              <div>
                <div style={styles.city}>{item.city}</div>
                <div style={styles.prefecture}>{item.prefecture}</div>
              </div>
              <button
                type="button"
                style={styles.mapButton}
                onClick={() =>
                  router.push(
                    `/?lat=${item.lat}&lng=${item.lng}&zoom=11&municipality=${encodeURIComponent(item.fullName)}`
                  )
                }
              >
                地図で見る
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  main: {
    minHeight: "100vh",
    background: "#f8fafc",
    padding: "24px 14px calc(env(safe-area-inset-bottom, 0px) + 24px)",
  },
  content: {
    marginTop: 40,
    display: "grid",
    gap: 12,
  },
  title: {
    margin: 0,
    fontSize: 26,
    fontWeight: 900,
    color: "#0f172a",
  },
  description: {
    margin: 0,
    color: "#475569",
    fontSize: 14,
    lineHeight: 1.6,
  },
  countText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: 700,
  },
  resultList: {
    display: "grid",
    gap: 10,
  },
  card: {
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    background: "#fff",
    boxShadow: "0 6px 14px rgba(15,23,42,0.05)",
    padding: "12px 14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  city: {
    fontSize: 17,
    fontWeight: 900,
    color: "#0f172a",
  },
  prefecture: {
    fontSize: 13,
    color: "#64748b",
  },
  mapButton: {
    border: "1px solid #bfdbfe",
    borderRadius: 10,
    background: "#eff6ff",
    color: "#1d4ed8",
    fontWeight: 800,
    minHeight: 38,
    whiteSpace: "nowrap",
    padding: "0 12px",
  },
};
