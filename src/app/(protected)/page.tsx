// src/app/page.tsx
"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Place as MapPlace } from "@/components/MapView";
import SearchBox from "@/components/SearchBox";
import { supabase } from "@/lib/supabaseClient";
import { ensureMySpace } from "@/lib/ensureMySpace";
import { useRouter } from "next/navigation";
import { uploadPlacePhotos, replacePlacePhotos, deletePlaceWithPhotos } from "@/lib/placePhotoManager";
import KebabMenu from "@/components/KebabMenu";
import { useSearchParams } from "next/navigation";
import PlaceGeocodeSearch from "@/components/PlaceGeocodeSearch";
import PhotoMapperSplash from "@/components/PhotoMapperSplash";
import InstallToHomeModal from "@/components/InstallToHomeModal";
import { parseExifFromFile } from "@/lib/exif";
import { AUTO_POST_FREE_DAILY_LIMIT, isAutoPostFreeForAll } from "@/lib/autoPostPolicy";
import { createBrowserSafeId } from "@/lib/browserSafeId";
import { isMissingSchemaError } from "@/lib/supabaseSchemaFallback";


const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });
const LS_LAYER_TOGGLE_VISIBLE = "tm_layer_toggle_visible";
const LS_ENABLED_LAYER_SLUGS = "tm_enabled_layer_slugs";


type View = { lat: number; lng: number; zoom: number };


type AutoExifDraft = {
  files: File[];
  chips: string[];
  hasGps: boolean;
  lat?: number;
  lng?: number;
  sourceName?: string;
  suggestedTitle?: string;
  takenAt?: string;
  cameraMake?: string;
  cameraModel?: string;
  fNumber?: number;
  exposureTime?: string;
  iso?: number;
  focalLength?: number;
};

const AUTO_POST_PHOTO_LIMIT = 2;
const AUTO_POST_PHOTO_LIMIT_MESSAGE = `この投稿では最大${AUTO_POST_PHOTO_LIMIT}枚までです。`;

function limitSelectedFiles(files: File[], maxFiles?: number) {
  if (!maxFiles || files.length <= maxFiles) {
    return { files, message: "" };
  }

  return {
    files: files.slice(0, maxFiles),
    message: `最大${maxFiles}枚まで選択できます。先頭${maxFiles}枚に調整しました。`,
  };
}

