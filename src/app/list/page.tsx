"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type MyPlace = {
  place_key: string;
  title: string;
  wanted: boolean;
  visited: boolean;
  last_at: string; // 並び替え用
};

export default function PilgrimagePage() {
  const router = useRouter();

  const [myPlaces, setMyPlaces] = useState<MyPlace[]>([]);
  const [myErr, setMyErr] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // ✅ public地図の ☆/✓ から自動で出す（place_flags）
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setMyErr(null);

        const { data: ses } = await supabase.auth.getSession();
        const uid = ses.session?.user.id;
        if (!uid) {
          setMyPlaces([]);
          return;
        }

        const { data, error } = await supabase
          .from("place_flags")
          .select("place_key, kind, created_at")
          .eq("user_id", uid)
          .in("kind", ["want", "visited"])
          .order("created_at", { ascending: false });

        if (error) throw error;

        // 取得した data だけでまとめる（再fetchしない）
        const byKey: Record<string, MyPlace> = {};

        for (const r of (data ?? []) as any[]) {
          const key = r.place_key as string;
          const kind = r.kind as "want" | "visited";
          const createdAt = r.created_at as string;

          if (!byKey[key]) {
            byKey[key] = {
              place_key: key,
              title: (key.split("|")[0] ?? key) as string,
              wanted: false,
              visited: false,
              last_at: createdAt,
            };
          }

          // 最新の日時を保持（並び替え用）
          if (createdAt > byKey[key].last_at) byKey[key].last_at = createdAt;

          if (kind === "want") byKey[key].wanted = true;
          if (kind === "visited") byKey[key].visited = true;
        }

        // 並び：最新順
        const arr = Object.values(byKey).sort((a, b) =>
          (b.last_at ?? "").localeCompare(a.last_at ?? "")
        );

        setMyPlaces(arr);
      } catch (e: any) {
        setMyErr(e?.message ?? String(e));
        setMyPlaces([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const stats = useMemo(() => {
    const total = myPlaces.filter((p) => p.wanted || p.visited).length;
    const done = myPlaces.filter((p) => p.visited).length;
    const rate = total === 0 ? 0 : Math.round((done / total) * 100);
    return { total, done, rate };
  }, [myPlaces]);

  const wantList = useMemo(
    () => myPlaces.filter((p) => p.wanted && !p.visited),
    [myPlaces]
  );
  const doneList = useMemo(() => myPlaces.filter((p) => p.visited), [myPlaces]);

  return (
    <div
      style={{
        minHeight: "100svh",
        background: "linear-gradient(135deg, #05070c, #0b1220, #060a12)",
        color: "#f8fafc",
        padding: "24px",
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        {/* Top bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          

          <div style={{ fontSize: 12, color: "rgba(226,232,240,0.55)" }}>
            My List
          </div>
        </div>

        {/* Hero */}
        <div style={{ marginTop: 18 }}>
          <h1
            style={{
              fontSize: 30,
              fontWeight: 900,
              letterSpacing: -0.3,
              marginBottom: 8,
            }}
          >
            行きたい / 行った
          </h1>
          <div style={{ fontSize: 12, color: "rgba(226,232,240,0.65)" }}>
            public地図で ⭐（行きたい）/ ✓（行った）を押したら、ここに自動で出るよ。
          </div>
        </div>

        {/* Error */}
        {myErr && (
          <div
            style={{
              marginTop: 14,
              fontSize: 12,
              color: "rgba(248,113,113,0.95)",
              border: "1px solid rgba(248,113,113,0.25)",
              background: "rgba(248,113,113,0.06)",
              padding: "10px 12px",
              borderRadius: 12,
            }}
          >
            読み込みエラー：{myErr}
          </div>
        )}

        {/* ✅ 達成率（1枚だけ） */}
        <SectionTitle title="達成率" />
        <div
          style={{
            borderRadius: 16,
            border: "1px solid rgba(148,163,184,0.20)",
            background: "rgba(255,255,255,0.03)",
            padding: 14,
            boxShadow: "0 30px 80px -45px rgba(0,0,0,0.85)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(226,232,240,0.85)" }}>
              進捗
            </div>
            <div style={{ fontSize: 12, color: "rgba(226,232,240,0.75)" }}>
              {stats.rate}%（{stats.done}/{stats.total}）
            </div>
          </div>

          <div
            style={{
              marginTop: 8,
              height: 8,
              borderRadius: 999,
              background: "rgba(148,163,184,0.18)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${stats.rate}%`,
                height: "100%",
                background: "rgba(34,197,94,0.85)",
              }}
            />
          </div>

          {loading && (
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
              読み込み中…
            </div>
          )}
        </div>

        {/* ✅ 行きたいリスト */}
        <SectionTitle title={`行きたい（${wantList.length}）`} />
        <div
          style={{
            borderRadius: 16,
            border: "1px solid rgba(148,163,184,0.20)",
            background: "rgba(255,255,255,0.03)",
            padding: 14,
            boxShadow: "0 30px 80px -45px rgba(0,0,0,0.85)",
          }}
        >
          {wantList.length === 0 ? (
            <div style={{ opacity: 0.7, fontSize: 13 }}>
              まだないよ。public地図で ⭐ 押してみ。
            </div>
          ) : (
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              {wantList.map((p) => (
                <li
                  key={p.place_key}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 10,
                    fontSize: 14,
                    marginBottom: 6,
                  }}
                >
                  <span style={{ fontWeight: 800 }}>{p.title}</span>
                  <span style={{ fontSize: 16 }}>⭐</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ✅ 行ったリスト */}
        <SectionTitle title={`行った（${doneList.length}）`} />
        <div
          style={{
            borderRadius: 16,
            border: "1px solid rgba(148,163,184,0.20)",
            background: "rgba(255,255,255,0.03)",
            padding: 14,
            boxShadow: "0 30px 80px -45px rgba(0,0,0,0.85)",
          }}
        >
          {doneList.length === 0 ? (
            <div style={{ opacity: 0.7, fontSize: 13 }}>
              まだないよ。public地図で ✓ 押してみ。
            </div>
          ) : (
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              {doneList.map((p) => (
                <li
                  key={p.place_key}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 10,
                    fontSize: 14,
                    marginBottom: 6,
                  }}
                >
                  <span style={{ fontWeight: 800 }}>{p.title}</span>
                  <span style={{ color: "rgba(34,197,94,0.95)", fontWeight: 900 }}>
                    ✓
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <button
      type="button"
      onClick={() => router.push("/")}
      style={{
        position: "fixed",
        right: "max(14px, env(safe-area-inset-right, 0px))",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)",
        zIndex: 99999,
        padding: "12px 14px",
        borderRadius: 999,
        border: "1px solid rgba(148,163,184,0.35)",
        background: "rgba(2,6,23,0.70)",
        color: "#e2e8f0",
        fontSize: 13,
        fontWeight: 900,
        cursor: "pointer",
        boxShadow: "0 14px 34px rgba(0,0,0,0.35)",
        backdropFilter: "blur(8px)",
        minHeight: 44,
      }}
    >
      地図へ ↩
    </button>

  </div>
);
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div
      style={{
        marginTop: 18,
        marginBottom: 10,
        fontSize: 13,
        fontWeight: 800,
        color: "rgba(226,232,240,0.9)",
        letterSpacing: 0.5,
      }}
    >
      {title}
    </div>
  );
}




     
