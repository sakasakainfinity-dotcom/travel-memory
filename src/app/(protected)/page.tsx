// src/app/page.tsx
"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Place as MapPlace } from "@/components/MapView";
import SearchBox from "@/components/SearchBox";
import { supabase } from "@/lib/supabaseClient";
import { ensureMySpace } from "@/lib/ensureMySpace";
import { useRouter } from "next/navigation";
import { compress } from "@/lib/image";
import KebabMenu from "@/components/KebabMenu";
import { useSearchParams } from "next/navigation";
import PlaceGeocodeSearch from "@/components/PlaceGeocodeSearch";


const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });
const LS_LAYER_TOGGLE_VISIBLE = "tm_layer_toggle_visible";
const LS_ENABLED_LAYER_SLUGS = "tm_enabled_layer_slugs";

type View = { lat: number; lng: number; zoom: number };

type PhotoRow = {
  id: string;
  place_id: string;
  file_url: string;
  storage_path: string;
};

/* ================== 投稿モーダル（新規作成・カメラ重視） ================== */
function PostModal({
  open,
  place,
  presetTitle,
  onClose,
  onSubmit,
}: {
  open: boolean;
  place: { lat: number; lng: number };
  presetTitle?: string;
  onClose: () => void;
  onSubmit: (d: {
    clientRequestId: string;
    title: string;
    memo: string;
    address?: string;
    visitedAt?: string;
    lat: number;
    lng: number;
    photos: File[];
    visibility: "public" | "private";
  }) => Promise<void>;
}) {
  const todayYmd = () => {
    const d = new Date();
    const z = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  };

  /* ---------- 必須/基本 ---------- */
  const [title, setTitle] = useState("");
  const [hitokoto, setHitokoto] = useState(""); // ひとこと（任意）
  const [visitedAt, setVisitedAt] = useState<string>(() => todayYmd()); // UIは出さないが裏で送る
  const [files, setFiles] = useState<File[]>([]);
  const [visibility, setVisibility] = useState<"public" | "private">("private");

  // lat/lng は UIから消すが裏で保持して送る
  const [lat, setLat] = useState(place.lat);
  const [lng, setLng] = useState(place.lng);

  // 時間帯（任意）
  const [timeOfDay, setTimeOfDay] = useState<
    "" | "morning" | "noon" | "evening" | "night"
  >("");

  /* ---------- 撮影データ（折りたたみ）任意 ---------- */
  const [openMeta, setOpenMeta] = useState(false);
  const [cameraModel, setCameraModel] = useState("");
  const [focalLength, setFocalLength] = useState("");
  const [aperture, setAperture] = useState("");
  const [shutterSpeed, setShutterSpeed] = useState("");
  const [iso, setIso] = useState("");
  const [shootMemo, setShootMemo] = useState("");

  /* ---------- 投稿制御 ---------- */
  const [clientRequestId, setClientRequestId] = useState<string>(() =>
    crypto.randomUUID()
  );
  const creatingRef = useRef(false);
  const [saving, setSaving] = useState(false);

  // 開くたびリセット
  useEffect(() => {
    if (!open) return;

    setTitle((presetTitle ?? "").trim());
    setHitokoto("");
    setVisitedAt(todayYmd());
    setFiles([]);
    setVisibility("private");

    setLat(place.lat);
    setLng(place.lng);

    setTimeOfDay("");

    setOpenMeta(false);
    setCameraModel("");
    setFocalLength("");
    setAperture("");
    setShutterSpeed("");
    setIso("");
    setShootMemo("");

    setClientRequestId(crypto.randomUUID());
    creatingRef.current = false;
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, place.lat, place.lng, presetTitle]);

  // プレビュー
  const previews = useMemo(
    () => files.map((f) => ({ url: URL.createObjectURL(f), name: f.name })),
    [files]
  );
  useEffect(() => {
    return () => previews.forEach((p) => URL.revokeObjectURL(p.url));
  }, [previews]);

  const canSave = title.trim().length > 0 && files.length > 0;

  const timeOfDayLabel = (v: typeof timeOfDay) => {
    switch (v) {
      case "morning":
        return "朝";
      case "noon":
        return "昼";
      case "evening":
        return "夕";
      case "night":
        return "夜";
      default:
        return "";
    }
  };

  // 既存DBを壊さないため：撮影データは memo にまとめて入れる
  const buildMemo = () => {
    const lines: string[] = [];
    const t = timeOfDayLabel(timeOfDay);
    if (t) lines.push(`時間帯：${t}`);
    if (hitokoto.trim()) lines.push(hitokoto.trim());

    const metaLines: string[] = [];
    if (cameraModel.trim()) metaLines.push(`機種：${cameraModel.trim()}`);
    if (focalLength.trim() || aperture.trim())
      metaLines.push(`焦点距離：${focalLength.trim() || "-"} / F：${aperture.trim() || "-"}`);
    if (shutterSpeed.trim() || iso.trim())
      metaLines.push(`SS：${shutterSpeed.trim() || "-"} / ISO：${iso.trim() || "-"}`);
    if (shootMemo.trim()) metaLines.push(`メモ：${shootMemo.trim()}`);

    if (metaLines.length > 0) {
      lines.push("");
      lines.push("[撮影データ]");
      lines.push(...metaLines);
    }

    // 何も無いときは空文字じゃなくて最小でもOK
    return lines.join("\n").trim();
  };

  async function submit() {
    if (creatingRef.current) return;
    if (!canSave) return;

    creatingRef.current = true;
    setSaving(true);

    try {
      await onSubmit({
        clientRequestId,
        title: title.trim(),
        memo: buildMemo(),
        // address は使わない（UIから削除）→送らない
        visitedAt,
        lat,
        lng,
        photos: files,
        visibility,
      });
    } finally {
      creatingRef.current = false;
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.45)",
        zIndex: 999999,
        display: "grid",
        placeItems: "center",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(920px, 92vw)",
          maxHeight: "86vh",
          overflow: "auto",
          background: "#fff",
          borderRadius: 14,
          padding: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,.35)",
        }}
      >
       <div
  style={{
    margin: "-16px -16px 14px -16px", // モーダルpadding(16)を相殺して端まで帯にする
    padding: "10px 16px",
    background: "linear-gradient(90deg, rgba(34,197,94,0.10), rgba(251,146,60,0.10), rgba(168,85,247,0.10))",
    borderBottom: "1px solid rgba(0,0,0,0.08)",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  }}