function formatTakenAt(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function buildExifChips(exif: Awaited<ReturnType<typeof parseExifFromFile>>) {
  const chips: string[] = [];

  if (exif.takenAt) chips.push("✅ 撮影日時を反映しました");
  if (typeof exif.lat === "number" && typeof exif.lng === "number") {
    chips.push("✅ 位置情報を反映しました");
  } else {
    chips.push("⚠️ 位置情報なし");
  }
  if (
    exif.make ||
    exif.model ||
    exif.fNumber ||
    exif.exposureTime ||
    exif.iso ||
    exif.focalLength
  ) {
    chips.push("✅ カメラ情報を反映しました");
  }

  return chips;
}

function exifToAutoDraft(file: File, exif: Awaited<ReturnType<typeof parseExifFromFile>>): AutoExifDraft {
  return {
    files: [file],
    chips: buildExifChips(exif),
    hasGps: !!exif.hasGps,
    lat: exif.lat,
    lng: exif.lng,
    sourceName: file.name,
    suggestedTitle: file.name.replace(/\.[^.]+$/, "").trim(),
    takenAt: exif.takenAt ? formatTakenAt(exif.takenAt) : undefined,
    cameraMake: exif.make,
    cameraModel: exif.model,
    fNumber: exif.fNumber,
    exposureTime: exif.exposureTime,
    iso: exif.iso,
    focalLength: exif.focalLength,
  };
}

/* ================== 投稿モーダル（新規作成・カメラ重視） ================== */
function PostModal({
  open,
  place,
  presetTitle,
  autoDraft,
  batchLabel,
  onClose,
  onSubmit,
}: {
  open: boolean;
  place: { lat: number; lng: number };
  presetTitle?: string;
  autoDraft?: AutoExifDraft | null;
  batchLabel?: string | null;
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
    takenAt?: string;
    cameraMake?: string;
    cameraModel?: string;
    fNumber?: number;
    exposureTime?: string;
    iso?: number;
    focalLength?: number;
    hasGps: boolean;
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
  const [autoChips, setAutoChips] = useState<string[]>([]);
  const [hasGps, setHasGps] = useState(false);
  const [takenAt, setTakenAt] = useState<string>("");
  const [cameraMake, setCameraMake] = useState("");
  const [photoMessage, setPhotoMessage] = useState("");
  const isAutoPostMode = Boolean(autoDraft);

  /* ---------- 投稿制御 ---------- */
  const [clientRequestId, setClientRequestId] = useState<string>(() =>
    createBrowserSafeId()
  );
  const creatingRef = useRef(false);
  const [saving, setSaving] = useState(false);

  // 開くたびリセット
  useEffect(() => {
    if (!open) return;

    setTitle((autoDraft?.suggestedTitle ?? presetTitle ?? "").trim());
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
    setAutoChips([]);
    setHasGps(false);
    setVisitedAt(todayYmd());
    setTakenAt("");
    setCameraMake("");
    setPhotoMessage("");

    if (autoDraft) {
      applyDraftToForm(autoDraft);
    }


    setClientRequestId(createBrowserSafeId());
    creatingRef.current = false;
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, place.lat, place.lng, presetTitle, autoDraft]);

  // プレビュー
  const previews = useMemo(
    () => files.map((f) => ({ url: URL.createObjectURL(f), name: f.name })),
    [files]
  );
  useEffect(() => {
    return () => previews.forEach((p) => URL.revokeObjectURL(p.url));
  }, [previews]);

  const applyDraftToForm = (draft: AutoExifDraft, nextFiles?: File[]) => {
    const limited = limitSelectedFiles(nextFiles ?? draft.files ?? [], isAutoPostMode ? AUTO_POST_PHOTO_LIMIT : undefined);
    setFiles(limited.files);
    setPhotoMessage(limited.message);
    setAutoChips(draft.chips ?? []);
    setHasGps(draft.hasGps);
    if (typeof draft.lat === "number" && typeof draft.lng === "number") {
      setLat(draft.lat);
      setLng(draft.lng);
    }
    if (draft.takenAt) {
      setVisitedAt(draft.takenAt.slice(0, 10));
      setTakenAt(draft.takenAt);
    }
    if (draft.cameraMake) setCameraMake(draft.cameraMake);
    if (draft.cameraModel) setCameraModel(draft.cameraModel);
    if (typeof draft.focalLength === "number") setFocalLength(`${draft.focalLength}mm`);
    if (typeof draft.fNumber === "number") setAperture(`f/${draft.fNumber.toFixed(1)}`);
    if (draft.exposureTime) setShutterSpeed(draft.exposureTime);
    if (typeof draft.iso === "number") setIso(String(draft.iso));
    if (
      draft.cameraMake ||
      draft.cameraModel ||
      draft.focalLength ||
      draft.fNumber ||
      draft.exposureTime ||
      draft.iso
    ) {
      setOpenMeta(true);
    }
    if (!title.trim() && draft.suggestedTitle) {
      setTitle(draft.suggestedTitle);
    }
  };

  const handleFilesChange = async (fileList: FileList | null) => {
    const limited = limitSelectedFiles(Array.from(fileList ?? []), isAutoPostMode ? AUTO_POST_PHOTO_LIMIT : undefined);
    const nextFiles = limited.files;
    setFiles(nextFiles);
    setPhotoMessage(limited.message);
    setAutoChips([]);
    setHasGps(false);
    setVisitedAt(todayYmd());
    setTakenAt("");
    setCameraMake("");
    setCameraModel("");
    setFocalLength("");
    setAperture("");
    setShutterSpeed("");
    setIso("");

    const firstFile = nextFiles[0];
    if (!firstFile) return;

    try {
      const exif = await parseExifFromFile(firstFile);
      const draft = exifToAutoDraft(firstFile, exif);
      applyDraftToForm(draft, nextFiles);
    } catch (error) {
      console.warn("EXIF自動入力に失敗しました", error);
    }
  };

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
    if (cameraMake.trim() || cameraModel.trim()) metaLines.push(`機種：${[cameraMake.trim(), cameraModel.trim()].filter(Boolean).join(" ")}`);
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
        takenAt: takenAt || undefined,
        cameraMake: cameraMake || undefined,
        cameraModel: cameraModel || undefined,
        fNumber: aperture ? Number(aperture.replace(/[^0-9.]/g, "")) || undefined : undefined,
        exposureTime: shutterSpeed || undefined,
        iso: iso ? Number(iso) || undefined : undefined,
        focalLength: focalLength ? Number(focalLength.replace(/[^0-9.]/g, "")) || undefined : undefined,
        hasGps,
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
  {batchLabel && (
    <div style={{ marginTop: 6, textAlign: "center", fontSize: 12, color: "#4b5563", fontWeight: 700 }}>
      {batchLabel}
    </div>
  )}
</div>

          {autoChips.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            {autoChips.map((chip) => (
              <span
                key={chip}
                style={{ border: "1px solid #e5e7eb", borderRadius: 999, padding: "4px 10px", fontSize: 12, background: "#f9fafb" }}
              >
                {chip}
              </span>
            ))}
          </div>
        )}


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
                写真を選択
              </span>
              <input
                type="file"
                accept="image/*,image/heic,image/heif"
                multiple
                onChange={(e) => void handleFilesChange(e.target.files)}
                style={{ display: "none" }}
              />
            </label>
          </div>

          {isAutoPostMode && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
              自動投稿では1投稿あたり最大{AUTO_POST_PHOTO_LIMIT}枚まで追加できます。
            </div>
          )}

          {photoMessage && (
            <div
              style={{
                marginTop: 8,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #fde68a",
                background: "#fffbeb",
                color: "#92400e",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {photoMessage}
            </div>
          )}

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

         {takenAt && (
          <div style={{ marginTop: 10, fontSize: 12, color: "#374151" }}>
            撮影日時: {new Date(takenAt).toLocaleString("ja-JP")}
          </div>
        )}

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

function WishlistModal({
  open,
  place,
  onClose,
  onSubmit,
}: {
  open: boolean;
  place: { lat: number; lng: number };
  onClose: () => void;
  onSubmit: (d: { title: string; memo: string; lat: number; lng: number; visibility: "private" }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setMemo("");
    setSaving(false);
  }, [open, place.lat, place.lng]);

  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,.45)", display: "grid", placeItems: "center" }} onMouseDown={onClose}>
      <div
        style={{
          width: "min(560px, 92vw)",
          maxHeight: "88vh",
          overflow: "auto",
          background: "#fff",
          borderRadius: 14,
          border: "1px solid #e5e7eb",
          padding: 14,
          boxShadow: "0 20px 50px rgba(0,0,0,.25)",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>⭐ 行きたい場所を記録</h2>
        <div style={{ marginTop: 10, fontSize: 12, color: "#475569" }}>写真なしで保存できます。タイトルとメモだけ入力してください。</div>
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#334155" }}>タイトル（必須）</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例: 次の旅行で行きたいカフェ" style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: "10px 12px" }} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#334155" }}>メモ</span>
            <textarea rows={4} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="気になった理由、行く時期、やりたいことなど" style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: "10px 12px", resize: "vertical" }} />
          </label>
        </div>
        <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", gap: 8 }}>
          <button onClick={onClose} disabled={saving} style={{ padding: "10px 12px", border: "1px solid #ddd", borderRadius: 10, background: "#fff", cursor: "pointer" }}>
            閉じる
          </button>
          <button
            onClick={async () => {
              if (!title.trim()) return;
              try {
                setSaving(true);
                await onSubmit({ title: title.trim(), memo: memo.trim(), lat: place.lat, lng: place.lng, visibility: "private" });
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving || !title.trim()}
            style={{ padding: "10px 14px", borderRadius: 10, background: "#111827", color: "#fff", fontWeight: 800, opacity: saving || !title.trim() ? 0.6 : 1, cursor: saving || !title.trim() ? "not-allowed" : "pointer" }}
          >
            {saving ? "保存中…" : "wishlist保存"}
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
  photoLimit,
  photoLimitLabel,
  onClose,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  place: { id: string; title: string; memo: string };
  photoLimit?: number;
  photoLimitLabel?: string;
  onClose: () => void;
  onSaved: (d: { title?: string; memo?: string; addPhotos?: File[] }) => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
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
  const [autoChips, setAutoChips] = useState<string[]>([]);
  const [hasGps, setHasGps] = useState(false);
  const [takenAt, setTakenAt] = useState<string>("");
  const [cameraMake, setCameraMake] = useState("");
  const [photoMessage, setPhotoMessage] = useState("");


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
    setPhotoMessage("");

    // できる範囲で復元（あなたの新規投稿のフォーマットに合わせる）
    const m = (place.memo ?? "").trim();
    if (m) {
      // 時間帯：朝/昼/夕/夜
      const tod = m.match(/時間帯：([^\n]+)/)?.[1]?.trim();
      if (tod === "朝") setTimeOfDay("morning");
      if (tod === "昼") setTimeOfDay("noon");
      if (tod === "夕") setTimeOfDay("evening");
      if (tod === "夜") setTimeOfDay("night");

       const metaMarker = "[撮影データ]";
      const metaMarkerIndex = m.indexOf(metaMarker);
      const before = metaMarkerIndex >= 0 ? m.slice(0, metaMarkerIndex) : m;
      const meta =
        metaMarkerIndex >= 0
          ? m.slice(metaMarkerIndex + metaMarker.length).replace(/^\s+/, "")
          : "";

      // 「時間帯：」行を除いた残りをひとことへ
      const hk = before
        .split("\n")
        .filter((line) => !line.startsWith("時間帯："))
        .join("\n")
        .trim();
      if (hk) setHitokoto(hk);

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
            写真を上書き（任意）
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
                写真を選択
              </span>
              <input
                type="file"
                accept="image/*,image/heic,image/heif"
                multiple
                onChange={(e) => {
                  const limited = limitSelectedFiles(Array.from(e.target.files ?? []), photoLimit);
                  setAddFiles(limited.files);
                  setPhotoMessage(limited.message);
                }}
                style={{ display: "none" }}
              />
            </label>
          </div>

          {photoLimit && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
              {photoLimitLabel ?? `この投稿では最大${photoLimit}枚まで上書きできます。`}
            </div>
          )}

          {photoMessage && (
            <div
              style={{
                marginTop: 8,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #fde68a",
                background: "#fffbeb",
                color: "#92400e",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {photoMessage}
            </div>
          )}

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
            onClick={async () => {
              try {
                setSaving(true);
                await onDeleted();
              } catch (error) {
                console.error(error);
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
            style={{
              padding: "8px 12px",
              border: "1px solid #ef4444",
              borderRadius: 8,
              background: "#fff",
              color: "#ef4444",
              fontWeight: 800,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "処理中…" : "削除"}
          </button>

          <button
            onClick={onClose}
            disabled={saving}
            style={{
              padding: "8px 12px",
              border: "1px solid #ddd",
              borderRadius: 8,
              background: "#fff",
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.6 : 1,
            }}
          >
            閉じる
          </button>

          <button
            onClick={async () => {
              try {
                setSaving(true);
                await onSaved({ title: title.trim(), memo: buildMemo(), addPhotos: addFiles });
              } catch (error) {
                console.error(error);
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving || title.trim().length === 0}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "#000",
              color: "#fff",
              fontWeight: 800,
              opacity: saving || title.trim().length === 0 ? 0.6 : 1,
              cursor: saving || title.trim().length === 0 ? "not-allowed" : "pointer",
            }}
            title={title.trim().length === 0 ? "タイトルは必須です" : ""}
          >
            {saving ? "保存中…" : "保存"}
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
  takenAt,
  cameraMake,
  cameraModel,
  fNumber,
  exposureTime,
  iso,
  focalLength,
  hasGps,
}: {
  clientRequestId: string;
  lat: number;
  lng: number;
  title?: string;
  memo?: string;
  visitedAt?: string;
  files: File[];
  visibility: "public" | "private" | "pair";
   spotId?: string | null;
  takenAt?: string;
  cameraMake?: string;
  cameraModel?: string;
  fNumber?: number;
  exposureTime?: string;
  iso?: number;
  focalLength?: number;
  hasGps?: boolean;
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
      status: (files?.length ?? 0) > 0 ? "visited" : "wishlist",
      taken_at: takenAt ?? null,
      camera_make: cameraMake ?? null,
      camera_model: cameraModel ?? null,
      f_number: fNumber ?? null,
      exposure_time: exposureTime ?? null,
      iso: iso ?? null,
      focal_length: focalLength ?? null,
      has_gps: !!hasGps,
    },
    { onConflict: "space_id,client_request_id" }
  )
  .select("id, title, memo, lat, lng, visibility, status, ai_summary, ai_tips, created_by_name, created_at")
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
  
   // 2) 写真（圧縮して保存）
  const urls = await uploadPlacePhotos({
    placeId: placeRow.id,
    spaceId: sp.id,
    files: files ?? [],
  });


  // ✅ ここが超重要：Page側が created.id を使うから、オブジェクトで返す
  return {
    id: placeRow.id,
    title: placeRow.title,
    memo: placeRow.memo,
    lat: placeRow.lat,
    lng: placeRow.lng,
    visibility: placeRow.visibility,
    status: (files?.length ?? 0) > 0 ? "visited" : "wishlist",
    ai_summary: (placeRow as any).ai_summary ?? null,
    ai_tips: (placeRow as any).ai_tips ?? null,
    created_by_name: placeRow.created_by_name,
    created_at: placeRow.created_at,
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
  const [wishlistMode, setWishlistMode] = useState(false);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [showInstallTip, setShowInstallTip] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [premiumLoaded, setPremiumLoaded] = useState(false);
  const [autoReading, setAutoReading] = useState(false);
  const [autoDraft, setAutoDraft] = useState<AutoExifDraft | null>(null);
  const [autoDraftQueue, setAutoDraftQueue] = useState<AutoExifDraft[]>([]);
  const [autoBatchTotal, setAutoBatchTotal] = useState(0);
  const autoFileRef = useRef<HTMLInputElement | null>(null);
  const autoPostFreeForAll = isAutoPostFreeForAll();

  const getTodayJST = () => {
  const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return jst.toISOString().slice(0, 10);
  };


    // ===== 巡礼レイヤー（将来対応・汎用） =====
  const LS_LAYER_TOGGLE_VISIBLE = "tm_layer_toggle_visible";
  const LS_ENABLED_LAYER_SLUGS = "tm_enabled_layer_slugs";
  const [layerErr, setLayerErr] = useState<string | null>(null);

  const [layerToggleVisible, setLayerToggleVisible] = useState(false);
  const [enabledLayerSlugs, setEnabledLayerSlugs] = useState<string[]>([]);
  const [layerPlacesBySlug, setLayerPlacesBySlug] = useState<Record<string, MapPlace[]>>({});

  const loadedSlugsRef = useRef<Set<string>>(new Set());
  const [booting, setBooting] = useState(true);
  const [categoryFeatureReady, setCategoryFeatureReady] = useState(true);

  const [newAt, setNewAt] = useState<{
  lat: number;
  lng: number;
  // 巡礼用（城タップ時だけ入る）
  mode?: "normal" | "pilgrimage";
  slug?: string | null;
  spotId?: string | null;
  presetTitle?: string | null;
} | null>(null);

  const autoBatchIndex = autoDraft ? autoBatchTotal - autoDraftQueue.length : 0;

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
      const { data: ses } = await supabase.auth.getSession();
      const uid = ses.session?.user.id;
      if (!uid) {
        setIsPremium(false);
        setPremiumLoaded(true);
        return;
      }
      const { data: prof } = await supabase
        .from("profiles")
        .select("is_premium")
        .eq("id", uid)
        .single();
      setIsPremium(!!prof?.is_premium);
      setPremiumLoaded(true);
    } catch {
      setIsPremium(false);
      setPremiumLoaded(true);
    }
  })();
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

  useEffect(() => {
  // すでに「今後表示しない」なら終了
  if (localStorage.getItem("pm_hide_install_tip") === "1") return;

  // PWA（ホーム画面起動）なら出さない
  const w = window as any;
  const standalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    w.navigator?.standalone === true;
  if (standalone) return;

  // ✅ webでログインしてprivateに来た人にだけ出す
  // （＝ここは protected なので、ログインしてる前提でOK）
  setShowInstallTip(true);
}, []);



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
  const categoryId = sp.get("category");
  const effectiveCategoryId = categoryFeatureReady ? categoryId : null;
  const showMarkerTitles = sp.get("titles") === "1";
  const didApplyRef = useRef(false);

  // ▼▼ ④ 地図に渡すplacesを合体（ここに追加） ▼▼
const mergedPlaces = useMemo(() => {
  const categoryFilteredPlaces = effectiveCategoryId
    ? places.filter((p: any) => (p.place_category_id ?? null) === effectiveCategoryId)
    : places;
  const layerPlaces = Object.values(layerPlacesBySlug).flat();
  return enabledLayerSlugs.length > 0
    ? [...categoryFilteredPlaces, ...layerPlaces]
    : categoryFilteredPlaces;
}, [places, layerPlacesBySlug, enabledLayerSlugs.length, effectiveCategoryId]);
  

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
      const uid = ses.session.user.id;

      const mySpace = await ensureMySpace();
      if (!mySpace?.id) return;

      let ps: any[] | null = null;
      const categorySelect = "id, title, memo, lat, lng, visibility, status, ai_summary, ai_tips, place_category_id";
      const baseSelect = "id, title, memo, lat, lng, visibility, status, ai_summary, ai_tips";
      const { data: placesWithCategory, error: placesError } = await supabase
        .from("places")
        .select(categorySelect)
        .eq("space_id", mySpace.id)
        .order("created_at", { ascending: false });
      if (placesError) {
        if (!isMissingSchemaError(placesError)) throw placesError;
        setCategoryFeatureReady(false);
        const { data: fallbackPlaces, error: fallbackError } = await supabase
          .from("places")
          .select(baseSelect)
          .eq("space_id", mySpace.id)
          .order("created_at", { ascending: false });
        if (fallbackError) throw fallbackError;
        ps = (fallbackPlaces ?? []).map((p) => ({ ...p, place_category_id: null }));
      } else {
        ps = placesWithCategory as any[];
      }

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

      const postPlaces = (ps ?? []).map((p) => ({
        id: p.id,
        name: p.title,
        memo: p.memo ?? undefined,
        lat: p.lat,
        lng: p.lng,
        photos: photosBy[p.id] ?? [],
        markerType: "place" as const,
        visibility: (p as any).visibility ?? "private",
        status: (p as any).status ?? ((photosBy[p.id] ?? []).length > 0 ? "visited" : "wishlist"),
        place_category_id: (p as any).place_category_id ?? null,
        ai_summary: (p as any).ai_summary ?? null,
        ai_tips: (p as any).ai_tips ?? null,
      }));
      setPlaces(postPlaces as any);
    } catch (e) {
      console.error(e);
} finally {
  setTimeout(() => setBooting(false), 1200);
}
  })();
}, []);

   // モーダルを開く前にビューを保持
  const openModalAt = (p: {
    lat: number;
    lng: number;
    mode?: "normal" | "pilgrimage";
    slug?: string | null;
    spotId?: string | null;
    presetTitle?: string | null;
  }) => {
    const snap = getViewRef.current();
    setInitialView(snap);
    if (!wishlistMode) {
      setAutoDraft(null);
      setAutoDraftQueue([]);
      setAutoBatchTotal(0);
    }
    setNewAt(p);
    setSelectedId(null);
    if (wishlistMode) {
      setAutoDraft(null);
      setAutoDraftQueue([]);
      setAutoBatchTotal(0);
    }
    setTimeout(() => setViewRef.current(snap), 0);
  };

  const resetAutoBatch = () => {
    setAutoDraft(null);
    setAutoDraftQueue([]);
    setAutoBatchTotal(0);
  };

  const getFallbackLocation = () => ({
    lat: mapCenter?.lat ?? 35.68,
    lng: mapCenter?.lng ?? 139.76,
  });

  const openAutoDraft = (draft: AutoExifDraft, rest: AutoExifDraft[], total: number, snap?: View) => {
    const baseView = snap ?? initialView ?? getViewRef.current();
    const fallback = getFallbackLocation();
    setInitialView(baseView);
    setAutoDraft(draft);
    setAutoDraftQueue(rest);
    setAutoBatchTotal(total);
    setNewAt({
      lat: draft.lat ?? fallback.lat,
      lng: draft.lng ?? fallback.lng,
      mode: "normal",
    });
    setSelectedId(null);
    setTimeout(() => setViewRef.current(baseView), 0);
  };

  const createAutoDraftFromFile = async (file: File): Promise<AutoExifDraft> => {
    const exif = await parseExifFromFile(file);
    return exifToAutoDraft(file, exif);
  };

 const onPickAutoPhoto = async (fileList: FileList | null) => {
 const MAX_AUTO_BATCH = 10;
  const pickedFiles = Array.from(fileList ?? []);
  if (pickedFiles.length > MAX_AUTO_BATCH) {
    alert(`自動投稿は1回につき最大${MAX_AUTO_BATCH}件までです。先頭${MAX_AUTO_BATCH}件を読み込みます。`);
  }
  const files = pickedFiles.slice(0, MAX_AUTO_BATCH);
  if (!files.length) return;

  // ✅ ログイン必須チェック（ファイル選択後なのでiOSでもOK）
  const { data: ses } = await supabase.auth.getSession();
  const uid = ses.session?.user.id;
  if (!uid) {
    alert("ログインが必要です");
    return;
  }

  let allowedFiles = files;

 if (!autoPostFreeForAll) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("is_premium, auto_post_count_today, auto_post_last_used")
      .eq("id", uid)
      .single();

   if (error || !profile) {
      alert("プロフィール取得に失敗しました");
      return;
    }

   if (!profile.is_premium) {
      const today = getTodayJST();
      const usedToday = profile.auto_post_last_used === today;
      const countToday = usedToday ? (profile.auto_post_count_today ?? 0) : 0;
      const remaining = Math.max(0, AUTO_POST_FREE_DAILY_LIMIT - countToday);

      if (remaining <= 0) {
        alert(`本日の無料自動投稿は${AUTO_POST_FREE_DAILY_LIMIT}回までです。プレミアムをご利用ください。`);
        router.push("/list");
        return;
      }

      if (allowedFiles.length > remaining) {
        allowedFiles = allowedFiles.slice(0, remaining);
        alert(`無料枠の都合で、今回の自動投稿は先頭${remaining}件だけ受け付けます。`);
      }
    }
  }

  setAutoReading(true);
  try {
    const drafts: AutoExifDraft[] = [];
    for (const file of allowedFiles) {
      drafts.push(await createAutoDraftFromFile(file));
    }

    if (!drafts.length) return;

    const snap = getViewRef.current();
    openAutoDraft(drafts[0], drafts.slice(1), drafts.length, snap);
  } catch (e) {
    console.error(e);
    alert("EXIFの読み取りに失敗しました。手動投稿に切り替えてください。");
  } finally {
    setAutoReading(false);
    if (autoFileRef.current) autoFileRef.current.value = "";
  }
};

  const selected = useMemo(
  () => places.find((x) => x.id === selectedId) || null,
  [places, selectedId]
);
  const selectedIsTripStop = selected && (selected as any).markerType === "trip_plan_stop";

  return (
    <>
      {booting && <PhotoMapperSplash />}

      {showInstallTip && (
        <InstallToHomeModal
          open={showInstallTip}
          onClose={() => setShowInstallTip(false)}
          onNever={() => {
            localStorage.setItem("pm_hide_install_tip", "1");
            setShowInstallTip(false);
          }}
        />
      )}
      
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
    setWishlistMode(false);
    setFlyTo({ lat: p.lat, lng: p.lng, zoom: p.zoom ?? 15 });
  }}
  onPickLocation={(p) => {
    setWishlistMode(false);
    setFlyTo({ lat: p.lat, lng: p.lng, zoom: p.zoom ?? 16 });
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
          <MenuButton label="行きたい場所リスト" onClick={() => router.push("/list")} />
          <MenuButton label="シェアする" onClick={() => router.push("/share")} />
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
  showCenterMarker={true}
  showMarkerTitles={showMarkerTitles}
  onCenterChange={(c) => setMapCenter(c)}
/>

 <input
        ref={autoFileRef}
        type="file"
        accept="image/*,image/heic,image/heif"
        multiple
        style={{ display: "none" }}
        onChange={(e) => void onPickAutoPhoto(e.target.files)}
      />

       {/* 📷 思い出写真を投稿 */}
      <button
      onClick={() => {
  if (autoReading) return;
  // ✅ iOS対策：まず同期で開く（await禁止）
  autoFileRef.current?.click();
}}


        disabled={(!autoPostFreeForAll && !premiumLoaded) || autoReading}
        style={{
          position: "fixed",
          right: 20,
          bottom: 146,
          zIndex: 10000,
           background: autoPostFreeForAll || isPremium ? "#7c3aed" : "#9ca3af",
          color: "#fff",
          borderRadius: 999,
          padding: "10px 14px",
          boxShadow: "0 8px 24px rgba(0,0,0,.25)",
          cursor: (!autoPostFreeForAll && !premiumLoaded) || autoReading ? "not-allowed" : "pointer",
          border: "none",
          fontWeight: 700,
           opacity: (!autoPostFreeForAll && !premiumLoaded) || autoReading ? 0.7 : 1,
        }}
        title="写真から最大10件まで順番に投稿できます"
      >
        {autoReading ? "読み取り中…" : "📷 思い出投稿"}
      </button>


      {/* ➕ 行きたい場所を記録 */}
      <button
        onClick={() => {
          setWishlistMode((prev) => !prev);
        }}
        style={{
          position: "fixed",
          right: 20,
          bottom: 90,
          zIndex: 10000,
          background: wishlistMode ? "#f59e0b" : "#000",
          color: wishlistMode ? "#111827" : "#fff",
          borderRadius: 999,
          padding: "12px 16px",
          boxShadow: "0 8px 24px rgba(0,0,0,.25)",
          cursor: "pointer",
        }}
      >
        {wishlistMode ? "⭐ 行きたい記録中（地図をダブルタップ）" : "⭐ 行きたい記録"}
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

          {!selectedIsTripStop ? (
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
          ) : null}

          <div
            style={{
              fontSize: 13,
              color: "#374151",
              lineHeight: 1.5,
              maxHeight: "16vh",
              overflow: "auto",
            }}
          >
            {selectedIsTripStop
              ? `${(selected as any).dayNumber}日目 ${(selected as any).startTime ?? "--:--"} / ${(selected as any).category ?? "カテゴリ未設定"}\n${selected.memo || "（メモなし）"}\n所属しおり: ${(selected as any).tripPlanTitle ?? "-"}`
              : (selected.memo || "（メモなし）")}
          </div>

          {!selectedIsTripStop && (selected as any).ai_summary ? (
            <div style={{ fontSize: 12, color: "#1f2937", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 8 }}>
              <strong>この場所の魅力（AI補助）</strong>
              <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{(selected as any).ai_summary}</div>
            </div>
          ) : null}
          {!selectedIsTripStop && (selected as any).ai_tips ? (
            <div style={{ fontSize: 12, color: "#1f2937", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 8 }}>
              <strong>おすすめの楽しみ方（AI補助）</strong>
              <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{(selected as any).ai_tips}</div>
            </div>
          ) : null}

          {!selectedIsTripStop ? <div
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
          </div> : null}
        </div>
      )}

