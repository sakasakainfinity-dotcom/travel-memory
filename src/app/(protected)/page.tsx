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

/* ================== 投稿モーダル（新規作成） ================== */
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
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [visitedAt, setVisitedAt] = useState<string>(() => {
    const d = new Date();
    const z = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  });

  const [lat, setLat] = useState(place.lat);
  const [lng, setLng] = useState(place.lng);
  const [files, setFiles] = useState<File[]>([]);
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const canSave = title.trim().length > 0 && files.length > 0;
  const [timeOfDay, setTimeOfDay] = useState<"" | "morning" | "noon" | "evening" | "night">("");
  const [cameraModel, setCameraModel] = useState("");
const [focalLength, setFocalLength] = useState("");
const [aperture, setAperture] = useState("");
const [shutterSpeed, setShutterSpeed] = useState("");
const [iso, setIso] = useState("");
const [shootMemo, setShootMemo] = useState("");
const [openMeta, setOpenMeta] = useState(false);




  


  // ★ 投稿の「リクエスト番号」（開くたび新規発行）
  const [clientRequestId, setClientRequestId] = useState<string>(() =>
    crypto.randomUUID()
  );

  // ★ 二重実行ガード + ボタン無効化
  const creatingRef = useRef(false);
  const [saving, setSaving] = useState(false);

 
  // 開くたび完全リセット + requestId も更新
  useEffect(() => {
  if (!open) return;

  // ここが肝：最初からタイトルを入れる
  setTitle((presetTitle ?? "").trim());

  // もし「毎回リセット」してるなら、そのまま
  setMemo("");
  setAddress("");
  const d = new Date();
  const z = (n: number) => String(n).padStart(2, "0");
  setVisitedAt(`${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`);

  setLat(place.lat);
  setLng(place.lng);
  setFiles([]);
  setVisibility("private");

  setClientRequestId(crypto.randomUUID());
  creatingRef.current = false;
  setSaving(false);
}, [open, place.lat, place.lng, presetTitle]);


  const previews = useMemo(
    () => files.map((f) => ({ url: URL.createObjectURL(f), name: f.name })),
    [files]
  );
  useEffect(() => {
    return () => previews.forEach((p) => URL.revokeObjectURL(p.url));
  }, [previews]);

  async function submit() {
    // ★二重実行ガード
    if (creatingRef.current) return;
    creatingRef.current = true;
    setSaving(true);

    try {
      await onSubmit({
        clientRequestId,
        title: title.trim(),
        memo,
        address: address.trim() || undefined,
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
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>
          投稿
        </div>

        <div style={{ marginTop: 10 }}>
  <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 6 }}>
    時間帯（任意）
  </label>
  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
    {[
      { key: "morning", label: "朝" },
      { key: "noon", label: "昼" },
      { key: "evening", label: "夕" },
      { key: "night", label: "夜" },
    ].map((x) => {
      const active = timeOfDay === x.key;
      return (
        <button
          key={x.key}
          type="button"
          onClick={() => setTimeOfDay(active ? "" : (x.key as any))}
          style={{
            padding: "8px 12px",
            borderRadius: 999,
            border: active ? "2px solid #111827" : "1px solid #d1d5db",
            background: active ? "rgba(17,24,39,0.12)" : "#fff",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {x.label}
        </button>
      );
    })}
  </div>
</div>


        
    

        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12, color: "#555" }}>タイトル</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例：〇〇食堂"
            style={{
              width: "100%",
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: "8px 10px",
            }}
          />
        </div>

       

        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12, color: "#555" }}>訪問日</label>
          <input
            type="date"
            value={visitedAt}
            onChange={(e) => setVisitedAt(e.target.value)}
            style={{
              width: "100%",
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: "8px 10px",
            }}
          />
        </div>

        {/* 公開範囲（ボタンスタイル） */}
        <div style={{ marginTop: 10 }}>
          <label
            style={{
              fontSize: 12,
              color: "#555",
              display: "block",
              marginBottom: 4,
            }}
          >
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
                    border: active
                      ? `2px solid ${opt.color}`
                      : "1px solid #d1d5db",
                    background: active ? `${opt.color}22` : "#fff",
                    color: "#111827",
                    fontSize: 12,
                    cursor: "pointer",
                    minWidth: 120,
                  }}
                >
                  <span
                    style={{
                      fontWeight: 800,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "999px",
                        backgroundColor: opt.color,
                      }}
                    />
                    {opt.label}
                  </span>
                  <span style={{ fontSize: 11, color: "#6b7280" }}>
                    {opt.sub}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12, color: "#555" }}>一言（任意）</label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            style={{
              width: "100%",
              height: 80,
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: "8px 10px",
            }}
          />
        </div>

        {/* 写真（複数可） */}
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12, color: "#555" }}>写真（複数可）</label>
          <label style={{ display: "inline-block", marginTop: 6 }}>
            <span
              style={{
                display: "inline-block",
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "#fff",
                cursor: "pointer",
                fontWeight: 700,
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

          await onSubmit({
  clientRequestId,
  title: title.trim(),
  memo,                 // ひとこと
  visitedAt,
  lat,
  lng,
  photos: files,
  visibility,

  // 追加（任意）
  timeOfDay: timeOfDay || undefined,
  cameraModel: cameraModel.trim() || undefined,
  focalLength: focalLength.trim() || undefined,
  aperture: aperture.trim() || undefined,
  shutterSpeed: shutterSpeed.trim() || undefined,
  iso: iso.trim() || undefined,
  shootMemo: shootMemo.trim() || undefined,
});


          {previews.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: 8,
                marginTop: 8,
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
                    style={{
                      width: "100%",
                      height: 120,
                      objectFit: "cover",
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 14,
          }}
        >
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
            disabled={saving || !canSave}>
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "#000",
              color: "#fff",
              fontWeight: 700,
              opacity: saving ? 0.7 : 1,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}


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
    memo?: string;
    timeOfDay?: "morning" | "noon" | "evening" | "night";
    lat: number;
    lng: number;
    photos: File[];
    visibility: "public" | "private";

    // 撮影データ（任意）
    cameraModel?: string;
    focalLength?: string;
    aperture?: string;
    shutterSpeed?: string;
    iso?: string;
    shootMemo?: string;
  }) => Promise<void>;
}) {
  /* ---------- 基本 ---------- */
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [timeOfDay, setTimeOfDay] = useState<
    "" | "morning" | "noon" | "evening" | "night"
  >("");
  const [files, setFiles] = useState<File[]>([]);
  const [visibility, setVisibility] = useState<"public" | "private">("private");

  const [lat, setLat] = useState(place.lat);
  const [lng, setLng] = useState(place.lng);

  /* ---------- 撮影データ（折りたたみ） ---------- */
  const [openMeta, setOpenMeta] = useState(false);
  const [cameraModel, setCameraModel] = useState("");
  const [focalLength, setFocalLength] = useState("");
  const [aperture, setAperture] = useState("");
  const [shutterSpeed, setShutterSpeed] = useState("");
  const [iso, setIso] = useState("");
  const [shootMemo, setShootMemo] = useState("");

  /* ---------- 制御 ---------- */
  const [clientRequestId, setClientRequestId] = useState(() =>
    crypto.randomUUID()
  );
  const creatingRef = useRef(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle((presetTitle ?? "").trim());
    setMemo("");
    setTimeOfDay("");
    setFiles([]);
    setVisibility("private");
    setLat(place.lat);
    setLng(place.lng);

    setCameraModel("");
    setFocalLength("");
    setAperture("");
    setShutterSpeed("");
    setIso("");
    setShootMemo("");

    setClientRequestId(crypto.randomUUID());
    creatingRef.current = false;
    setSaving(false);
  }, [open, place.lat, place.lng, presetTitle]);

  const previews = useMemo(
    () => files.map((f) => ({ url: URL.createObjectURL(f), name: f.name })),
    [files]
  );
  useEffect(
    () => () => previews.forEach((p) => URL.revokeObjectURL(p.url)),
    [previews]
  );

  const canSave = title.trim().length > 0 && files.length > 0;

  async function submit() {
    if (creatingRef.current || !canSave) return;
    creatingRef.current = true;
    setSaving(true);
    try {
      await onSubmit({
        clientRequestId,
        title: title.trim(),
        memo: memo.trim() || undefined,
        timeOfDay: timeOfDay || undefined,
        lat,
        lng,
        photos: files,
        visibility,

        cameraModel: cameraModel.trim() || undefined,
        focalLength: focalLength.trim() || undefined,
        aperture: aperture.trim() || undefined,
        shutterSpeed: shutterSpeed.trim() || undefined,
        iso: iso.trim() || undefined,
        shootMemo: shootMemo.trim() || undefined,
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
          width: "min(820px, 92vw)",
          maxHeight: "86vh",
          overflow: "auto",
          background: "#fff",
          borderRadius: 14,
          padding: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,.35)",
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 12 }}>
          📷 新しい投稿
        </div>

        {/* 写真 */}
        <label style={{ fontSize: 12, fontWeight: 700 }}>写真（必須）</label>
        <label style={{ display: "inline-block", marginTop: 6 }}>
          <span
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            写真を追加
          </span>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            style={{ display: "none" }}
          />
        </label>

        {previews.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: 8,
              marginTop: 8,
            }}
          >
            {previews.map((p) => (
              <img
                key={p.url}
                src={p.url}
                style={{
                  width: "100%",
                  height: 120,
                  objectFit: "cover",
                  borderRadius: 10,
                }}
              />
            ))}
          </div>
        )}

        {/* タイトル */}
        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 700 }}>タイトル（必須）</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例：夕暮れの川沿い"
            style={{
              width: "100%",
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: "8px 10px",
            }}
          />
        </div>

        {/* ひとこと */}
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12 }}>ひとこと（任意）</label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            style={{
              width: "100%",
              height: 60,
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: "8px 10px",
            }}
          />
        </div>

        {/* 時間帯 */}
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12 }}>時間帯（任意）</label>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            {[
              ["morning", "朝"],
              ["noon", "昼"],
              ["evening", "夕"],
              ["night", "夜"],
            ].map(([k, l]) => {
              const active = timeOfDay === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() =>
                    setTimeOfDay(active ? "" : (k as any))
                  }
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    border: active ? "2px solid #000" : "1px solid #ddd",
                    background: active ? "rgba(0,0,0,.12)" : "#fff",
                    fontWeight: 700,
                  }}
                >
                  {l}
                </button>
              );
            })}
          </div>
        </div>

        {/* 撮影データ */}
        <div style={{ marginTop: 14 }}>
          <button
            type="button"
            onClick={() => setOpenMeta((v) => !v)}
            style={{
              fontWeight: 700,
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            📷 撮影データ（任意） {openMeta ? "▲" : "▼"}
          </button>

          {openMeta && (
            <div style={{ marginTop: 8 }}>
              <input
                placeholder="カメラ機種"
                value={cameraModel}
                onChange={(e) => setCameraModel(e.target.value)}
                style={{ width: "100%", marginBottom: 6, padding: 8 }}
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <input
                  placeholder="焦点距離（例：35mm）"
                  value={focalLength}
                  onChange={(e) => setFocalLength(e.target.value)}
                />
                <input
                  placeholder="F値（例：f/1.8）"
                  value={aperture}
                  onChange={(e) => setAperture(e.target.value)}
                />
                <input
                  placeholder="シャッター速度（例：1/250）"
                  value={shutterSpeed}
                  onChange={(e) => setShutterSpeed(e.target.value)}
                />
                <input
                  placeholder="ISO（例：100）"
                  value={iso}
                  onChange={(e) => setIso(e.target.value)}
                />
              </div>

              <textarea
                placeholder="撮影メモ（任意）"
                value={shootMemo}
                onChange={(e) => setShootMemo(e.target.value)}
                style={{ width: "100%", height: 80, marginTop: 6 }}
              />
            </div>
          )}
        </div>

        {/* 操作 */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button onClick={onClose}>閉じる</button>
          <button
            onClick={submit}
            disabled={!canSave || saving}
            style={{
              padding: "10px 14px",
              background: "#000",
              color: "#fff",
              borderRadius: 10,
              opacity: !canSave || saving ? 0.6 : 1,
              fontWeight: 700,
            }}
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
/>



      {/* ➕ 投稿フローティングボタン */}
      <button
        onClick={() => {
          const c = getViewRef.current();
          openModalAt({ lat: c.lat, lng: c.lng });
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
                      photos: [...(p.photos ?? []), ...(addPhotos ?? [])],
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
