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

  const LS_ENABLED_LAYER_SLUGS = "tm_enabled_layer_slugs";

const [overallRate, setOverallRate] = useState<number | null>(null);
const [rateBySlug, setRateBySlug] = useState<Record<string, { done: number; total: number; rate: number }>>({});
const [rateErr, setRateErr] = useState<string | null>(null);

useEffect(() => {
  (async () => {
    try {
      setRateErr(null);

      // 1) enabled slugs（地図でONにしたレイヤー）
      let enabled: string[] = [];
      try {
        const raw = localStorage.getItem(LS_ENABLED_LAYER_SLUGS);
        const arr = raw ? JSON.parse(raw) : [];
        enabled = Array.isArray(arr) ? arr : [];
      } catch {
        enabled = [];
      }

      if (enabled.length === 0) {
        setOverallRate(0);
        setRateBySlug({});
        return;
      }

      // 2) login
      const { data: ses } = await supabase.auth.getSession();
      const uid = ses.session?.user.id;
      if (!uid) {
        setOverallRate(null);
        setRateBySlug({});
        return;
      }

      // 3) mission id をslugで取る
      const { data: missions, error: me } = await supabase
        .from("pilgrimage_missions")
        .select("id, slug")
        .in("slug", enabled);

      if (me) throw new Error(me.message);
      const missionIdBySlug: Record<string, string> = {};
      for (const m of missions ?? []) missionIdBySlug[m.slug] = m.id;

      // 4) spots（総数）
      const { data: spots, error: se } = await supabase
        .from("pilgrimage_spots")
        .select("id, mission_id")
        .in("mission_id", Object.values(missionIdBySlug));

      if (se) throw new Error(se.message);

      const totalBySlug: Record<string, number> = {};
      const spotIdsBySlug: Record<string, Set<string>> = {};
      for (const slug of enabled) {
        totalBySlug[slug] = 0;
        spotIdsBySlug[slug] = new Set();
      }

      for (const s of spots ?? []) {
        const slug = Object.keys(missionIdBySlug).find((k) => missionIdBySlug[k] === s.mission_id);
        if (!slug) continue;
        totalBySlug[slug] += 1;
        spotIdsBySlug[slug].add(s.id);
      }

      // 5) progress（達成） ※spot_idだけ取って数える
      const { data: prog, error: pe } = await supabase
        .from("pilgrimage_progress")
        .select("spot_id")
        .eq("user_id", uid);

      if (pe) throw new Error(pe.message);

      const doneSpotIds = new Set((prog ?? []).map((r: any) => r.spot_id));

      // 6) slugごと集計
      const nextBySlug: Record<string, { done: number; total: number; rate: number }> = {};
      let doneAll = 0;
      let totalAll = 0;

      for (const slug of enabled) {
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
      setOverallRate(totalAll === 0 ? 0 : Math.round((doneAll / totalAll) * 100));
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

    // private地図へ戻す（あなたの地図ルートが違うならここだけ変えて）
    router.push("/");
  };

  const liveLayers = useMemo(() => LAYERS.filter((l) => l.status !== "coming"), []);
  const comingLayers = useMemo(() => LAYERS.filter((l) => l.status === "coming"), []);

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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
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

          <div style={{ fontSize: 12, color: "rgba(226,232,240,0.55)" }}>Pilgrimage Mode</div>
        </div>

        {/* Hero */}
        <div style={{ marginTop: 18 }}>
          <h1 style={{ fontSize: 30, fontWeight: 900, letterSpacing: -0.3, marginBottom: 8 }}>
            巡礼マップ
          </h1>
          

  {/* レイヤー別 */}
  {Object.keys(rateBySlug).length > 0 && (
    <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
      {Object.entries(rateBySlug).map(([slug, v]) => (
        <div
          key={slug}
          style={{
            border: "1px solid rgba(148,163,184,0.22)",
            background: "rgba(2,6,23,0.45)",
            borderRadius: 12,
            padding: "10px 12px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontSize: 12, color: "rgba(226,232,240,0.85)", fontWeight: 800 }}>
              {slug}
            </div>
            <div style={{ fontSize: 12, color: "rgba(226,232,240,0.75)" }}>
              {v.done}/{v.total}（{v.rate}%）
            </div>
          </div>
          <div style={{ marginTop: 8, height: 8, borderRadius: 999, background: "rgba(148,163,184,0.18)", overflow: "hidden" }}>
            <div style={{ width: `${v.rate}%`, height: "100%", background: "rgba(34,197,94,0.85)" }} />
          </div>
        </div>
      ))}
    </div>
  )}
</div>

        {/* ✅ 達成率（カード内） */}
{!disabled && stats && (
  <div style={{ marginTop: 10 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
      <div style={{ fontSize: 12, color: "rgba(226,232,240,0.75)", fontWeight: 800 }}>
        達成率
      </div>
      <div style={{ fontSize: 12, color: "rgba(226,232,240,0.75)" }}>
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


          {/* chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Chip text="🏯 未訪問：輪郭" />
            <Chip text="🏯 訪問：塗り" />
            <Chip text="マップは1枚（privateと共通）" />
          </div>
        </div>

        {/* Live layers */}
        <SectionTitle title="巡礼マップ一覧" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            {comingLayers.map((l) => (
              <LayerCard key={l.slug} layer={l} enabled={false} disabled onAdd={() => {}} onDetail={() => {}} />
            ))}
          </div>
        </div>

        {/* Footer hint */}
        <div style={{ marginTop: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontSize: 11, color: "rgba(148,163,184,0.85)" }}>
            追加すると、地図の左下にON/OFFが出ます。
          </div>
          <button
            onClick={() => router.push("/")}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              background: "rgba(30,41,59,0.8)",
              border: "1px solid rgba(148,163,184,0.35)",
              color: "#e2e8f0",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            地図へ戻る →
          </button>
        </div>

        {/* Tiny toast-ish note (optional) */}
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
              lineHeight: 1.5,
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
    <div style={{ marginTop: 18, marginBottom: 10, fontSize: 11, color: "rgba(148,163,184,0.9)", letterSpacing: 1 }}>
      {title}
    </div>
  );
}

function Chip({ text }: { text: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid rgba(148,163,184,0.25)",
        background: "rgba(2,6,23,0.45)",
        color: "rgba(226,232,240,0.85)",
        fontSize: 11,
      }}
    >
      {text}
    </span>
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
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: "rgba(226,232,240,0.55)" }}>{disabled ? "COMING SOON" : "LAYER"}</div>
          <div style={{ marginTop: 4, fontSize: 18, fontWeight: 900, letterSpacing: -0.2 }}>
            {layer.title}
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: "rgba(203,213,225,0.75)", lineHeight: 1.6 }}>
            {layer.desc}
          </div>

          {!disabled && enabled && (
            <div style={{ marginTop: 10, fontSize: 12, color: "rgba(34,197,94,0.85)", fontWeight: 800 }}>
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
            background: disabled ? "rgba(255,255,255,0.06)" : "#ffffff",
            border: "1px solid rgba(148,163,184,0.25)",
            color: disabled ? "rgba(226,232,240,0.35)" : "#0b1220",
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
            color: disabled ? "rgba(226,232,240,0.35)" : "rgba(226,232,240,0.9)",
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