>
  <div
    style={{
      fontWeight: 900,
      fontSize: 16,
      textAlign: "center",
      letterSpacing: -0.2,
      color: "#111827",
    }}
  >
    ■ 新しい投稿 ■
  </div>
</div>


        {/* 写真（必須） */}
        <div style={{ marginTop: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 800, color: "#111827" }}>
            写真（必須）
          </label>
          <div style={{ marginTop: 6 }}>
            <label style={{ display: "inline-block" }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: 800,
                }}
              >
                写真を追加
              </span>
              <input
                type="file"
                accept="image/*,image/heic,image/heif"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                style={{ display: "none" }}
              />
            </label>
          </div>

          {previews.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: 8,
                marginTop: 10,
              }}
            >
              {previews.map((p) => (
                <div
                  key={p.url}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 10,
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={p.url}
                    alt={p.name}
                    style={{ width: "100%", height: 120, objectFit: "cover" }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* タイトル（必須） */}
        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 800, color: "#111827" }}>
            タイトル（必須）
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例：夕暮れの川沿い"
            style={{
              width: "100%",
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: "8px 10px",
              marginTop: 6,
            }}
          />
        </div>

        {/* ひとこと（任意） */}
        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 12, color: "#111827", fontWeight: 700 }}>
            ひとこと（任意）
          </label>
          <textarea
            value={hitokoto}
            onChange={(e) => setHitokoto(e.target.value)}
            placeholder="そのときの気持ちをひとこと"
            style={{
              width: "100%",
              height: 64,
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: "8px 10px",
              marginTop: 6,
            }}
          />
        </div>

        {/* 時間帯（任意）チップ */}
        <div style={{ marginTop: 12 }}>
  <label
    style={{
      fontSize: 12,
      color: "#555",
      display: "block",
      marginBottom: 6,
      textAlign: "center",
    }}
  >
    時間帯（任意）
  </label>

  <div
    style={{
      display: "flex",
      gap: 8,
      justifyContent: "center",
      flexWrap: "wrap",
    }}
  >
    {[
      {
        key: "morning" as const,
        label: "朝",
        softBg: "rgba(253, 224, 71, 0.25)",   // 薄い黄色
        strongBg: "#fde047",
        text: "#92400e",
      },
      {
        key: "noon" as const,
        label: "昼",
        softBg: "rgba(34, 197, 94, 0.22)",   // 薄い緑
        strongBg: "#22c55e",
        text: "#064e3b",
      },
      {
        key: "evening" as const,
        label: "夕",
        softBg: "rgba(251, 146, 60, 0.25)",  // 薄いオレンジ
        strongBg: "#fb923c",
        text: "#7c2d12",
      },
      {
        key: "night" as const,
        label: "夜",
        softBg: "rgba(168, 85, 247, 0.22)",  // 薄い紫
        strongBg: "#a855f7",
        text: "#3b0764",
      },
    ].map((t) => {
      const active = timeOfDay === t.key;

      return (
        <button
          key={t.key}
          type="button"
          onClick={() => setTimeOfDay(active ? "" : t.key)}
          style={{
            height: 34,
            minWidth: 72,
            padding: "0 12px",
            borderRadius: 999,
            border: active
              ? `2px solid ${t.strongBg}`
              : "1px solid rgba(0,0,0,0.12)",
            background: active ? t.strongBg : t.softBg,
            color: t.text,
            fontWeight: 800,
            fontSize: 11,
            cursor: "pointer",
            transition: "all 0.15s ease",
            boxShadow: active
              ? "0 10px 22px rgba(0,0,0,0.18)"
              : "none",
            transform: active ? "translateY(-1px)" : "none",
          }}
        >
          {t.label}
        </button>
      );
    })}
  </div>
