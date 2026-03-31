"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";
import { ensureMySpace } from "@/lib/ensureMySpace";
import { TripPlanAIResult, TripPlanDraft, TripPlanInput } from "@/lib/tripPlanTypes";
const InlineMapView = dynamic(() => import("@/components/MapView"), { ssr: false });

const REL_OPTIONS = ["1人", "夫婦", "カップル", "友達", "家族", "子連れ", "その他"];
const BUDGET_OPTIONS = ["節約", "ふつう", "ちょっと贅沢", "贅沢"];
const STEP_LOADING_TEXTS = [
  "旅のしおりを作成中です…",
  "地元らしい候補を探しています…",
  "朝食・ランチ・夕食・宿泊候補をまとめています…",
  "いい感じの2案に整えています…",
];

const MANUAL_CATEGORIES = ["出発", "食事", "観光", "宿泊", "移動", "ゆっくり", "その他", "到着"];
const PLAN_LENGTH_OPTIONS = [
  { value: "day_trip", label: "日帰り", dayCount: 1, nights: null as number | null },
  { value: "1n2d", label: "1泊2日", dayCount: 2, nights: 1 },
  { value: "2n3d", label: "2泊3日", dayCount: 3, nights: 2 },
  { value: "3n4d", label: "3泊4日", dayCount: 4, nights: 3 },
];

type PlaceCandidate = {
  name: string;
  lat: number;
  lon: number;
  address?: string;
};

type ManualStopDraft = {
  id?: string;
  localId: string;
  start_time: string;
  category: string;
  title: string;
  memo: string;
  map_enabled: boolean;
  map_label: string | null;
  map_source: "auto" | "manual" | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  status: "planned" | "visited" | "skipped";
  resolving: boolean;
  resolve_error: string | null;
  candidates: PlaceCandidate[];
  initial_map_label?: string | null;
  initial_lat?: number | null;
  initial_lng?: number | null;
  initial_map_source?: "auto" | "manual" | null;
};

export default function PlanNewPage() {
  const [mode, setMode] = useState<string | null>("__loading__");
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedEditId = params.get("edit");
    setEditId(requestedEditId);
    setMode(requestedEditId ? "manual" : params.get("mode") ?? "ai");
  }, []);

  if (mode === "__loading__") {
    return <main style={{ maxWidth: 860, margin: "0 auto", padding: "14px 12px" }}>読み込み中...</main>;
  }
  if (mode === "manual") {
    return <ManualPlanPage editId={editId} />;
  }
  return <AiPlanPage />;
}

