"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type LayerDef = {
  slug: string;
  title: string;
  desc: string;
  emoji: string;
  status?: "live" | "coming";
};

const LAYERS: LayerDef[] = [
  {
    slug: "jp-world-heritage",
    title: "日本の世界遺産",
    desc: "地図に重ねて、行った場所を塗る。",
    emoji: "🏯",
    status: "live",
  },
  {
    slug: "jp-best-views-100",
    title: "日本の絶景100",
    desc: "近日追加。お気に入り登録で管理。",
    emoji: "✨",
    status: "coming",
  },
];

const LS_LAYER_TOGGLE_VISIBLE = "tm_layer_toggle_visible";
const LS_ENABLED_LAYER_SLUGS = "tm_enabled_layer_slugs";

export default function PilgrimagePage() {
  const router = useRouter();
  const [enabled, setEnabled] = useState<string[]>([]);
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const [overallRate, setOverallRate] = useState<number | null>(null);
  const [rateBySlug, setRateBySlug] = useState<
    Record<string, { done: number; total: number; rate: number }>
  >({});
  const [rateErr, setRateErr] = useState<string | null>(null);

  // ✅ My巡礼（public地図の ☆ / ☑ から自動で出す）
type MyPlace = {
  place_key: string;
  title: string;
  wanted: boolean;
  visited: boolean;
  last_at: string; // 並び替え用
};

const [myPlaces, setMyPlaces] = useState<MyPlace[]>([]);
const [myErr, setMyErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setRateErr(null);

        let enabledSlugs: string[] = [];
        try {
          const raw = localStorage.getItem(LS_ENABLED_LAYER_SLUGS);
          const arr = raw ? JSON.parse(raw) : [];
          enabledSlugs = Array.isArray(arr) ? arr : [];
        } catch {
          enabledSlugs = [];
        }

        if (enabledSlugs.length === 0) {
          setOverallRate(0);
          setRateBySlug({});
          return;
        }

        const { data: ses } = await supabase.auth.getSession();
        const uid = ses.session?.user.id;
        if (!uid) {
          setOverallRate(null);
          setRateBySlug({});
          return;
        }

        const { data: missions } = await supabase
          .from("pilgrimage_missions")
          .select("id, slug")
          .in("slug", enabledSlugs);

        const missionIdBySlug: Record<string, string> = {};
        for (const m of missions ?? []) missionIdBySlug[m.slug] = m.id;

        const { data: spots } = await supabase
          .from("pilgrimage_spots")
          .select("id, mission_id")
          .in("mission_id", Object.values(missionIdBySlug));

        const totalBySlug: Record<string, number> = {};
        const spotIdsBySlug: Record<string, Set<string>> = {};
        for (const slug of enabledSlugs) {
          totalBySlug[slug] = 0;
          spotIdsBySlug[slug] = new Set();
        }

        for (const s of spots ?? []) {
          const slug = Object.keys(missionIdBySlug).find(
            (k) => missionIdBySlug[k] === s.mission_id
          );
          if (!slug) continue;
          totalBySlug[slug] += 1;
          spotIdsBySlug[slug].add(s.id);
        }

        const { data: prog } = await supabase
          .from("pilgrimage_progress")
          .select("spot_id")
          .eq("user_id", uid);

        const doneSpotIds = new Set((prog ?? []).map((r: any) => r.spot_id));

        const nextBySlug: Record<
          string,
          { done: number; total: number; rate: number }
        > = {};
        let doneAll = 0;
        let totalAll = 0;

        for (const slug of enabledSlugs) {
          const total = totalBySlug[slug] ?? 0;
          let done = 0;
          for (const id of spotIdsBySlug[slug] ?? new Set()) {
            if (doneSpotIds.has(id)) done += 1;
          }
          const rate = total === 0 ? 0 : Math.round((done / total) * 100);
          nextBySlug[slug] = { done, total, rate };
          doneAll += done;
          totalAll += total;
        }

        setRateBySlug(nextBySlug);
        setOverallRate(
          totalAll === 0 ? 0 : Math.round((doneAll / totalAll) * 100)
        );
      } catch (e: any) {
        setRateErr(e?.message ?? String(e));
        setOverallRate(null);
        setRateBySlug({});
      }
    })();
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_ENABLED_LAYER_SLUGS);
      const arr = raw ? JSON.parse(raw) : [];
      setEnabled(Array.isArray(arr) ? arr : []);
    } catch {
      setEnabled([]);
    }
  }, []);

  const addLayer = (slug: string) => {
    localStorage.setItem(LS_LAYER_TOGGLE_VISIBLE, "1");

    const next = Array.from(new Set([...enabled, slug]));
    setEnabled(next);
    localStorage.setItem(LS_ENABLED_LAYER_SLUGS, JSON.stringify(next));

    setJustAdded(slug);
    router.push("/");
  };

  const liveLayers = useMemo(
    () => LAYERS.filter((l) => l.status !== "coming"),
    []
  );
  const comingLayers = useMemo(
    () => LAYERS.filter((l) => l.status === "coming"),
    []
  );

  useEffect(() => {
  (async () => {
    try {
      setMyErr(null);
      const { data: ses } = await supabase.auth.getSession();
      const uid = ses.session?.user.id;
      if (!uid) {
        setMyTodo([]);
        setMyDone([]);
        return;
      }

      const { data, error } = await supabase
        .from("place_flags")
        .select("place_key, kind, created_at")
        .eq("user_id", uid)
        .in("kind", ["want", "visited"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      const { data, error } = await supabase
  .from("place_flags")
  .select("place_key, kind, created_at")
  .eq("user_id", uid)
  .in("kind", ["want", "visited"])
  .order("created_at", { ascending: false });

if (error) throw error;

// ✅ place_keyごとに統合（visited優先）
const byKey: Record<string, MyPlace> = {};
for (const r of data ?? []) {
  const key = r.place_key as string;
  if (!byKey[key]) {
    const title = (key.split("|")[0] ?? key);
    byKey[key] = {
      place_key: key,
      title,
      wanted: false,
      visited: false,
      last_at: r.created_at,
    };
  }
  if (r.kind === "want") byKey[key].wanted = true;
  if (r.kind === "visited") byKey[key].visited = true;

  // 新しい日付を採用（descで取ってるから最初のままでもOK）
  if (r.created_at > byKey[key].last_at) byKey[key].last_at = r.created_at;
}

const merged = Object.values(byKey).sort((a, b) => (a.last_at < b.last_at ? 1 : -1));
setMyPlaces(merged);
    } catch (e: any) {
      setMyErr(e?.message ?? String(e));
      setMyTodo([]);
      setMyDone([]);
    }
  })();
}, []);


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
          <button
            type="button"
            onClick={() => router.push("/")}
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid rgba(148,163,184,0.35)",
              background: "rgba(2,6,23,0.55)",
              color: "#e2e8f0",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            ← 地図へ
          </button>

          <div style={{ fontSize: 12, color: "rgba(226,232,240,0.55)" }}>
            Pilgrimage Mode
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
            巡礼マップ
          </h1>
        </div>

        {/* ✅ My巡礼（public地図の☆/☑から自動反映） */}
<SectionTitle title="行きたい場所リスト" />

<div
  style={{
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,0.20)",
    background: "rgba(255,255,255,0.03)",
    padding: 14,
    boxShadow: "0 30px 80px -45px rgba(0,0,0,0.85)",
  }}
>
  {myErr && (
    <div style={{ fontSize: 12, color: "rgba(248,113,113,0.9)" }}>
      読み込みエラー：{myErr}
    </div>
  )}

  {/* ✅ 達成率 */}
  {(() => {
    const total = myPlaces.filter(p => p.wanted || p.visited).length;
    const done = myPlaces.filter(p => p.visited).length;
    const rate = total === 0 ? 0 : Math.round((done / total) * 100);

    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(226,232,240,0.85)" }}>
            達成率
          </div>
          <div style={{ fontSize: 12, color: "rgba(226,232,240,0.75)" }}>
            {rate}%（{done}/{total}）
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
              width: `${rate}%`,
              height: "100%",
              background: "rgba(34,197,94,0.85)",
            }}
          />
        </div>
      </div>
    );
  })()}

  {/* ✅ 20件制限（今は警告だけ） */}
  {myPlaces.filter(p => p.wanted && !p.visited).length >= 20 && (
    <div style={{ marginBottom: 10, fontSize: 12, color: "rgba(251,191,36,0.9)" }}>
      ※ 行きたい場所は現在20件まで（将来有料予定）
    </div>
  )}

  {/* ✅ リストどーーん */}
  <ul style={{ paddingLeft: 18, margin: 0 }}>
    {myPlaces.filter(p => p.wanted || p.visited).length === 0 ? (
      <li style={{ opacity: 0.7, fontSize: 13 }}>まだないよ。public地図で☆/☑押してみ。</li>
    ) : (
      myPlaces
        .filter(p => p.wanted || p.visited)
        .map((p) => (
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
            <span style={{ fontWeight: 800 }}>
              {p.title}
            </span>

            {/* 右側の印：visited優先 */}
            {p.visited ? (
              <span style={{ color: "rgba(248,113,113,0.95)", fontWeight: 900 }}>
                達成！
              </span>
            ) : p.wanted ? (
              <span style={{ fontSize: 16 }}>⭐</span>
            ) : null}
          </li>
        ))
    )}
  </ul>