</div>


        {/* 📷 撮影データ（任意）折りたたみ */}
        <div style={{ marginTop: 16 }}>
          <button
            type="button"
            onClick={() => setOpenMeta((v) => !v)}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>📷 撮影データ（任意）</span>
            <span style={{ color: "#6b7280" }}>{openMeta ? "▲" : "▼"}</span>
          </button>

          {openMeta && (
            <div
              style={{
                marginTop: 10,
                border: "1px solid #eee",
                borderRadius: 12,
                padding: 12,
                background: "#fafafa",
              }}
            >
              {/* 1行目：機種 */}
              <label style={{ fontSize: 12, color: "#111827", fontWeight: 700 }}>
                カメラ機種（任意）
              </label>
              <input
                value={cameraModel}
                onChange={(e) => setCameraModel(e.target.value)}
                placeholder="例：FUJIFILM X-T5 / iPhone 15 Pro"
                style={{
                  width: "100%",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  padding: "8px 10px",
                  marginTop: 6,
                  background: "#fff",
                }}
              />

              {/* 2-3行目：2カラム */}
              <div
                style={{
                  marginTop: 10,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <div>
                  <label style={{ fontSize: 12, color: "#111827", fontWeight: 700 }}>
                    焦点距離（任意）
                  </label>
                  <input
                    value={focalLength}
                    onChange={(e) => setFocalLength(e.target.value)}
                    placeholder="例：35mm"
                    style={{
                      width: "100%",
                      border: "1px solid #ddd",
                      borderRadius: 8,
                      padding: "8px 10px",
                      marginTop: 6,
                      background: "#fff",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, color: "#111827", fontWeight: 700 }}>
                    F値（任意）
                  </label>
                  <input
                    value={aperture}
                    onChange={(e) => setAperture(e.target.value)}
                    placeholder="例：f/1.8"
                    style={{
                      width: "100%",
                      border: "1px solid #ddd",
                      borderRadius: 8,
                      padding: "8px 10px",
                      marginTop: 6,
                      background: "#fff",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, color: "#111827", fontWeight: 700 }}>
                    シャッター速度（任意）
                  </label>
                  <input
                    value={shutterSpeed}
                    onChange={(e) => setShutterSpeed(e.target.value)}
                    placeholder="例：1/250"
                    style={{
                      width: "100%",
                      border: "1px solid #ddd",
                      borderRadius: 8,
                      padding: "8px 10px",
                      marginTop: 6,
                      background: "#fff",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, color: "#111827", fontWeight: 700 }}>
                    ISO（任意）
                  </label>
                  <input
                    value={iso}
                    onChange={(e) => setIso(e.target.value)}
                    placeholder="例：100"
                    style={{
                      width: "100%",
                      border: "1px solid #ddd",
                      borderRadius: 8,
                      padding: "8px 10px",
                      marginTop: 6,
                      background: "#fff",
                    }}
                  />
                </div>
              </div>

              {/* 4行目：撮影メモ */}
              <div style={{ marginTop: 10 }}>
                <label style={{ fontSize: 12, color: "#111827", fontWeight: 700 }}>
                  撮影メモ（任意）
                </label>
                <textarea
                  value={shootMemo}
                  onChange={(e) => setShootMemo(e.target.value)}
                  placeholder="構図の意図、次回こう撮りたい…など"
                  style={{
                    width: "100%",
                    height: 90,
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    padding: "8px 10px",
                    marginTop: 6,
                    background: "#fff",
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* 公開範囲（既存踏襲） */}
        <div style={{ marginTop: 14 }}>
          <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 6 }}>
            公開範囲
          </label>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              {
                key: "public" as const,
                label: "公開",
                sub: "全国どのユーザーからも見える",
                color: "#2563eb",
              },
              {
                key: "private" as const,
                label: "非公開",
                sub: "自分だけ",
                color: "#ef4444",
              },
            ].map((opt) => {
              const active = visibility === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setVisibility(opt.key)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 2,
                    padding: "8px 12px",
                    borderRadius: 999,
                    border: active ? `2px solid ${opt.color}` : "1px solid #d1d5db",
                    background: active ? `${opt.color}22` : "#fff",
                    color: "#111827",
                    fontSize: 12,
                    cursor: "pointer",
                    minWidth: 120,
                  }}
                >
                  <span style={{ fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: opt.color }} />
                    {opt.label}
                  </span>
                  <span style={{ fontSize: 11, color: "#6b7280" }}>{opt.sub}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ボタン */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              padding: "8px 12px",
              border: "1px solid #ddd",
              borderRadius: 8,
              background: "#fff",
              opacity: saving ? 0.6 : 1,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            閉じる
          </button>

          <button
            onClick={submit}
            disabled={saving || !canSave}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "#000",
              color: "#fff",
              fontWeight: 800,
              opacity: saving || !canSave ? 0.6 : 1,
              cursor: saving || !canSave ? "not-allowed" : "pointer",
            }}
            title={!canSave ? "写真とタイトルが必須です" : ""}
          >
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================== 編集モーダル（カメラ重視・memoにまとめて保存） ================== */
function EditModal({
  open,
  place,
  onClose,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  place: { id: string; title: string; memo: string };
  onClose: () => void;
  onSaved: (d: { title?: string; memo?: string; addPhotos?: File[] }) => void;
  onDeleted: () => void;
}) {
  const [title, setTitle] = useState(place.title ?? "");
  const [hitokoto, setHitokoto] = useState(""); // ひとこと
  const [timeOfDay, setTimeOfDay] = useState<
    "" | "morning" | "noon" | "evening" | "night"
  >("");

  const [openMeta, setOpenMeta] = useState(false);
  const [cameraModel, setCameraModel] = useState("");
  const [focalLength, setFocalLength] = useState("");
  const [aperture, setAperture] = useState("");
  const [shutterSpeed, setShutterSpeed] = useState("");
  const [iso, setIso] = useState("");
  const [shootMemo, setShootMemo] = useState("");

  const [addFiles, setAddFiles] = useState<File[]>([]);

  // 既存memoから「ざっくり復元」(完全じゃなくてOK)
  useEffect(() => {
    if (!open) return;

    setTitle(place.title ?? "");

    // デフォルト：全部空で開始（沼らない）
    setHitokoto("");
    setTimeOfDay("");
    setOpenMeta(false);
    setCameraModel("");
    setFocalLength("");
    setAperture("");
    setShutterSpeed("");
    setIso("");
    setShootMemo("");
    setAddFiles([]);

    // できる範囲で復元（あなたの新規投稿のフォーマットに合わせる）
    const m = (place.memo ?? "").trim();
    if (m) {
      // 時間帯：朝/昼/夕/夜
      const tod = m.match(/時間帯：([^\n]+)/)?.[1]?.trim();
      if (tod === "朝") setTimeOfDay("morning");
      if (tod === "昼") setTimeOfDay("noon");
      if (tod === "夕") setTimeOfDay("evening");
      if (tod === "夜") setTimeOfDay("night");

      // [撮影データ] の前をひとこと扱い（雑だけど実用的）
      const parts = m.split("\n[撮影データ]\n");
      const before = parts[0] ?? "";
      // 「時間帯：」行を除いた残りをひとことへ
      const hk = before
        .split("\n")
        .filter((line) => !line.startsWith("時間帯："))
        .join("\n")
        .trim();
      if (hk) setHitokoto(hk);

      const meta = parts[1];
      if (meta) {
        const cam = meta.match(/機種：([^\n]+)/)?.[1]?.trim();
        if (cam) setCameraModel(cam);

        const fl = meta.match(/焦点距離：([^/]+)\/\s*F：([^\n]+)/);
        if (fl) {
          setFocalLength((fl[1] ?? "").trim().replace(/^-$/, ""));
          setAperture((fl[2] ?? "").trim().replace(/^-$/, ""));
        }

        const ss = meta.match(/SS：([^/]+)\/\s*ISO：([^\n]+)/);
        if (ss) {
          setShutterSpeed((ss[1] ?? "").trim().replace(/^-$/, ""));
          setIso((ss[2] ?? "").trim().replace(/^-$/, ""));
        }

        const sm = meta.match(/メモ：([^\n]+)/)?.[1]?.trim();
        if (sm) setShootMemo(sm);

        // 開いてあげる（ガチ勢には嬉しい）
        setOpenMeta(true);
      }
    }
  }, [open, place.id, place.title, place.memo]);

  const previews = useMemo(
    () => addFiles.map((f) => ({ url: URL.createObjectURL(f), name: f.name })),
    [addFiles]
  );
  useEffect(() => {
    return () => previews.forEach((p) => URL.revokeObjectURL(p.url));
  }, [previews]);

  const timeOfDayLabel = (v: typeof timeOfDay) => {
    switch (v) {
      case "morning":
        return "朝";
      case "noon":
        return "昼";
      case "evening":
        return "夕";
      case "night":
        return "夜";
      default:
        return "";
    }
  };

  const buildMemo = () => {
    const lines: string[] = [];
    const t = timeOfDayLabel(timeOfDay);
    if (t) lines.push(`時間帯：${t}`);
    if (hitokoto.trim()) lines.push(hitokoto.trim());

    const metaLines: string[] = [];
    if (cameraModel.trim()) metaLines.push(`機種：${cameraModel.trim()}`);
    if (focalLength.trim() || aperture.trim()) {
      metaLines.push(
        `焦点距離：${focalLength.trim() || "-"} / F：${aperture.trim() || "-"}`
      );
    }
    if (shutterSpeed.trim() || iso.trim()) {
      metaLines.push(
        `SS：${shutterSpeed.trim() || "-"} / ISO：${iso.trim() || "-"}`
      );
    }
    if (shootMemo.trim()) metaLines.push(`メモ：${shootMemo.trim()}`);

    if (metaLines.length > 0) {
      lines.push("");
      lines.push("[撮影データ]");
      lines.push(...metaLines);
    }

    return lines.join("\n").trim();
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.45)",
        zIndex: 999999,
        display: "grid",
        placeItems: "center",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(920px, 92vw)",
          maxHeight: "86vh",
          overflow: "auto",
          background: "#fff",
          borderRadius: 14,
          padding: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,.35)",
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 12 }}>
          ✏️ 投稿を編集
        </div>

        {/* タイトル */}
        <div style={{ marginTop: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 800, color: "#111827" }}>
            タイトル（必須）
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              width: "100%",
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: "8px 10px",
              marginTop: 6,
            }}
          />
        </div>

        {/* ひとこと */}
        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>
            ひとこと（任意）
          </label>
          <textarea
            value={hitokoto}
            onChange={(e) => setHitokoto(e.target.value)}
            style={{
              width: "100%",
              height: 64,
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: "8px 10px",
              marginTop: 6,
            }}
          />
        </div>

        {/* 時間帯 */}
       <div style={{ marginTop: 12 }}>
  <label
    style={{
      fontSize: 12,
      color: "#555",
      display: "block",
      marginBottom: 6,
      textAlign: "center",
    }}
  >
    時間帯（任意）
  </label>

  <div
    style={{
      display: "flex",
      gap: 8,
      justifyContent: "center",
      flexWrap: "wrap",
    }}
  >
    {[
      {
        key: "morning" as const,
        label: "朝",
        softBg: "rgba(253, 224, 71, 0.25)",   // 薄い黄色
        strongBg: "#fde047",
        text: "#92400e",
      },
      {
        key: "noon" as const,
        label: "昼",
        softBg: "rgba(34, 197, 94, 0.22)",   // 薄い緑
        strongBg: "#22c55e",
        text: "#064e3b",
      },
      {
        key: "evening" as const,
        label: "夕",
        softBg: "rgba(251, 146, 60, 0.25)",  // 薄いオレンジ
        strongBg: "#fb923c",
        text: "#7c2d12",
      },
      {
        key: "night" as const,
        label: "夜",
        softBg: "rgba(168, 85, 247, 0.22)",  // 薄い紫
        strongBg: "#a855f7",
        text: "#3b0764",
      },
    ].map((t) => {
      const active = timeOfDay === t.key;

      return (
        <button
          key={t.key}
          type="button"
          onClick={() => setTimeOfDay(active ? "" : t.key)}
          style={{
            height: 34,
            minWidth: 72,
            padding: "0 12px",
            borderRadius: 999,
            border: active
              ? `2px solid ${t.strongBg}`
              : "1px solid rgba(0,0,0,0.12)",
            background: active ? t.strongBg : t.softBg,
            color: t.text,
            fontWeight: 800,
            fontSize: 10,
            cursor: "pointer",
            transition: "all 0.15s ease",
            boxShadow: active
              ? "0 10px 22px rgba(0,0,0,0.18)"
              : "none",
            transform: active ? "translateY(-1px)" : "none",
          }}
        >
          {t.label}
        </button>
      );
    })}
  </div>