function ManualPlanPage({ editId }: { editId: string | null }) {
  const router = useRouter();
  const [selectedLength, setSelectedLength] = useState(PLAN_LENGTH_OPTIONS[0]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [departureFrom, setDepartureFrom] = useState("");
  const [destination1, setDestination1] = useState("");
  const [destination2, setDestination2] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [days, setDays] = useState<ManualStopDraft[][]>(() => createInitialDays(PLAN_LENGTH_OPTIONS[0].dayCount));
  const [saving, setSaving] = useState(false);
  const [hydrating, setHydrating] = useState(false);
  const [baseVisibility, setBaseVisibility] = useState<"private" | "public">("private");
  const [initialStopIds, setInitialStopIds] = useState<string[]>([]);
  const [manualPicker, setManualPicker] = useState<{ dayIndex: number; localId: string } | null>(null);

  useEffect(() => {
    setDays((prev) => adjustDays(prev, selectedLength.dayCount));
  }, [selectedLength.dayCount]);

  useEffect(() => {
    if (!editId) return;
    let alive = true;

    const hydrate = async () => {
      setHydrating(true);
      const { data: plan, error: planErr } = await supabase
        .from("trip_plans")
        .select("id,title,description,departure_from,destination_1,destination_2,visibility,trip_length_type,nights")
        .eq("id", editId)
        .single();

      if (planErr || !plan) {
        setHydrating(false);
        alert(planErr?.message ?? "しおりが見つかりませんでした");
        router.push("/plans");
        return;
      }

      const { data: stops, error: stopErr } = await supabase
        .from("trip_plan_stops")
        .select("id,day_number,sort_order,start_time,category,title,memo,map_enabled,map_label,map_source,lat,lng,address,status")
        .eq("plan_id", editId)
        .order("day_number", { ascending: true })
        .order("sort_order", { ascending: true });

      if (stopErr) {
        setHydrating(false);
        alert(stopErr.message);
        return;
      }
      if (!alive) return;

      const dayCount = plan.trip_length_type === "day_trip" ? 1 : (plan.nights ?? 1) + 1;
      const nextLength = PLAN_LENGTH_OPTIONS.find((o) => o.dayCount === dayCount) ?? PLAN_LENGTH_OPTIONS[0];
      setSelectedLength(nextLength);
      setTitle(plan.title ?? "");
      setDescription(plan.description ?? "");
      setDepartureFrom(plan.departure_from ?? "");
      setDestination1(plan.destination_1 ?? "");
      setDestination2(plan.destination_2 ?? "");
      setVisibility(plan.visibility === "public" ? "public" : "private");
      setBaseVisibility(plan.visibility === "public" ? "public" : "private");

      const grouped = Array.from({ length: dayCount }, () => [] as ManualStopDraft[]);
      const mappedStops = (stops ?? []).map((stop) => {
        const row = stop as any;
        const mapped: ManualStopDraft = {
          id: row.id,
          localId: row.id,
          start_time: row.start_time ?? "",
          category: row.category ?? "観光",
          title: row.title ?? "",
          memo: row.memo ?? "",
          map_enabled: row.map_enabled === true,
          map_label: row.map_label ?? null,
          map_source: row.map_source ?? null,
          lat: row.lat ?? null,
          lng: row.lng ?? null,
          address: row.address ?? null,
          status: row.status ?? "planned",
          resolving: false,
          resolve_error: null,
          candidates: [],
          initial_map_label: row.map_label ?? null,
          initial_lat: row.lat ?? null,
          initial_lng: row.lng ?? null,
          initial_map_source: row.map_source ?? null,
        };
        return { dayNumber: row.day_number ?? 1, stop: mapped };
      });

      mappedStops.forEach((entry) => {
        const idx = Math.max(0, entry.dayNumber - 1);
        grouped[idx]?.push(entry.stop);
      });
      setInitialStopIds(mappedStops.map((entry) => entry.stop.id!).filter(Boolean));
      setDays(grouped.map((day) => (day.length ? day : [createEmptyStop()])));
      setHydrating(false);
    };

    void hydrate();
    return () => {
      alive = false;
    };
  }, [editId, router]);

  const canSave = useMemo(() => days.some((day) => day.some((stop) => stop.title.trim().length > 0)), [days]);

  const setStop = (dayIndex: number, localId: string, updater: (stop: ManualStopDraft) => ManualStopDraft) => {
    setDays((prev) => prev.map((day, idx) => (idx !== dayIndex ? day : day.map((stop) => (stop.localId === localId ? updater(stop) : stop)))));
  };

  const addStop = (dayIndex: number) => {
    setDays((prev) => prev.map((day, idx) => (idx !== dayIndex ? day : [...day, createEmptyStop(day.length)])));
  };

  const removeStop = (dayIndex: number, localId: string) => {
    setDays((prev) =>
      prev.map((day, idx) => {
        if (idx !== dayIndex) return day;
        if (day.length === 1) return day;
        return day.filter((stop) => stop.localId !== localId);
      })
    );
  };

  const resolveLocation = async (dayIndex: number, stop: ManualStopDraft) => {
    const trimmed = stop.title.trim();
    if (!trimmed) {
      setStop(dayIndex, stop.localId, (current) => ({ ...current, resolve_error: "タイトルを入力してから地図に追加してください。" }));
      return;
    }

    setStop(dayIndex, stop.localId, (current) => ({
      ...current,
      resolving: true,
      resolve_error: null,
      candidates: [],
    }));

    try {
      const params = new URLSearchParams({ q: trimmed });
      const res = await fetch(`/api/place-search?${params.toString()}`);
      const json: { items?: PlaceCandidate[]; error?: string } = await res.json();
      const items = Array.isArray(json.items) ? json.items.slice(0, 5) : [];

      if (!res.ok) {
        throw new Error(json.error ?? "場所の検索に失敗しました");
      }

      if (items.length === 0) {
        setStop(dayIndex, stop.localId, (current) => ({
          ...current,
          resolving: false,
          lat: null,
          lng: null,
          address: null,
          resolve_error: "場所が見つかりませんでした。タイトルを具体的にしてください。",
        }));
        return;
      }

      if (items.length === 1) {
        const picked = items[0];
        setStop(dayIndex, stop.localId, (current) => ({
          ...current,
          resolving: false,
          lat: picked.lat,
          lng: picked.lon,
          address: picked.address ?? null,
          map_enabled: true,
          map_source: "auto",
          candidates: [],
          resolve_error: null,
          map_label: buildMapLabel(dayIndex + 1, current.start_time, current.title),
        }));
        return;
      }

      setStop(dayIndex, stop.localId, (current) => ({
        ...current,
        resolving: false,
        candidates: items,
        resolve_error: "候補が複数あります。地図に表示する場所を選んでください。",
      }));
    } catch (error) {
      setStop(dayIndex, stop.localId, (current) => ({
        ...current,
        resolving: false,
        resolve_error: error instanceof Error ? error.message : "場所検索に失敗しました",
      }));
    }
  };

  const selectCandidate = (dayIndex: number, localId: string, picked: PlaceCandidate) => {
    setStop(dayIndex, localId, (current) => ({
      ...current,
      lat: picked.lat,
      lng: picked.lon,
      address: picked.address ?? null,
      candidates: [],
      resolve_error: null,
      map_enabled: true,
      map_source: "auto",
      map_label: buildMapLabel(dayIndex + 1, current.start_time, current.title || picked.name),
    }));
  };

  const clearMapLink = (dayIndex: number, localId: string) => {
    setStop(dayIndex, localId, (current) => ({
      ...current,
      map_enabled: false,
      map_source: null,
      map_label: null,
      lat: null,
      lng: null,
      address: null,
    }));
  };

  const applyManualLocation = (dayIndex: number, localId: string, lat: number, lng: number) => {
    setStop(dayIndex, localId, (current) => ({
      ...current,
      map_enabled: true,
      map_source: "manual",
      lat,
      lng,
      candidates: [],
      resolve_error: null,
      map_label: buildMapLabel(dayIndex + 1, current.start_time, current.title),
    }));
  };

  const saveManualPlan = async () => {
    if (hydrating) return;
    if (!canSave) {
      alert("最低1件はタイトルを入力してください");
      return;
    }

    setSaving(true);
    const { data: ses } = await supabase.auth.getSession();
    const uid = ses.session?.user?.id;
    if (!uid) {
      router.push("/login");
      return;
    }

    const space = await ensureMySpace();
    if (!space?.id) {
      setSaving(false);
      alert("スペース情報が見つかりませんでした");
      return;
    }

    let planId = editId;
    let shareToken: string | null = null;
    if (editId) {
      const { data: existing, error: existingErr } = await supabase
        .from("trip_plans")
        .select("id,share_token")
        .eq("id", editId)
        .single();
      if (existingErr || !existing?.id) {
        setSaving(false);
        alert(existingErr?.message ?? "編集対象のしおりを読み込めませんでした");
        return;
      }
      shareToken = visibility === "public" ? (existing.share_token ?? crypto.randomUUID().replaceAll("-", "")) : null;
      const { error: updateErr } = await supabase
        .from("trip_plans")
        .update({
          title: title.trim() || `${destination1 || "手動しおり"}`,
          description: description.trim() || "出発から到着まで手動で組み立てた旅のしおりです。",
          departure_from: departureFrom || null,
          trip_length_type: selectedLength.dayCount === 1 ? "day_trip" : "overnight",
          nights: selectedLength.nights,
          destination_1: destination1 || null,
          destination_2: destination2 || null,
          visibility,
          share_token: shareToken,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editId);
      if (updateErr) {
        setSaving(false);
        alert(updateErr.message);
        return;
      }
    } else {
      shareToken = visibility === "public" ? crypto.randomUUID().replaceAll("-", "") : null;
      const { data: row, error } = await supabase
        .from("trip_plans")
        .insert({
          space_id: space.id,
          created_by: uid,
          title: title.trim() || `${destination1 || "手動しおり"}`,
          description: description.trim() || "出発から到着まで手動で組み立てた旅のしおりです。",
          departure_from: departureFrom || null,
          trip_length_type: selectedLength.dayCount === 1 ? "day_trip" : "overnight",
          nights: selectedLength.nights,
          destination_1: destination1 || null,
          destination_2: destination2 || null,
          visibility,
          share_token: shareToken,
        })
        .select("id")
        .single();
      if (error || !row?.id) {
        setSaving(false);
        alert(error?.message ?? "しおり保存に失敗しました");
        return;
      }
      planId = row.id;
    }
    if (!planId) {
      setSaving(false);
      alert("しおりIDを取得できませんでした");
      return;
    }

    const stopRows = days.flatMap((dayStops, dayIndex) =>
      dayStops.map((stop, sortOrder) => ({
        id: stop.id,
        plan_id: planId,
        day_number: dayIndex + 1,
        sort_order: sortOrder,
        start_time: stop.start_time || null,
        category: stop.category,
        title: stop.title.trim() || "（タイトル未設定）",
        memo: stop.memo.trim() || null,
        map_enabled: stop.map_enabled,
        map_label:
          stop.map_enabled
            ? shouldReuseStopMapLabel(stop, visibility, baseVisibility)
              ? stop.map_label
              : buildMapLabel(dayIndex + 1, stop.start_time, stop.title)
            : null,
        map_source: stop.map_enabled ? stop.map_source : null,
        lat: stop.lat,
        lng: stop.lng,
        address: stop.address,
        status: stop.status,
      }))
    );

    if (editId) {
      const keepIds = stopRows.map((s) => s.id).filter((id): id is string => Boolean(id));
      const deleteIds = initialStopIds.filter((id) => !keepIds.includes(id));
      if (deleteIds.length) {
        const { error: delErr } = await supabase.from("trip_plan_stops").delete().in("id", deleteIds);
        if (delErr) {
          setSaving(false);
          alert(delErr.message);
          return;
        }
      }

      for (const stop of stopRows) {
        if (stop.id) {
          const { error: upErr } = await supabase
            .from("trip_plan_stops")
            .update({
              day_number: stop.day_number,
              sort_order: stop.sort_order,
              start_time: stop.start_time,
              category: stop.category,
              title: stop.title,
              memo: stop.memo,
              map_enabled: stop.map_enabled,
              map_label: stop.map_label,
              map_source: stop.map_source,
              lat: stop.lat,
              lng: stop.lng,
              address: stop.address,
              status: stop.status,
            })
            .eq("id", stop.id)
            .eq("plan_id", planId);
          if (upErr) {
            setSaving(false);
            alert(upErr.message);
            return;
          }
          continue;
        }

        const { error: insErr } = await supabase.from("trip_plan_stops").insert({
          plan_id: planId,
          day_number: stop.day_number,
          sort_order: stop.sort_order,
          start_time: stop.start_time,
          category: stop.category,
          title: stop.title,
          memo: stop.memo,
          map_enabled: stop.map_enabled,
          map_label: stop.map_label,
          map_source: stop.map_source,
          lat: stop.lat,
          lng: stop.lng,
          address: stop.address,
          status: stop.status,
        });
        if (insErr) {
          setSaving(false);
          alert(insErr.message);
          return;
        }
      }
    } else if (stopRows.length) {
      const { error: stopErr } = await supabase.from("trip_plan_stops").insert(stopRows.map(({ id, ...row }) => row));
      if (stopErr) {
        setSaving(false);
        alert(stopErr.message);
        return;
      }
    }

    setSaving(false);
    alert(editId ? "しおりを更新しました" : "しおりを作成しました");
    if (editId) {
      router.push(`/plans?visibility=${visibility}`);
      return;
    }
    router.push(`/plans/${planId}`);
  };

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "14px 12px 96px" }}>
      <Link href="/plans" style={backBtn}>旅のしおり一覧へ戻る</Link>

      <header style={manualHeaderCard}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>{editId ? "しおりを編集する" : "手動でしおりをつくる"}</h1>
        <p style={{ margin: "8px 0 0", color: "#475569", fontSize: 14 }}>出発から到着まで、自分で旅の流れを組み立てられます。</p>
      </header>

      {hydrating ? <div style={{ marginTop: 12, color: "#475569", fontSize: 14 }}>既存データを読み込み中...</div> : null}

      <section style={manualCard}>
        <h2 style={manualSectionTitle}>日数設定</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PLAN_LENGTH_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              style={pillButton(selectedLength.value === option.value)}
              onClick={() => setSelectedLength(option)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section style={manualCard}>
        <h2 style={manualSectionTitle}>しおり情報</h2>
        <div style={metaGrid}>
          <label style={labelWrap}><span style={inputLabel}>しおりタイトル</span><input value={title} onChange={(e) => setTitle(e.target.value)} style={input} placeholder="例: 金沢ゆったり旅" /></label>
          <label style={labelWrap}><span style={inputLabel}>出発地</span><input value={departureFrom} onChange={(e) => setDepartureFrom(e.target.value)} style={input} placeholder="例: 東京駅" /></label>
          <label style={labelWrap}><span style={inputLabel}>目的地</span><input value={destination1} onChange={(e) => setDestination1(e.target.value)} style={input} placeholder="例: 金沢" /></label>
          <label style={labelWrap}><span style={inputLabel}>目的地（任意）</span><input value={destination2} onChange={(e) => setDestination2(e.target.value)} style={input} placeholder="例: 能登" /></label>
        </div>
        <label style={{ ...labelWrap, marginTop: 10 }}>
          <span style={inputLabel}>説明メモ</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...input, minHeight: 84 }} placeholder="この旅でやりたいことなど" />
        </label>
      </section>

      {days.map((dayStops, dayIndex) => (
        <section key={`day-${dayIndex + 1}`} style={dayCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>{dayIndex + 1}日目</h2>
            <button type="button" style={smallActionBtn} onClick={() => addStop(dayIndex)}>+ 予定を追加</button>
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            {dayStops.map((stop) => (
              <article key={stop.localId} style={stopCard}>
                <div className="manual-stop-grid" style={manualStopGrid}>
                  <label style={labelWrap}><span style={inputLabel}>時間</span><input type="time" value={stop.start_time} onChange={(e) => setStop(dayIndex, stop.localId, (c) => ({ ...c, start_time: e.target.value, map_label: c.map_enabled ? buildMapLabel(dayIndex + 1, e.target.value, c.title) : c.map_label }))} style={input} /></label>
                  <label style={labelWrap}><span style={inputLabel}>項目</span><select value={stop.category} onChange={(e) => setStop(dayIndex, stop.localId, (c) => ({ ...c, category: e.target.value }))} style={input}>{MANUAL_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}</select></label>
                  <label style={labelWrap}><span style={inputLabel}>タイトル</span><input value={stop.title} onChange={(e) => setStop(dayIndex, stop.localId, (c) => ({ ...c, title: e.target.value, map_label: c.map_enabled ? buildMapLabel(dayIndex + 1, c.start_time, e.target.value) : c.map_label }))} style={input} placeholder="例: 近江町市場" /></label>
                </div>

                <label style={{ ...labelWrap, marginTop: 8 }}>
                  <span style={inputLabel}>一言メモ</span>
                  <textarea value={stop.memo} onChange={(e) => setStop(dayIndex, stop.localId, (c) => ({ ...c, memo: e.target.value }))} style={{ ...input, minHeight: 68 }} placeholder="例: ここで海鮮丼を食べたい" />
                </label>

                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <button type="button" onClick={() => void resolveLocation(dayIndex, stop)} disabled={stop.resolving} style={mapButton(stop.map_source === "auto")}>
                    {stop.resolving ? "場所を検索中…" : stop.map_source === "auto" ? "自動追加済み（再検索）" : "自動で地図に追加"}
                  </button>
                  <button type="button" onClick={() => setManualPicker({ dayIndex, localId: stop.localId })} style={mapButton(stop.map_source === "manual")}>
                    {stop.map_source === "manual" ? "手動追加済み（再設定）" : "手動で地図に追加"}
                  </button>
                  <button type="button" onClick={() => clearMapLink(dayIndex, stop.localId)} style={smallActionBtn}>地図対象から外す</button>
                  <button type="button" onClick={() => removeStop(dayIndex, stop.localId)} style={smallActionBtn} disabled={dayStops.length === 1}>削除</button>
                  {stop.map_enabled ? <span style={mapDoneBadge}>{stop.map_source === "manual" ? "手動追加済み" : "自動追加済み"}</span> : <span style={mapMuted}>地図未追加</span>}
                </div>

                {stop.resolve_error ? <p style={{ margin: "8px 0 0", color: "#b91c1c", fontSize: 12 }}>{stop.resolve_error}</p> : null}
                {stop.lat && stop.lng ? <p style={{ margin: "6px 0 0", color: "#0f766e", fontSize: 12 }}>地図位置: {stop.address ?? "座標を設定しました"}（{stop.map_source === "manual" ? "手動" : "自動"}）</p> : null}

                {stop.candidates.length > 0 ? (
                  <div style={candidateBox}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>候補から選択してください</div>
                    <div style={{ display: "grid", gap: 6 }}>
                      {stop.candidates.map((candidate, idx) => (
                        <button key={`${candidate.name}-${idx}`} type="button" onClick={() => selectCandidate(dayIndex, stop.localId, candidate)} style={candidateButton}>
                          <strong>{candidate.name}</strong>
                          {candidate.address ? <span style={{ display: "block", fontSize: 12, color: "#475569" }}>{candidate.address}</span> : null}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ))}

      <section style={manualCard}>
        <h2 style={manualSectionTitle}>公開範囲</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={pillButton(visibility === "private")} onClick={() => setVisibility("private")}>private</button>
          <button type="button" style={pillButton(visibility === "public")} onClick={() => setVisibility("public")}>public</button>
        </div>
      </section>

      <button type="button" onClick={() => void saveManualPlan()} style={saveBtn} disabled={saving || hydrating}>{saving ? "保存中…" : editId ? "このしおりを更新する" : "この手動しおりを保存する"}</button>
      {manualPicker ? (
        <ManualMapPicker
          onCancel={() => setManualPicker(null)}
          onPick={(lat, lng) => {
            applyManualLocation(manualPicker.dayIndex, manualPicker.localId, lat, lng);
            setManualPicker(null);
          }}
        />
      ) : null}

      <style jsx>{`
        @media (max-width: 720px) {
          .manual-stop-grid {
            grid-template-columns: 1fr 1fr !important;
          }
          .manual-stop-grid > label:last-child {
            grid-column: 1 / -1;
          }
        }
      `}</style>
    </main>
  );
}

function AiPlanPage() {
  const router = useRouter();

  const [form, setForm] = useState<TripPlanInput>({ tripLengthType: "day_trip", visibility: "private" });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [ai, setAi] = useState<TripPlanAIResult | null>(null);
  const [detailPlan, setDetailPlan] = useState<TripPlanDraft | null>(null);
  const [aiMeta, setAiMeta] = useState<{ provider: string; model: string } | null>(null);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (!loading) return;
    const timer = window.setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % STEP_LOADING_TEXTS.length);
    }, 2200);
    return () => window.clearInterval(timer);
  }, [loading]);

  const canGenerate = useMemo(() => !!form.destination1 && !!form.departureFrom, [form.destination1, form.departureFrom]);

  const onGenerate = async () => {
    if (!canGenerate) {
      alert("出発地と目的地1は入力してください");
      return;
    }
    setLoading(true);
    setMessageIndex(0);
    const res = await fetch("/api/plans/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json?.error ?? "AI生成に失敗しました");
      setLoading(false);
      return;
    }
    setAi(json.result);
    setAiMeta({ provider: json.provider, model: json.model });

    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user?.id;
    if (uid) {
      await supabase.from("ai_plan_generations").insert({
        created_by: uid,
        input_payload: form,
        output_payload: json.result,
        provider: json.provider,
        model: json.model,
      });
    }
    setLoading(false);
  };

  const saveManual = async () => {
    setLoading(true);
    const { data: ses } = await supabase.auth.getSession();
    const uid = ses.session?.user?.id;
    if (!uid) {
      router.push("/login");
      return;
    }
    const space = await ensureMySpace();
    if (!space?.id) return;

    const shareToken = form.visibility === "public" ? crypto.randomUUID().replaceAll("-", "") : null;
    const { data: row, error } = await supabase
      .from("trip_plans")
      .insert({
        space_id: space.id,
        created_by: uid,
        title: title || `${form.destination1 ?? "旅"}のしおり`,
        description,
        departure_from: form.departureFrom,
        people_count: form.peopleCount,
        relationship: form.relationship,
        trip_length_type: form.tripLengthType,
        nights: form.nights,
        destination_1: form.destination1,
        destination_2: form.destination2,
        must_do: form.mustDo,
        breakfast_note: form.breakfastNote,
        lunch_note: form.lunchNote,
        dinner_note: form.dinnerNote,
        budget_level: form.budgetLevel,
        visibility: form.visibility,
        share_token: shareToken,
      })
      .select("id")
      .single();

    setLoading(false);
    if (error || !row?.id) {
      alert(error?.message ?? "保存に失敗しました");
      return;
    }
    router.push(`/plans/${row.id}`);
  };

  const saveFromAiDraft = async (draft: TripPlanDraft) => {
    setLoading(true);
    const { data: ses } = await supabase.auth.getSession();
    const uid = ses.session?.user?.id;
    if (!uid) {
      router.push("/login");
      return;
    }
    const space = await ensureMySpace();
    if (!space?.id) return;

    const shareToken = form.visibility === "public" ? crypto.randomUUID().replaceAll("-", "") : null;
    const { data: inserted, error } = await supabase
      .from("trip_plans")
      .insert({
        space_id: space.id,
        created_by: uid,
        title: draft.title,
        description: draft.concept,
        departure_from: form.departureFrom,
        people_count: form.peopleCount,
        relationship: form.relationship,
        trip_length_type: form.tripLengthType,
        nights: form.nights,
        destination_1: form.destination1,
        destination_2: form.destination2,
        must_do: form.mustDo,
        breakfast_note: form.breakfastNote,
        lunch_note: form.lunchNote,
        dinner_note: form.dinnerNote,
        budget_level: form.budgetLevel,
        estimated_cost_min: draft.estimatedCostMin,
        estimated_cost_max: draft.estimatedCostMax,
        visibility: form.visibility,
        share_token: shareToken,
      })
      .select("id")
      .single();

    if (error || !inserted?.id) {
      setLoading(false);
      alert(error?.message ?? "しおり保存に失敗しました");
      return;
    }

    const stops = draft.days.flatMap((d) =>
      d.items.map((item, index) => ({
        plan_id: inserted.id,
        sort_order: index,
        day_number: d.dayNumber,
        start_time: item.startTime,
        end_time: item.endTime,
        category: item.category,
        title: item.title,
        memo: item.memo,
        address: item.address,
        candidate_group_key: item.candidateOptions?.length ? `${d.dayNumber}-${index}` : null,
        candidate_options: item.candidateOptions ?? null,
        estimated_cost_min: item.estimatedCostMin,
        estimated_cost_max: item.estimatedCostMax,
        map_enabled: true,
        map_label: `Day${d.dayNumber} ${item.startTime ?? ""} ${item.title}`.trim(),
      }))
    );

    if (stops.length) {
      await supabase.from("trip_plan_stops").insert(stops);
    }

    setLoading(false);
    router.push(`/plans/${inserted.id}`);
  };

  const selectionChips = [
    form.destination1 ? `目的地: ${form.destination1}${form.destination2 ? `・${form.destination2}` : ""}` : null,
    form.relationship ? `同行者: ${form.relationship}` : null,
    `日程: ${form.tripLengthType === "day_trip" ? "日帰り" : `${form.nights ?? 1}泊`}`,
    form.budgetLevel ? `予算: ${form.budgetLevel}` : null,
    `公開: ${form.visibility}`,
  ].filter(Boolean) as string[];

  return (
    <main style={{ maxWidth: 780, margin: "0 auto", padding: "14px 12px 80px" }}>
      <Link href="/plans" style={backBtn}>旅のしおり一覧へ戻る</Link>
      <h1 style={{ fontWeight: 900, fontSize: 26, marginTop: 12 }}>旅のしおりを作ってみよう</h1>
      <p style={{ color: "#64748b", fontSize: 13 }}>条件をひとつずつ選んで、2案の旅しおりを作ります。</p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        {selectionChips.map((chip) => (
          <span key={chip} style={chipStyle}>{chip}</span>
        ))}
      </div>

      <section style={stepCard}>
        <StepTitle>1. どこへ行く？</StepTitle>
        <input value={form.destination1 ?? ""} onChange={(e) => setForm({ ...form, destination1: e.target.value })} style={input} placeholder="例: 金沢" />
      </section>

      <section style={stepCard}>
        <StepTitle>2. もう一つ目的地ある？（任意）</StepTitle>
        <input value={form.destination2 ?? ""} onChange={(e) => setForm({ ...form, destination2: e.target.value })} style={input} placeholder="例: 能登" />
      </section>

      <section style={stepCard}>
        <StepTitle>3. 誰と過ごす旅？</StepTitle>
        <div style={chipWrap}>
          {REL_OPTIONS.map((v) => (
            <button key={v} style={selectChip(form.relationship === v)} onClick={() => setForm({ ...form, relationship: v })}>{v}</button>
          ))}
        </div>
      </section>

      <section style={stepCard}>
        <StepTitle>4. 日帰り or 宿泊？</StepTitle>
        <div style={chipWrap}>
          <button style={selectChip(form.tripLengthType === "day_trip")} onClick={() => setForm({ ...form, tripLengthType: "day_trip", nights: undefined })}>日帰り</button>
          <button style={selectChip(form.tripLengthType === "overnight")} onClick={() => setForm({ ...form, tripLengthType: "overnight", nights: form.nights ?? 1 })}>宿泊</button>
        </div>
        {form.tripLengthType === "overnight" ? (
          <div style={{ marginTop: 10 }}>
            <StepTitle>5. 宿泊なら何泊？</StepTitle>
            <input type="number" min={1} value={form.nights ?? 1} onChange={(e) => setForm({ ...form, nights: Number(e.target.value) || 1 })} style={input} />
          </div>
        ) : null}
      </section>

      <section style={stepCard}><StepTitle>6. 絶対にしたいこと</StepTitle><textarea value={form.mustDo ?? ""} onChange={(e) => setForm({ ...form, mustDo: e.target.value })} style={input} /></section>
      <section style={stepCard}><StepTitle>7. 朝ごはんの希望</StepTitle><input value={form.breakfastNote ?? ""} onChange={(e) => setForm({ ...form, breakfastNote: e.target.value })} style={input} /></section>
      <section style={stepCard}><StepTitle>8. お昼ごはんの希望</StepTitle><input value={form.lunchNote ?? ""} onChange={(e) => setForm({ ...form, lunchNote: e.target.value })} style={input} /></section>
      <section style={stepCard}><StepTitle>9. 夕食の希望</StepTitle><input value={form.dinnerNote ?? ""} onChange={(e) => setForm({ ...form, dinnerNote: e.target.value })} style={input} /></section>

      <section style={stepCard}>
        <StepTitle>10. 予算はどのくらい？</StepTitle>
        <div style={chipWrap}>
          {BUDGET_OPTIONS.map((v) => <button key={v} style={selectChip(form.budgetLevel === v)} onClick={() => setForm({ ...form, budgetLevel: v })}>{v}</button>)}
        </div>
      </section>

      <section style={stepCard}>
        <StepTitle>11. 公開範囲</StepTitle>
        <div style={chipWrap}>
          <button style={selectChip(form.visibility === "private")} onClick={() => setForm({ ...form, visibility: "private" })}>private</button>
          <button style={selectChip(form.visibility === "public")} onClick={() => setForm({ ...form, visibility: "public" })}>public</button>
        </div>
      </section>

      <section style={stepCard}>
        <StepTitle>最後に手動タイトル（任意）</StepTitle>
        <input value={title} onChange={(e) => setTitle(e.target.value)} style={input} placeholder="手動保存時に使います" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...input, marginTop: 8 }} placeholder="説明（手動保存時）" />
      </section>

      <section style={stepCard}>
        <StepTitle>選択内容のまとめ</StepTitle>
        <ul style={{ margin: 0, paddingLeft: 20, color: "#334155", fontSize: 13, lineHeight: 1.8 }}>
          <li>出発地: {form.departureFrom ?? "未入力"}</li>
          <li>目的地: {form.destination1 ?? "未入力"}{form.destination2 ? ` / ${form.destination2}` : ""}</li>
          <li>同行者: {form.relationship ?? "未選択"}</li>
          <li>日程: {form.tripLengthType === "day_trip" ? "日帰り" : `${form.nights ?? 1}泊`}</li>
          <li>予算感: {form.budgetLevel ?? "未選択"}</li>
        </ul>
      </section>

      <section style={stepCard}>
        <StepTitle>出発地</StepTitle>
        <input value={form.departureFrom ?? ""} onChange={(e) => setForm({ ...form, departureFrom: e.target.value })} style={input} placeholder="例: 東京" />
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
        <button onClick={() => void onGenerate()} disabled={loading} style={btn}>AIにしおりを考えてもらう</button>
        <button onClick={() => void saveManual()} disabled={loading} style={subBtn}>手動で保存</button>
      </div>

      {aiMeta && <p style={{ fontSize: 12, color: "#64748b", marginTop: 10 }}>AI provider: {aiMeta.provider} / model: {aiMeta.model}</p>}

      {loading ? (
        <div style={loadingOverlay}>
          <div style={loadingCard}>
            <div style={spinner} />
            <div style={{ fontWeight: 800, marginTop: 8 }}>{STEP_LOADING_TEXTS[messageIndex]}</div>
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 6 }}>しおりづくりの進行中です。画面はこのままでOKです。</div>
          </div>
        </div>
      ) : null}

      {ai?.plans?.length ? (
        <section style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: 19, fontWeight: 900 }}>2案の旅しおり</h2>
            <button onClick={() => void onGenerate()} style={mini}>再生成</button>
          </div>
          <div style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "90%", overflowX: "auto", gap: 12, paddingBottom: 8 }}>
            {ai.plans.map((plan, idx) => {
              const allItems = plan.days.flatMap((d) => d.items);
              const summary = (category: string) => allItems.find((item) => item.category === category)?.candidateOptions?.[0]?.name ?? "候補を生成中";
              return (
                <article key={idx} style={resultCard}>
                  <p style={{ fontSize: 12, color: "#7c3aed", margin: 0, fontWeight: 800 }}>PLAN {idx + 1}</p>
                  <h3 style={{ margin: "4px 0", fontWeight: 900, fontSize: 18 }}>{plan.title}</h3>
                  <p style={{ fontSize: 13, color: "#475569", marginTop: 6 }}>{plan.concept}</p>
                  <p style={{ fontSize: 12, color: "#334155", marginTop: 4 }}>👤 {plan.recommendedFor ?? "食事と観光をバランス良く楽しみたい人向け"}</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                    <span style={chipStyle}>💰 {plan.estimatedCostMin ?? "-"}〜{plan.estimatedCostMax ?? "-"}円</span>
                    <span style={chipStyle}>🗓 {plan.days.length === 1 ? "日帰り" : `${plan.days.length - 1}泊${plan.days.length}日`}</span>
                  </div>
                  <div style={{ marginTop: 10, display: "grid", gap: 6, fontSize: 12 }}>
                    <div>🍳 朝食: {summary("breakfast")}</div>
                    <div>🍽 ランチ: {summary("lunch")}</div>
                    <div>🌙 夕食: {summary("dinner")}</div>
                    <div>🛏 宿泊: {summary("hotel")}</div>
                    <div>📸 観光: {summary("sightseeing")}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button onClick={() => setDetailPlan(plan)} style={mini}>詳細を見る</button>
                    <button onClick={() => void saveFromAiDraft(plan)} style={miniPrimary}>この案を使う</button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {detailPlan ? (
        <div style={loadingOverlay}>
          <div style={{ ...loadingCard, maxWidth: 720, maxHeight: "85vh", overflowY: "auto", textAlign: "left" }}>
            <h3 style={{ margin: 0, fontSize: 20 }}>{detailPlan.title}</h3>
            <p style={{ color: "#475569", fontSize: 13 }}>{detailPlan.concept}</p>
            <p style={{ fontSize: 13 }}>予算: {detailPlan.estimatedCostMin ?? "-"}〜{detailPlan.estimatedCostMax ?? "-"}円</p>
            {detailPlan.days.map((day) => (
              <section key={day.dayNumber} style={{ marginTop: 10, border: "1px solid #e2e8f0", borderRadius: 10, padding: 8 }}>
                <h4 style={{ margin: 0 }}>Day {day.dayNumber}</h4>
                {day.items.map((item, i) => (
                  <div key={i} style={{ marginTop: 8, borderTop: "1px dashed #e2e8f0", paddingTop: 6 }}>
                    <div style={{ fontWeight: 700 }}>{item.startTime ?? "--:--"} {item.title}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{item.memo ?? ""}</div>
                    {item.candidateOptions?.length ? (
                      <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12 }}>
                        {item.candidateOptions.slice(0, 3).map((opt, idx) => (
                          <li key={idx}>{opt.name} {opt.feature ? `- ${opt.feature}` : ""} ({opt.costMin ?? "-"}〜{opt.costMax ?? "-"}円)</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </section>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button onClick={() => void saveFromAiDraft(detailPlan)} style={miniPrimary}>この案を使う</button>
              <button onClick={() => void saveManual()} style={mini}>保存して編集へ</button>
              <button onClick={() => setDetailPlan(null)} style={mini}>閉じる</button>
            </div>
          </div>
        </div>
      ) : null}
      <style jsx global>{`
        @keyframes plan-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
}

function StepTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 900 }}>{children}</h2>;
}

function createEmptyStop(sortOrder = 0): ManualStopDraft {
  return {
    localId: `${Date.now()}-${sortOrder}-${Math.random().toString(16).slice(2)}`,
    start_time: "",
    category: "観光",
    title: "",
    memo: "",
    map_enabled: false,
    map_label: null,
    map_source: null,
    lat: null,
    lng: null,
    address: null,
    status: "planned",
    resolving: false,
    resolve_error: null,
    candidates: [],
  };
}

function createInitialDays(dayCount: number) {
  return Array.from({ length: dayCount }, () => Array.from({ length: 4 }, (_, idx) => createEmptyStop(idx)));
}

function adjustDays(current: ManualStopDraft[][], dayCount: number) {
  if (!current.length) return createInitialDays(dayCount);
  const next = Array.from({ length: dayCount }, (_, idx) => current[idx] ?? Array.from({ length: 4 }, (_, sIdx) => createEmptyStop(sIdx)));
  return next.map((day) => (day.length === 0 ? [createEmptyStop()] : day));
}

function buildMapLabel(dayNumber: number, startTime: string, title: string) {
  return `${dayNumber}日目 ${startTime || "--:--"} ${title || "タイトル未設定"}`.trim();
}

function shouldReuseStopMapLabel(
  stop: ManualStopDraft,
  nextVisibility: "private" | "public",
  initialVisibility: "private" | "public"
) {
  if (!stop.id || !stop.map_enabled || !stop.map_label) return false;
  return (
    stop.initial_map_label === stop.map_label &&
    stop.initial_lat === stop.lat &&
    stop.initial_lng === stop.lng &&
    stop.initial_map_source === stop.map_source &&
    nextVisibility === initialVisibility
  );
}

function ManualMapPicker({ onCancel, onPick }: { onCancel: () => void; onPick: (lat: number, lng: number) => void }) {
  return (
    <div style={loadingOverlay}>
      <div style={{ ...loadingCard, maxWidth: 560, textAlign: "left" }}>
        <div style={{ fontWeight: 900 }}>地図上で場所を選んでください</div>
        <div style={{ marginTop: 4, color: "#475569", fontSize: 12 }}>タップした場所に付箋を置きます（ダブルタップで決定）。</div>
        <div style={{ height: 320, borderRadius: 12, overflow: "hidden", border: "1px solid #e2e8f0", marginTop: 10 }}>
          <InlineMapView places={[]} onRequestNew={(p: { lat: number; lng: number }) => onPick(p.lat, p.lng)} mode="private" showCenterMarker />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
          <button type="button" onClick={onCancel} style={smallActionBtn}>キャンセル</button>
        </div>
      </div>
    </div>
  );
}

const stepCard: React.CSSProperties = { marginTop: 10, border: "1px solid #e2e8f0", borderRadius: 16, padding: 12, background: "linear-gradient(180deg,#fff,#f8fafc)" };
const input: React.CSSProperties = { display: "block", width: "100%", marginTop: 4, border: "1px solid #cbd5e1", borderRadius: 10, padding: "10px" };
const btn: React.CSSProperties = { border: "none", borderRadius: 12, padding: "12px 10px", fontWeight: 900, background: "linear-gradient(135deg,#7c3aed,#0ea5e9)", color: "white" };
const subBtn: React.CSSProperties = { border: "1px solid #cbd5e1", borderRadius: 12, padding: "12px 10px", fontWeight: 800, background: "#fff", color: "#0f172a" };
const mini: React.CSSProperties = { border: "1px solid #cbd5e1", borderRadius: 999, padding: "8px 12px", background: "#fff", fontWeight: 700, fontSize: 12 };
const miniPrimary: React.CSSProperties = { ...mini, border: "none", background: "#0f172a", color: "#fff" };
const chipStyle: React.CSSProperties = { display: "inline-block", padding: "6px 10px", background: "#eef2ff", borderRadius: 999, color: "#4338ca", fontSize: 12, fontWeight: 700 };
const backBtn: React.CSSProperties = { display: "inline-block", border: "1px solid #cbd5e1", borderRadius: 999, padding: "10px 14px", textDecoration: "none", color: "#0f172a", fontWeight: 700, fontSize: 14, background: "#fff" };
const chipWrap: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8 };
const selectChip = (active: boolean): React.CSSProperties => ({ border: "1px solid", borderColor: active ? "#7c3aed" : "#cbd5e1", borderRadius: 999, padding: "8px 12px", background: active ? "#ede9fe" : "#fff", color: active ? "#6d28d9" : "#334155", fontWeight: 700, fontSize: 13 });
const resultCard: React.CSSProperties = { border: "1px solid #dbeafe", borderRadius: 16, padding: 14, background: "linear-gradient(150deg,#ffffff,#f8fafc)" };
const loadingOverlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,23,42,.35)", display: "grid", placeItems: "center", zIndex: 40, padding: 14 };
const loadingCard: React.CSSProperties = { width: "100%", maxWidth: 360, background: "#fff", borderRadius: 16, border: "1px solid #cbd5e1", padding: 16, textAlign: "center" };
const spinner: React.CSSProperties = { width: 42, height: 42, border: "4px solid #e2e8f0", borderTopColor: "#7c3aed", borderRadius: "50%", margin: "0 auto", animation: "plan-spin 1s linear infinite" };

const manualHeaderCard: React.CSSProperties = { marginTop: 10, padding: 16, borderRadius: 18, border: "1px solid #dbeafe", background: "linear-gradient(160deg,#ffffff,#eff6ff)" };
const manualCard: React.CSSProperties = { marginTop: 12, border: "1px solid #e2e8f0", borderRadius: 16, background: "#fff", padding: 14 };
const dayCard: React.CSSProperties = { marginTop: 14, border: "1px solid #dbeafe", borderRadius: 18, background: "#f8fbff", padding: 14 };
const stopCard: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 14, background: "#fff", padding: 10 };
const manualStopGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "120px 160px 1fr", gap: 8 };
const labelWrap: React.CSSProperties = { display: "block" };
const inputLabel: React.CSSProperties = { fontSize: 11, color: "#64748b", fontWeight: 700 };
const manualSectionTitle: React.CSSProperties = { margin: "0 0 10px", fontSize: 17, fontWeight: 900 };
const saveBtn: React.CSSProperties = { marginTop: 16, width: "100%", border: "none", borderRadius: 14, padding: "14px 12px", background: "linear-gradient(135deg,#2563eb,#0ea5e9)", color: "#fff", fontWeight: 900, fontSize: 16 };
const mapDoneBadge: React.CSSProperties = { display: "inline-block", borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 700, color: "#0f766e", background: "#ccfbf1" };
const mapMuted: React.CSSProperties = { display: "inline-block", borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 700, color: "#64748b", background: "#f1f5f9" };
const smallActionBtn: React.CSSProperties = { border: "1px solid #cbd5e1", borderRadius: 999, padding: "7px 12px", background: "#fff", fontWeight: 700, fontSize: 12 };
const mapButton = (enabled: boolean): React.CSSProperties => ({ border: "none", borderRadius: 999, padding: "7px 12px", background: enabled ? "#0f766e" : "#2563eb", color: "#fff", fontWeight: 800, fontSize: 12 });
const candidateBox: React.CSSProperties = { marginTop: 8, border: "1px dashed #cbd5e1", borderRadius: 10, padding: 8, background: "#f8fafc" };
const candidateButton: React.CSSProperties = { textAlign: "left", border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff", padding: "8px 10px" };
const metaGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 };
const pillButton = (active: boolean): React.CSSProperties => ({ border: "1px solid", borderColor: active ? "#2563eb" : "#cbd5e1", borderRadius: 999, padding: "9px 14px", background: active ? "#dbeafe" : "#fff", color: active ? "#1d4ed8" : "#334155", fontWeight: 700, fontSize: 13 });