</div>



        {/* 一覧 */}
        <SectionTitle title="巡礼マップ一覧" />

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}
        >
          {liveLayers.map((l) => (
            <LayerCard
              key={l.slug}
              layer={l}
              enabled={enabled.includes(l.slug)}
              stats={rateBySlug[l.slug]}
              onAdd={() => addLayer(l.slug)}
              onDetail={() => router.push(`/pilgrimage/${l.slug}`)}
            />
          ))}
        </div>

        {/* Coming soon */}
        <div style={{ marginTop: 18 }}>
          <SectionTitle title="COMING SOON" />
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}
          >
            {comingLayers.map((l) => (
              <LayerCard
                key={l.slug}
                layer={l}
                enabled={false}
                disabled
                onAdd={() => {}}
                onDetail={() => {}}
              />
            ))}
          </div>
        </div>

        {justAdded && (
          <div
            style={{
              marginTop: 14,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(34,197,94,0.25)",
              background: "rgba(34,197,94,0.07)",
              color: "rgba(226,232,240,0.9)",
              fontSize: 12,
            }}
          >
            ✅ レイヤーを追加しました： <b>{justAdded}</b>
          </div>
        )}
      </div>
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

function LayerCard({
  layer,
  enabled,
  disabled,
  onAdd,
  onDetail,
  stats,
}: {
  layer: LayerDef;
  enabled: boolean;
  disabled?: boolean;
  onAdd: () => void;
  onDetail: () => void;
  stats?: { done: number; total: number; rate: number };
}) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid rgba(148,163,184,0.20)",
        background: "rgba(255,255,255,0.03)",
        padding: 14,
        boxShadow: "0 30px 80px -45px rgba(0,0,0,0.85)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              marginTop: 4,
              fontSize: 18,
              fontWeight: 900,
              letterSpacing: -0.2,
            }}
          >
            {layer.title}
          </div>

          {!disabled && stats && (
            <div style={{ marginTop: 10 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: "rgba(226,232,240,0.75)",
                    fontWeight: 800,
                  }}
                >
                  達成率
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "rgba(226,232,240,0.75)",
                  }}
                >
                  {stats.done}/{stats.total}（{stats.rate}%）
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
            </div>
          )}

          {!disabled && enabled && (
            <div
              style={{
                marginTop: 10,
                fontSize: 12,
                color: "rgba(34,197,94,0.85)",
                fontWeight: 800,
              }}
            >
              ✔ 追加済み
            </div>
          )}
        </div>

        <div
          style={{
            height: 48,
            width: 48,
            borderRadius: 14,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(148,163,184,0.20)",
            display: "grid",
            placeItems: "center",
            fontSize: 22,
            flexShrink: 0,
          }}
        >
          {layer.emoji}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button
          onClick={onAdd}
          disabled={disabled}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 12,
            background: disabled
              ? "rgba(255,255,255,0.06)"
              : "#ffffff",
            border: "1px solid rgba(148,163,184,0.25)",
            color: disabled
              ? "rgba(226,232,240,0.35)"
              : "#0b1220",
            cursor: disabled ? "not-allowed" : "pointer",
            fontSize: 13,
            fontWeight: 900,
          }}
        >
          {disabled ? "準備中" : "地図に追加 →"}
        </button>

        <button
          onClick={onDetail}
          disabled={disabled}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            background: "rgba(30,41,59,0.75)",
            border: "1px solid rgba(148,163,184,0.25)",
            color: disabled
              ? "rgba(226,232,240,0.35)"
              : "rgba(226,232,240,0.9)",
            cursor: disabled ? "not-allowed" : "pointer",
            fontSize: 12,
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          詳細
        </button>
      </div>
    </div>
  );
}