</div>


        {/* 撮影データ */}
        <div style={{ marginTop: 16 }}>
          <button
            type="button"
            onClick={() => setOpenMeta((v) => !v)}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>📷 撮影データ（任意）</span>
            <span style={{ color: "#6b7280" }}>{openMeta ? "▲" : "▼"}</span>
          </button>

          {openMeta && (
            <div
              style={{
                marginTop: 10,
                border: "1px solid #eee",
                borderRadius: 12,
                padding: 12,
                background: "#fafafa",
              }}
            >
              <label style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>
                カメラ機種（任意）
              </label>
              <input
                value={cameraModel}
                onChange={(e) => setCameraModel(e.target.value)}
                style={{
                  width: "100%",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  padding: "8px 10px",
                  marginTop: 6,
                  background: "#fff",
                }}
              />

              <div
                style={{
                  marginTop: 10,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>
                    焦点距離（任意）
                  </label>
                  <input
                    value={focalLength}
                    onChange={(e) => setFocalLength(e.target.value)}
                    style={{
                      width: "100%",
                      border: "1px solid #ddd",
                      borderRadius: 8,
                      padding: "8px 10px",
                      marginTop: 6,
                      background: "#fff",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>
                    F値（任意）
                  </label>
                  <input
                    value={aperture}
                    onChange={(e) => setAperture(e.target.value)}
                    style={{
                      width: "100%",
                      border: "1px solid #ddd",
                      borderRadius: 8,
                      padding: "8px 10px",
                      marginTop: 6,
                      background: "#fff",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>
                    シャッター速度（任意）
                  </label>
                  <input
                    value={shutterSpeed}
                    onChange={(e) => setShutterSpeed(e.target.value)}
                    style={{
                      width: "100%",
                      border: "1px solid #ddd",
                      borderRadius: 8,
                      padding: "8px 10px",
                      marginTop: 6,
                      background: "#fff",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>
                    ISO（任意）
                  </label>
                  <input
                    value={iso}
                    onChange={(e) => setIso(e.target.value)}
                    style={{
                      width: "100%",
                      border: "1px solid #ddd",
                      borderRadius: 8,
                      padding: "8px 10px",
                      marginTop: 6,
                      background: "#fff",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>
                  撮影メモ（任意）
                </label>
                <textarea
                  value={shootMemo}
                  onChange={(e) => setShootMemo(e.target.value)}
                  style={{
                    width: "100%",
                    height: 90,
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    padding: "8px 10px",
                    marginTop: 6,
                    background: "#fff",
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* 写真追加（編集なので「追加」だけ） */}
        <div style={{ marginTop: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>
            写真を追加（任意）
          </label>
          <div style={{ marginTop: 6 }}>
            <label style={{ display: "inline-block" }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: 800,
                }}
              >
                写真を追加
              </span>
              <input
                type="file"
                accept="image/*,image/heic,image/heif"
                multiple
                onChange={(e) => setAddFiles(Array.from(e.target.files ?? []))}
                style={{ display: "none" }}
              />
            </label>
          </div>

          {previews.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: 8,
                marginTop: 10,
              }}
            >
              {previews.map((p) => (
                <img
                  key={p.url}
                  src={p.url}
                  alt={p.name}
                  style={{
                    width: "100%",
                    height: 120,
                    objectFit: "cover",
                    borderRadius: 10,
                    border: "1px solid #eee",
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* 操作 */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button
            onClick={onDeleted}
            style={{
              padding: "8px 12px",
              border: "1px solid #ef4444",
              borderRadius: 8,
              background: "#fff",
              color: "#ef4444",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            削除
          </button>

          <button
            onClick={onClose}
            style={{
              padding: "8px 12px",
              border: "1px solid #ddd",
              borderRadius: 8,
              background: "#fff",
              cursor: "pointer",
            }}
          >
            閉じる
          </button>

          <button
            onClick={() => onSaved({ title: title.trim(), memo: buildMemo(), addPhotos: addFiles })}
            disabled={title.trim().length === 0}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "#000",
              color: "#fff",
              fontWeight: 800,
              opacity: title.trim().length === 0 ? 0.6 : 1,
              cursor: title.trim().length === 0 ? "not-allowed" : "pointer",
            }}
            title={title.trim().length === 0 ? "タイトルは必須です" : ""}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}



/* =============== DB 保存（新規） =============== */
async function insertPlace({
  clientRequestId, 
  lat,
  lng,
  title,
  memo,
  visitedAt,
  files,
  visibility,
  spotId,
}: {
  clientRequestId: string;
  lat: number;
  lng: number;
  title?: string;
  memo?: string;
  visitedAt?: string;
  files: File[];
  visibility: "public" | "private";
   spotId?: string | null;
}) {
  // 認証
  const { data: ses } = await supabase.auth.getSession();
  const uid = ses.session?.user.id;
  if (!uid) throw new Error("ログインが必要です（sessionなし）");

  // 👇★ ここで displayName を作る
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  const displayName =
    (user?.user_metadata as any)?.display_name ||
    (user?.user_metadata as any)?.name ||
    (user?.email?.split("@")[0] ?? "名無しの旅人");

  // 自分のスペース
  const sp = await ensureMySpace();
  if (!sp?.id) throw new Error("スペースが取得できませんでした");

  // 1) places 行を先に作る（★ created_by_name を保存）
  const { data: placeRow, error: ePlace } = await supabase
  .from("places")
  .upsert(
    {
      space_id: sp.id,
      client_request_id: clientRequestId,
      title: title ?? null,
      memo: memo ?? null,
      lat,
      lng,
      visited_at: visitedAt ?? null,
      created_by: uid,
      created_by_name: displayName,
      visibility,
    },
    { onConflict: "space_id,client_request_id" }
  )
  .select("id, title, memo, lat, lng, visibility, created_by_name, created_at")
  .single();

  if (ePlace) throw new Error(`[PLACES] ${ePlace.message || ePlace.code}`);

   if (spotId) {
    const { error: eProg } = await supabase
      .from("pilgrimage_progress")
      .upsert(
        { user_id: uid, spot_id: spotId, post_id: placeRow.id },
        { onConflict: "user_id,spot_id" }
      );
    if (eProg) throw new Error(`[PILGRIMAGE] ${eProg.message}`);
  }
  
  // 2) 写真（JPEG化→保存）
  const urls: string[] = [];
  for (const f of files ?? []) {
    const jpegBlob = await compress(f);

    const path = `${placeRow.id}/${crypto.randomUUID()}.jpg`;
    const { error: eUp } = await supabase.storage
      .from("photos")
      .upload(path, jpegBlob, {
        upsert: false,
        cacheControl: "3600",
        contentType: "image/jpeg",
      });
    if (eUp) throw new Error(`[STORAGE] ${eUp.message}`);

    const { data: pub } = supabase.storage.from("photos").getPublicUrl(path);
    const publicUrl = pub.publicUrl;

    const { error: ePhoto } = await supabase.from("photos").insert({
      place_id: placeRow.id,
      space_id: sp.id,
      file_url: publicUrl,
      storage_path: path,
    });
    if (ePhoto) throw new Error(`[PHOTOS] ${ePhoto.message}`);

    urls.push(publicUrl);
  }

  // 呼び出し側が使う返り値
  return {
    id: placeRow.id,
    title: placeRow.title,
    memo: placeRow.memo,
    lat: placeRow.lat,
    lng: placeRow.lng,
    visibility: placeRow.visibility,
    createdByName: placeRow.created_by_name,
    createdAt: placeRow.created_at,
    photos: urls,
  };
}




/* ================== ページ本体 ================== */
export default function Page() {
  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);


    // ===== 巡礼レイヤー（将来対応・汎用） =====
  const LS_LAYER_TOGGLE_VISIBLE = "tm_layer_toggle_visible";
  const LS_ENABLED_LAYER_SLUGS = "tm_enabled_layer_slugs";
  const [layerErr, setLayerErr] = useState<string | null>(null);

  const [layerToggleVisible, setLayerToggleVisible] = useState(false);
  const [enabledLayerSlugs, setEnabledLayerSlugs] = useState<string[]>([]);
  const [layerPlacesBySlug, setLayerPlacesBySlug] = useState<Record<string, MapPlace[]>>({});

  const loadedSlugsRef = useRef<Set<string>>(new Set());

  const [newAt, setNewAt] = useState<{
  lat: number;
  lng: number;
  // 巡礼用（城タップ時だけ入る）
  mode?: "normal" | "pilgrimage";
  slug?: string | null;
  spotId?: string | null;
  presetTitle?: string | null;
} | null>(null);

  const parsePilgrimageKeys = (placeId: string) => {
  if (!placeId?.startsWith("layer:")) return null;
  const parts = placeId.split(":");
  if (parts.length < 3) return null;
  return { slug: parts[1], spotId: parts.slice(2).join(":") };
};

const cleanPilgrimageTitle = (name?: string | null) =>
  (name ?? "").replace(/^🏯\s*/, "").replace(/（済）\s*$/, "").trim();

  
    // 巡礼レイヤー：初回に localStorage から復元
  useEffect(() => {
    try {
      const vis = localStorage.getItem(LS_LAYER_TOGGLE_VISIBLE) === "1";
      setLayerToggleVisible(vis);

      const raw = localStorage.getItem(LS_ENABLED_LAYER_SLUGS);
      const arr = raw ? JSON.parse(raw) : [];
      setEnabledLayerSlugs(Array.isArray(arr) ? arr : []);
    } catch {
      setLayerToggleVisible(false);
      setEnabledLayerSlugs([]);
    }
  }, []);

useEffect(() => {
  (async () => {
    try {
      setLayerErr(null);

      // 何もONじゃなければ終わり（ついでにロード済みもリセット）
      if (enabledLayerSlugs.length === 0) {
        loadedSlugsRef.current = new Set();
        setLayerPlacesBySlug({});
        return;
      }

      const { data: ses, error: sesErr } = await supabase.auth.getSession();
      if (sesErr) throw new Error(`session: ${sesErr.message}`);
      const uid = ses.session?.user.id;
      if (!uid) throw new Error("not logged in");

      // OFFになったslugは掃除（表示もキャッシュも）
      setLayerPlacesBySlug((prev) => {
        const next: Record<string, MapPlace[]> = {};
        for (const slug of enabledLayerSlugs) {
          if (prev[slug]) next[slug] = prev[slug];
        }
        return next;
      });
      loadedSlugsRef.current = new Set(
        [...loadedSlugsRef.current].filter((s) => enabledLayerSlugs.includes(s))
      );

      for (const slug of enabledLayerSlugs) {
        if (loadedSlugsRef.current.has(slug)) continue;

        // mission
        const { data: m, error: me } = await supabase
          .from("pilgrimage_missions")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();
        if (me) throw new Error(`missions: ${me.message}`);
        if (!m?.id) throw new Error(`mission not found: ${slug}`);

        // spots
        const { data: spots, error: se } = await supabase
          .from("pilgrimage_spots")
          .select("id,name,lat,lng")
          .eq("mission_id", m.id);
        if (se) throw new Error(`spots: ${se.message}`);
        if (!spots || spots.length === 0) throw new Error(`spots empty: ${slug}`);

        // progress
        const { data: prog, error: pe } = await supabase
          .from("pilgrimage_progress")
          .select("spot_id")
          .eq("user_id", uid);
        if (pe) throw new Error(`progress: ${pe.message}`);

        const achieved = new Set((prog ?? []).map((r: any) => r.spot_id));

        const layerPlaces: MapPlace[] = spots.map((s: any) => {
  const done = achieved.has(s.id);
  return {
    id: `layer:${slug}:${s.id}`,
    name: done ? `🏯 ${s.name}（済）` : `🏯 ${s.name}`,
    memo: done ? "visited" : undefined,
    lat: s.lat,
    lng: s.lng,
    photos: [{ url: "", storage_path: "" } as any], // ←重要：MapViewのフィルタ突破
    visibility: "public",
    visitedByMe: done,
  };
});
        setLayerPlacesBySlug((prev) => ({ ...prev, [slug]: layerPlaces }));
        loadedSlugsRef.current.add(slug);
      }
    } catch (e: any) {
      setLayerErr(e?.message ?? String(e));
    }
  })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [enabledLayerSlugs]);



  // 初回起動イベント（Plausible）
  useEffect(() => {
    if (localStorage.getItem('first_open_sent')) return;
    // @ts-ignore
    window.plausible?.('first_open');
    localStorage.setItem('first_open_sent', '1');
  }, []);

  const [editOpen, setEditOpen] = useState(false);

  const getViewRef = useRef<() => View>(() => ({ lat: 35.68, lng: 139.76, zoom: 9 }));
  const setViewRef = useRef<(v: View) => void>(() => {});
  const [initialView, setInitialView] = useState<View | undefined>(undefined);

    const handleGlobalSelect = (p: { lat: number; lng: number }) => {
    // MapView に飛んでもらう
    setFlyTo({ lat: p.lat, lng: p.lng, zoom: 16 });
  };

  // /?focus=... /?open=1 /?lat=..&lng=.. を解釈
  const sp = useSearchParams();
  const focusId = sp.get("focus");
  const wantOpen = sp.get("open") === "1";
  const qLat = sp.get("lat");
  const qLng = sp.get("lng");
  const didApplyRef = useRef(false);

  // ▼▼ ④ 地図に渡すplacesを合体（ここに追加） ▼▼
const mergedPlaces = useMemo(() => {
  const layerPlaces = Object.values(layerPlacesBySlug).flat();
  return enabledLayerSlugs.length > 0
    ? [...places, ...layerPlaces]
    : places;
}, [places, layerPlacesBySlug, enabledLayerSlugs.length]);
  

  // 1) 座標が来てたら先にジャンプ
  useEffect(() => {
    if (didApplyRef.current) return;
    if (!qLat || !qLng) return;
    const lat = parseFloat(qLat);
    const lng = parseFloat(qLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setFlyTo({ lat, lng, zoom: 15 });
  }, [qLat, qLng]);

  // 2) places 揃ってから focusId を反映
  useEffect(() => {
    if (!focusId || didApplyRef.current) return;
    const target = places.find((p) => p.id === focusId);
    if (!target) return;
    didApplyRef.current = true;
    setFlyTo({ lat: target.lat, lng: target.lng, zoom: 15 });
    if (wantOpen) setSelectedId(target.id);
    router.replace("/", { scroll: false });
  }, [focusId, wantOpen, places, router]);

  // 起動時ロード：places & photos
  useEffect(() => {
    (async () => {
      try {
        const { data: ses } = await supabase.auth.getSession();
        if (!ses.session) return;
        const mySpace = await ensureMySpace();
        if (!mySpace?.id) return;

        const { data: ps } = await supabase
          .from("places")
          .select("id, title, memo, lat, lng, visibility")
          .eq("space_id", mySpace.id)
          .order("created_at", { ascending: false });

        const ids = (ps ?? []).map((p) => p.id);
        let photosBy: Record<string, string[]> = {};
        if (ids.length > 0) {
          const { data: phs } = await supabase
            .from("photos")
            .select("place_id, file_url")
            .in("place_id", ids);
          for (const ph of phs ?? []) {
            const k = (ph as any).place_id as string;
            const u = (ph as any).file_url as string;
            (photosBy[k] ||= []).push(u);
          }
        }

        setPlaces(
          (ps ?? []).map((p) => ({
            id: p.id,
            name: p.title,
            memo: p.memo ?? undefined,
            lat: p.lat,
            lng: p.lng,
            photos: photosBy[p.id] ?? [],
            visibility: (p as any).visibility ?? "private",
          }))
        );
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // モーダルを開く前にビューを保持
  const openModalAt = (p: { lat: number; lng: number }) => {
    const snap = getViewRef.current();
    setInitialView(snap);
    setNewAt(p);
    setSelectedId(null);
    setTimeout(() => setViewRef.current(snap), 0);
  };

  const selected = useMemo(
    () => places.find((x) => x.id === selectedId) || null,
    [places, selectedId]
  );

   return (
    <>
      {/* 右上トグル（private 側） */}
      <div
        style={{
          position: "fixed",
          top: "calc(env(safe-area-inset-top, 0px) + 10px)",
          right: "max(12px, env(safe-area-inset-right, 0px))",
          zIndex: 11000,
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "inline-flex",
            borderRadius: 999,
            border: "1px solid #d1d5db",
            overflow: "hidden",
            background: "#fff",
            fontSize: 12,
          }}
        >
          {/* Private 側（ここではON） */}
          <button
            type="button"
            style={{
              padding: "6px 10px",
              border: "none",
              background: "#0f172a",
              color: "#fff",
              cursor: "default",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontWeight: 700,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "999px",
                background: "#22c55e",
              }}
            />
            Private
          </button>

          {/* Public 側（ここではOFF） */}
          <button
            type="button"
            onClick={() => router.push("/public")}
            style={{
              padding: "6px 10px",
              border: "none",
              background: "#fff",
              color: "#6b7280",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "999px",
                border: "1px solid #9ca3af",
              }}
            />
            Public
          </button>
        </div>
      </div>

      {/* 🔍 検索（左寄せ・小さめ・ノッチ対応） */}
      <div
        style={{
          position: "fixed",
          top: "calc(env(safe-area-inset-top, 0px) + 56px)",
          left: "max(12px, env(safe-area-inset-left, 0px))",
          zIndex: 10000,
          pointerEvents: "auto",
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <div style={{ width: "clamp(220px, 60vw, 340px)" }}>
          <div style={{ position: "relative" }}>
            <SearchBox
  places={places}
  onPickPost={(p) => {
    setCreateMode(false); // ←投稿選んだときは作成モード解除
    setFlyTo({ lat: p.lat, lng: p.lng, zoom: p.zoom ?? 15 });
    // もし投稿詳細を開くならここで router.push 等
  }}
  onPickLocation={(p) => {
    setCreateMode(true);  // ←場所を選んだら作成モードON
    setFlyTo({ lat: p.lat, lng: p.lng, zoom: p.zoom ?? 16 });
    // ここでは投稿画面は開かない（地図で微調整させる）
  }}
/>
          </div>
        </div>
      </div>

      {/* ハンバーガーメニュー */}
      <div
        style={{
          position: "fixed",
          top: "calc(env(safe-area-inset-top, 0px) + 52px)",
          right: "max(12px, env(safe-area-inset-right, 0px))",
          zIndex: 11000,
        }}
        onClick={() => setMenuOpen(true)}
      >
        <button
          type="button"
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: "#fff",
            border: "1px solid #ddd",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
          }}
        >
          ≡
        </button>
      </div>

      {/* スライドメニュー */}
      {menuOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            width: "70vw",
            maxWidth: 300,
            height: "100vh",
            background: "#ffffff",
            zIndex: 20000,
            boxShadow: "-4px 0 12px rgba(0,0,0,0.15)",
            padding: "calc(env(safe-area-inset-top, 0px) + 12px) 16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <button
            onClick={() => setMenuOpen(false)}
            style={{
              width: "100%",
              textAlign: "right",
              fontSize: 22,
              border: "none",
              background: "none",
              cursor: "pointer",
              marginBottom: 10,
            }}
          >
            ×
          </button>

          <MenuButton label="みんなの投稿" onClick={() => router.push("/community")} />
          <MenuButton label="投稿履歴" onClick={() => router.push("/history")} />
          <MenuButton label="有料プラン" onClick={() => router.push("/plans")} />
          <MenuButton label="AI 旅行プラン" onClick={() => router.push("/ai-trip")} />
          <MenuButton label="シェアする" onClick={() => router.push("/share")} />
          <MenuButton label="撮りたいリスト" onClick={() => router.push("/list")} />
          <MenuButton label="アカウント設定" onClick={() => router.push("/account")} />
          <MenuButton label="このアプリについて" onClick={() => router.push("/about")} />
          <MenuButton
            label="ログアウト"
            onClick={async () => {
              await supabase.auth.signOut();
              router.push("/login");
            }}
          />
        </div>
      )}


      {/* 🗺 マップ（1つだけ） */}
     <MapView
  places={mergedPlaces}
  onRequestNew={openModalAt}
  mode="private"
  onSelect={(p) => {
    setSelectedId(p.id);
  }}
  selectedId={selectedId}
  flyTo={flyTo}
  bindGetView={(fn) => {
    getViewRef.current = fn;
  }}
  bindSetView={(fn) => {
    setViewRef.current = fn;
  }}
  initialView={initialView}
  createMode={createMode}
        showCenterMarker={true}
  onCenterChange={(c) => setMapCenter(c)}
/>




      {/* ➕ 投稿フローティングボタン */}
      <button
        onClick={() => {
  if (!mapCenter) return;
  openModalAt({ lat: mapCenter.lat, lng: mapCenter.lng });
}}
        style={{
          position: "fixed",
          right: 20,
          bottom: 90,
          zIndex: 10000,
          background: "#000",
          color: "#fff",
          borderRadius: 999,
          padding: "12px 16px",
          boxShadow: "0 8px 24px rgba(0,0,0,.25)",
          cursor: "pointer",
        }}
      >
        📷この場所で投稿
      </button>

      {/* 下プレビュー（タイトル→メモ→写真） */}
      {selected && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: 10,
            width: "min(980px, 96vw)",
            maxHeight: "72vh",
            background: "rgba(255,255,255,0.98)",
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            boxShadow: "0 18px 50px rgba(0,0,0,.25)",
            zIndex: 9000,
            padding: 12,
            pointerEvents: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontWeight: 900,
                fontSize: 18,
                lineHeight: 1.2,
                maxWidth: "90%",
                margin: "0 auto",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                letterSpacing: "0.02em",
              }}
              title={selected.name || "無題"}
            >
              {selected.name || "無題"}
            </div>
          </div>

          <button
            onClick={() => setSelectedId(null)}
            style={{
              position: "absolute",
              top: 10,
              left: 12,
              border: "1px solid #ddd",
              background: "#fff",
              borderRadius: 8,
              padding: "6px 10px",
              cursor: "pointer",
            }}
            aria-label="閉じる"
          >
            ×
          </button>

          <button
            onClick={() => setEditOpen(true)}
            style={{
              position: "absolute",
              top: 10,
              right: 12,
              border: "1px solid #111827",
              background: "#111827",
              color: "#fff",
              borderRadius: 8,
              padding: "6px 10px",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            編集
          </button>

          <div
            style={{
              fontSize: 13,
              color: "#374151",
              lineHeight: 1.5,
              maxHeight: "16vh",
              overflow: "auto",
            }}
          >
            {selected.memo || "（メモなし）"}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 8,
              overflowY: "auto",
              flex: 1,
            }}
          >
            {(selected.photos ?? []).length === 0 && (
              <div style={{ fontSize: 12, color: "#9ca3af" }}>写真はまだありません</div>
            )}
            {(selected.photos ?? []).map((u) => (
              <img
                key={u}
                src={u}
                loading="lazy"
                style={{
                  width: "100%",
                  height: "24vh",
                  objectFit: "cover",
                  borderRadius: 10,
                  border: "1px solid #eee",
                }}
                alt=""
              />
            ))}
          </div>
        </div>
      )}

      {/* 📝 投稿モーダル：newAt がある時だけ表示 */}
      {newAt && (
        <PostModal
          open={true}
          place={{ lat: newAt.lat, lng: newAt.lng }}
          presetTitle={newAt.mode === "pilgrimage" ? (newAt.presetTitle ?? "") : ""}   
          onClose={() => {
            setNewAt(null);
            const snap = initialView ?? getViewRef.current();
            setTimeout(() => setViewRef.current(snap), 0);
          }}
          onSubmit={async (d) => {

            const spotIdForSave = newAt.mode === "pilgrimage" ? (newAt.spotId ?? null) : null;

            try {
              const created = await insertPlace({
  clientRequestId: d.clientRequestId,
  lat: d.lat,
  lng: d.lng,

  // タイトルが空なら preset を強制採用（これで絶対入る）
  title: (d.title?.trim() || (newAt.presetTitle ?? "")).trim(),

  memo: d.memo,
  visitedAt: d.visitedAt,
  files: d.photos,
  visibility: d.visibility,

  spotId: spotIdForSave, // ←ここが城を塗るスイッチ
});

              // ✅ 投稿をローカルstateに追加（これが無いと “見えない” になる）
setPlaces((prev) => [
  {
    id: created.id,
    name: created.title ?? "無題",
    memo: created.memo ?? "",
    lat: created.lat,
    lng: created.lng,
    photos: created.photos ?? [],
    visibility: created.visibility ?? "private",
  },
  ...prev,
]);

// ✅ いま作った投稿をそのまま開く（= 自分で見える）
setSelectedId(created.id);
setFlyTo({ lat: created.lat, lng: created.lng, zoom: 15 });


              

              if (newAt.mode === "pilgrimage" && newAt.slug && newAt.spotId) {
  const layerId = `layer:${newAt.slug}:${newAt.spotId}`;
  setLayerPlacesBySlug((prev) => {
    const arr = prev[newAt.slug!] ?? [];
    const next = arr.map((x) =>
      x.id === layerId ? { ...x, visitedByMe: true, name: `🏯 ${cleanPilgrimageTitle(x.name)}（済）`, memo: "visited" } : x
    );
    return { ...prev, [newAt.slug!]: next };
  });
}


              setPlaces((prev) => [
                {
                  id: created.id,
                  name: created.title ?? "新規",
                  memo: created.memo ?? undefined,
                  lat: created.lat,
                  lng: created.lng,
                  photos: created.photos ?? [],
                  visibility: created.visibility ?? "private",
                },
                ...prev,
              ]);

              setNewAt(null);
              const snap = initialView ?? getViewRef.current();
              setTimeout(() => setViewRef.current(snap), 0);
            } catch (e: any) {
              alert(`保存に失敗しました: ${e?.message ?? e}`);
              console.error(e);
            }
          }}
        />
      )}

      {/* ✏️ 編集モーダル */}
      {selected && (
        <EditModal
          open={editOpen}
          place={{ id: selected.id, title: selected.name ?? "", memo: selected.memo ?? "" }}
          onClose={() => setEditOpen(false)}
          onSaved={({ title, memo, addPhotos }) => {
            setPlaces((prev) =>
              prev.map((p) =>
                p.id === selected.id
                  ? {
                      ...p,
                      name: title ?? p.name,
                      memo: memo ?? p.memo,
                    }
                  : p
              )
            );
          }}
          onDeleted={() => {
            setPlaces((prev) => prev.filter((p) => p.id !== selected.id));
            setSelectedId(null);
          }}
        />
      )}
    </>
  );
}

// 👇 Page のすぐ下にこれを置く（場所はここでOK）
function MenuButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        padding: "10px 14px",
        fontSize: 15,
        textAlign: "left",
        border: "1px solid #eee",
        borderRadius: 8,
        background: "#fafafa",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