{/* 📝 投稿モーダル */}
      {newAt && (wishlistMode ? (
        <WishlistModal
          open={true}
          place={{ lat: newAt.lat, lng: newAt.lng }}
          onClose={() => {
            setNewAt(null);
            setWishlistMode(false);
            const snap = initialView ?? getViewRef.current();
            setTimeout(() => setViewRef.current(snap), 0);
          }}
          onSubmit={async (d) => {
            try {
              const created = await insertPlace({
                clientRequestId: createBrowserSafeId(),
                lat: d.lat,
                lng: d.lng,
                title: d.title,
                memo: d.memo,
                files: [],
                visibility: "private",
                hasGps: true,
              });

              setPlaces((prev) => [
                {
                  id: created.id,
                  name: created.title ?? "無題",
                  memo: created.memo ?? "",
                  lat: created.lat,
                  lng: created.lng,
                  photos: [],
                  visibility: "private",
                  status: "wishlist",
                  ai_summary: (created as any).ai_summary ?? null,
                  ai_tips: (created as any).ai_tips ?? null,
                },
                ...prev,
              ]);
              setSelectedId(created.id);
              setFlyTo({ lat: created.lat, lng: created.lng, zoom: 15 });
              setNewAt(null);
              setWishlistMode(false);
            } catch (e: any) {
              alert(`wishlist保存に失敗しました: ${e?.message ?? e}`);
              console.error(e);
            }
          }}
        />
      ) : (
        <PostModal
          open={true}
          place={{ lat: newAt.lat, lng: newAt.lng }}
          presetTitle={newAt.mode === "pilgrimage" ? (newAt.presetTitle ?? "") : ""}
          autoDraft={autoDraft}
          batchLabel={autoBatchTotal > 1 ? `自動投稿 ${autoBatchIndex}/${autoBatchTotal}` : null}
          onClose={() => {
            setNewAt(null);
            resetAutoBatch();
            const snap = initialView ?? getViewRef.current();
            setTimeout(() => setViewRef.current(snap), 0);
          }}
          onSubmit={async (d) => {
            const spotIdForSave = newAt.mode === "pilgrimage" ? (newAt.spotId ?? null) : null;

            if (!d.hasGps) {
              const ok = window.confirm(
                "この写真には位置情報がありません。\n\n📍 地図上のピンを合わせましたか？\nそのまま投稿しますか？"
              );
              if (!ok) return;
            }

            try {
              const created = await insertPlace({
                clientRequestId: d.clientRequestId,
                lat: d.lat,
                lng: d.lng,
                title: (d.title?.trim() || (newAt.presetTitle ?? "")).trim(),
                memo: d.memo,
                visitedAt: d.visitedAt,
                files: d.photos,
                visibility: d.visibility,
                takenAt: d.takenAt,
                cameraMake: d.cameraMake,
                cameraModel: d.cameraModel,
                fNumber: d.fNumber,
                exposureTime: d.exposureTime,
                iso: d.iso,
                focalLength: d.focalLength,
                hasGps: d.hasGps,
                spotId: spotIdForSave,
              });

   if (!autoPostFreeForAll) {
                try {
                  const { data: ses2 } = await supabase.auth.getSession();
                  const uid2 = ses2.session?.user.id;

                  if (uid2 && autoDraft) {
                    const { data: p, error: pe } = await supabase
                      .from("profiles")
                      .select("is_premium, auto_post_count_today, auto_post_last_used")
                      .eq("id", uid2)
                      .single();

                    if (!pe && p && !p.is_premium) {
                      const today = getTodayJST();
                      const usedToday = p.auto_post_last_used === today;
                      const countToday = usedToday ? (p.auto_post_count_today ?? 0) : 0;

                      if (usedToday) {
                        await supabase
                          .from("profiles")
                          .update({ auto_post_count_today: countToday + 1 })
                          .eq("id", uid2);
                      } else {
                        await supabase
                          .from("profiles")
                          .update({ auto_post_count_today: 1, auto_post_last_used: today })
                          .eq("id", uid2);
                      }
                    }
                  }
                } catch (e) {
                  console.warn("auto-post count update failed", e);
                }
              }

              // ローカル状態の更新
              setPlaces((prev) => [
                {
                  id: created.id,
                  name: created.title ?? "無題",
                  memo: created.memo ?? "",
                  lat: created.lat,
                  lng: created.lng,
                  photos: created.photos ?? [],
                  visibility: created.visibility ?? "private",
                  status: (created as any).status ?? ((created.photos?.length ?? 0) > 0 ? "visited" : "wishlist"),
                  ai_summary: (created as any).ai_summary ?? null,
                  ai_tips: (created as any).ai_tips ?? null,
                },
                ...prev,
              ]);

              // 巡礼モードの更新
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

              setSelectedId(created.id);
              setFlyTo({ lat: created.lat, lng: created.lng, zoom: 15 });
              if (autoDraftQueue.length > 0) {
                openAutoDraft(autoDraftQueue[0], autoDraftQueue.slice(1), autoBatchTotal);
              } else {
                setNewAt(null);
                resetAutoBatch();
                const snap = initialView ?? getViewRef.current();
                setTimeout(() => setViewRef.current(snap), 0);
              }
            } catch (e: any) {
              alert(`保存に失敗しました: ${e?.message ?? e}`);
              console.error(e);
            }
          }} 
        />
      ))}

      {/* ✏️ 編集モーダル */}
      {selected && !selectedIsTripStop && (
        <EditModal
          open={editOpen}
          place={{ id: selected.id, title: selected.name ?? "", memo: selected.memo ?? "" }}
          photoLimit={AUTO_POST_PHOTO_LIMIT}
          photoLimitLabel={AUTO_POST_PHOTO_LIMIT_MESSAGE}
          onClose={() => setEditOpen(false)}
          onSaved={async ({ title, memo, addPhotos }) => {
            try {
              const { data: placeRow, error: placeFetchError } = await supabase
                .from("places")
                .select("id, space_id")
                .eq("id", selected.id)
                .single();

              if (placeFetchError) throw placeFetchError;

              const { error: updateError } = await supabase
                .from("places")
                .update({
                  title: title ?? selected.name ?? null,
                  memo: memo ?? selected.memo ?? null,
                })
                .eq("id", selected.id);

              if (updateError) throw updateError;

              let newPhotos = selected.photos ?? [];
              let nextStatus = (selected as any).status ?? ((selected.photos?.length ?? 0) > 0 ? "visited" : "wishlist");

              if ((addPhotos?.length ?? 0) > 0) {
                newPhotos = await replacePlacePhotos({
                  placeId: selected.id,
                  spaceId: placeRow.space_id,
                  files: addPhotos ?? [],
                });
                nextStatus = "visited";
                const { error: statusError } = await supabase
                  .from("places")
                  .update({ status: "visited" })
                  .eq("id", selected.id);
                if (statusError) throw statusError;
              }

              setPlaces((prev) =>
                prev.map((p) =>
                  p.id === selected.id
                    ? {
                        ...p,
                        name: title ?? p.name,
                        memo: memo ?? p.memo,
                        photos: newPhotos,
                        status: nextStatus,
                      }
                    : p
                )
              );

              setEditOpen(false);
            } catch (e: any) {
              console.error(e);
              alert(`更新に失敗しました: ${e?.message ?? e}`);
              throw e;
            }
          }}
          onDeleted={async () => {
            const ok = window.confirm(`この投稿を削除しますか？
画像もストレージから削除されます。`);
            if (!ok) return;

            try {
              await deletePlaceWithPhotos(selected.id);
              setPlaces((prev) => prev.filter((p) => p.id !== selected.id));
              setSelectedId(null);
              setEditOpen(false);
            } catch (e: any) {
              console.error(e);
              alert(`削除に失敗しました: ${e?.message ?? e}`);
              throw e;
            }
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
