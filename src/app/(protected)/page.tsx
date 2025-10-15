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

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

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
  onClose,
  onSubmit,
}: {
  open: boolean;
  place: { lat: number; lng: number };
  onClose: () => void;
  onSubmit: (d: {
    title: string;
    memo: string;
    address?: string;
    visitedAt?: string;
    lat: number;
    lng: number;
    photos: File[];
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [address, setAddress] = useState("");
  const [visitedAt, setVisitedAt] = useState<string>(() => {
    const d = new Date();
    const z = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  });
  const [lat, setLat] = useState(place.lat);
  const [lng, setLng] = useState(place.lng);
  const [files, setFiles] = useState<File[]>([]);

  // 開くたび完全リセット
  useEffect(() => {
    if (!open) return;
    const d = new Date();
    const z = (n: number) => String(n).padStart(2, "0");
    setTitle("");
    setMemo("");
    setAddress("");
    setVisitedAt(`${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`);
    setLat(place.lat);
    setLng(place.lng);
    setFiles([]);
  }, [open, place.lat, place.lng]);

  const previews = useMemo(
    () => files.map((f) => ({ url: URL.createObjectURL(f), name: f.name })),
    [files]
  );
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);

  if (!open) return null;
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 999999, display: "grid", placeItems: "center" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(920px, 92vw)", maxHeight: "86vh", overflow: "auto", background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 20px 60px rgba(0,0,0,.35)" }}
      >
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>投稿</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ fontSize: 12, color: "#555" }}>
            緯度
            <input value={Number.isFinite(lat) ? lat : ""} onChange={(e) => setLat(parseFloat(e.target.value))} style={{ width: "100%", border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }} />
          </label>
          <label style={{ fontSize: 12, color: "#555" }}>
            経度
            <input value={Number.isFinite(lng) ? lng : ""} onChange={(e) => setLng(parseFloat(e.target.value))} style={{ width: "100%", border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }} />
          </label>
        </div>

        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12, color: "#555" }}>タイトル</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：〇〇食堂" style={{ width: "100%", border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }} />
        </div>

        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12, color: "#555" }}>住所（任意）</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="住所など" style={{ width: "100%", border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }} />
        </div>

        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12, color: "#555" }}>訪問日</label>
          <input type="date" value={visitedAt} onChange={(e) => setVisitedAt(e.target.value)} style={{ width: "100%", border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }} />
        </div>

        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12, color: "#555" }}>メモ</label>
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} style={{ width: "100%", height: 120, border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }} />
        </div>

        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12, color: "#555" }}>写真（複数可）</label>
          <input type="file" multiple accept="image/*" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} style={{ display: "block", marginTop: 6 }} />
          {previews.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 8 }}>
              {previews.map((p) => (
                <div key={p.url} style={{ border: "1px solid #eee", borderRadius: 10, overflow: "hidden" }}>
                  <img src={p.url} alt={p.name} style={{ width: "100%", height: 120, objectFit: "cover" }} />
                  <div style={{ fontSize: 11, color: "#666", padding: "4px 6px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
          <button onClick={onClose} style={{ padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, background: "#fff" }}>閉じる</button>
          <button
            onClick={() =>
              onSubmit({
                title: title.trim(),
                memo,
                address: address.trim() || undefined,
                visitedAt,
                lat,
                lng,
                photos: files,
              })
            }
            style={{ padding: "10px 14px", borderRadius: 10, background: "#000", color: "#fff", fontWeight: 700 }}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================== 編集モーダル（更新 / 追加アップロード / 写真削除 / 投稿削除） ================== */
function EditModal({
  open,
  place,
  onClose,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  place: { id: string; title?: string | null; memo?: string | null };
  onClose: () => void;
  onSaved: (updated: { title?: string | null; memo?: string | null; addPhotos?: string[]; removePhotoIds?: string[] }) => void;
  onDeleted: () => void;
}) {
  const [title, setTitle] = useState(place.title ?? "");
  const [memo, setMemo] = useState(place.memo ?? "");
  const [loading, setLoading] = useState(false);

  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const newPreviews = useMemo(() => newFiles.map((f) => ({ url: URL.createObjectURL(f), name: f.name })), [newFiles]);

  // 既存写真をロード
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("photos")
        .select("id, place_id, file_url, storage_path")
        .eq("place_id", place.id)
        .order("created_at", { ascending: true });
      setPhotos((data as PhotoRow[]) ?? []);
    })();
  }, [open, place.id]);

  useEffect(() => () => newPreviews.forEach((p) => URL.revokeObjectURL(p.url)), [newPreviews]);

  if (!open) return null;

  async function save() {
    try {
      setLoading(true);
      // 1) place 更新
      if (title !== place.title || memo !== place.memo) {
        const { error } = await supabase.from("places").update({ title, memo }).eq("id", place.id);
        if (error) throw new Error(`[UPDATE] ${error.message}`);
      }

      const addedUrls: string[] = [];
      // 2) 追加アップロード
      if (newFiles.length > 0) {
        const { data: ses } = await supabase.auth.getSession();
        const uid = ses.session?.user.id;
        if (!uid) throw new Error("ログインが必要です（sessionなし）");
        const sp = await ensureMySpace();
        if (!sp?.id) throw new Error("スペースが取得できませんでした");

        for (const f of newFiles) {
  const blob = await compress(f, 1600, 0.8);
  const toUpload = new File([blob], f.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });

  const path = `${place.id}/${crypto.randomUUID()}.jpg`;
  const up = await supabase.storage.from("photos").upload(
    path,
    toUpload,
    { upsert: false, cacheControl: "3600" }
  );
          if (up.error) throw new Error(`[STORAGE] ${up.error.message}`);
          const { data: pub } = supabase.storage.from("photos").getPublicUrl(path);
          const publicUrl = pub.publicUrl;
          const ins = await supabase.from("photos").insert({ place_id: place.id, space_id: sp.id, file_url: publicUrl, storage_path: path }).select("id, place_id, file_url, storage_path").single();
          if (ins.error) throw new Error(`[PHOTOS] ${ins.error.message}`);
          setPhotos((prev) => [...prev, ins.data as PhotoRow]);
          addedUrls.push(publicUrl);
        }
        setNewFiles([]);
      }

      onSaved({ title, memo, addPhotos: addedUrls });
      onClose();
    } catch (e: any) {
      alert(`保存に失敗しました: ${e?.message ?? e}`);
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function removePhoto(row: PhotoRow) {
    if (!confirm("この写真を削除しますか？")) return;
    try {
      setLoading(true);
      // 1) storage 削除
      const { error: eRm } = await supabase.storage.from("photos").remove([row.storage_path]);
      if (eRm) throw new Error(`[STORAGE] ${eRm.message}`);
      // 2) DB 行削除
      const { error: eDb } = await supabase.from("photos").delete().eq("id", row.id);
      if (eDb) throw new Error(`[PHOTOS] ${eDb.message}`);
      setPhotos((prev) => prev.filter((p) => p.id !== row.id));
    } catch (e: any) {
      alert(`削除に失敗しました: ${e?.message ?? e}`);
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function deletePlace() {
    if (!confirm("この投稿を完全に削除しますか？（写真も含めて削除）")) return;
    try {
      setLoading(true);
      // 1) 写真の storage をまとめて削除
      const paths = photos.map((p) => p.storage_path);
      if (paths.length > 0) {
        const { error: eRm } = await supabase.storage.from("photos").remove(paths);
        if (eRm) throw new Error(`[STORAGE] ${eRm.message}`);
      }
      // 2) DB 側も削除（外部キーで cascade の場合は place だけでもOKだが、明示で消す）
      await supabase.from("photos").delete().eq("place_id", place.id);
      const { error: eDel } = await supabase.from("places").delete().eq("id", place.id);
      if (eDel) throw new Error(`[PLACES] ${eDel.message}`);

      onDeleted();
      onClose();
    } catch (e: any) {
      alert(`削除に失敗しました: ${e?.message ?? e}`);
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 1000000, display: "grid", placeItems: "center" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(960px, 96vw)", maxHeight: "88vh", overflow: "auto", background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 20px 60px rgba(0,0,0,.35)" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>編集</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={deletePlace} disabled={loading} style={{ border: "1px solid #ef4444", background: "#fff", color: "#ef4444", padding: "8px 10px", borderRadius: 8, fontWeight: 700 }}>
              投稿を削除
            </button>
            <button onClick={onClose} style={{ border: "1px solid #ddd", background: "#fff", padding: "8px 10px", borderRadius: 8 }}>閉じる</button>
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12, color: "#555" }}>タイトル</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }} />
        </div>

        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12, color: "#555" }}>メモ</label>
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} style={{ width: "100%", height: 150, border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }} />
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>既存の写真</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {photos.length === 0 && <div style={{ fontSize: 12, color: "#9ca3af" }}>写真はまだありません</div>}
            {photos.map((ph) => (
              <div key={ph.id} style={{ border: "1px solid #eee", borderRadius: 10, overflow: "hidden", position: "relative" }}>
                <img src={ph.file_url} style={{ width: 160, height: 120, objectFit: "cover", display: "block" }} alt="" />
                <button
                  onClick={() => removePhoto(ph)}
                  style={{ position: "absolute", top: 6, right: 6, background: "rgba(255,255,255,0.95)", border: "1px solid #ddd", borderRadius: 8, padding: "4px 6px", cursor: "pointer" }}
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={{ fontSize: 12, color: "#555" }}>写真を追加</label>
          <input type="file" multiple accept="image/*" onChange={(e) => setNewFiles(Array.from(e.target.files ?? []))} style={{ display: "block", marginTop: 6 }} />
          {newPreviews.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              {newPreviews.map((p) => (
                <div key={p.url} style={{ border: "1px solid #eee", borderRadius: 10, overflow: "hidden" }}>
                  <img src={p.url} style={{ width: 160, height: 120, objectFit: "cover" }} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button onClick={save} disabled={loading} style={{ padding: "10px 14px", borderRadius: 10, background: "#111827", color: "#fff", fontWeight: 800 }}>
            変更を保存
          </button>
        </div>
      </div>
    </div>
  );
}

/* =============== DB 保存（新規） =============== */
async function insertPlace({
  lat,
  lng,
  title,
  memo,
  visitedAt,
  files,
}: {
  lat: number;
  lng: number;
  title?: string;
  memo?: string;
  visitedAt?: string;
  files: File[];
}) {
  // 認証 & space
  const { data: ses } = await supabase.auth.getSession();
  const uid = ses.session?.user.id;
  if (!uid) throw new Error("ログインが必要です（sessionなし）");

  const sp = await ensureMySpace();
  if (!sp?.id) throw new Error("スペースが取得できませんでした");

  // places
  const { data: placeRow, error: ePlace } = await supabase
    .from("places")
    .insert({
      space_id: sp.id,
      title: title ?? null,
      memo: memo ?? null,
      lat,
      lng,
      visited_at: visitedAt ?? null,
      created_by: uid,
    })
    .select("id, title, memo, lat, lng")
    .single();
  if (ePlace) throw new Error(`[PLACES] ${ePlace.message || ePlace.code}`);

  // photos
  const urls: string[] = [];
  for (const f of files ?? []) {
  const blob = await compress(f, 1600, 0.8);
  const toUpload = new File([blob], f.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });

  const path = `${placeRow.id}/${crypto.randomUUID()}.jpg`;
  const { error: eUp } = await supabase.storage.from("photos").upload(
    path,
    toUpload,
    { upsert: false, cacheControl: "3600" }
  );

    if (eUp) throw new Error(`[STORAGE] ${eUp.message}`);

    const { data: pub } = supabase.storage.from("photos").getPublicUrl(path);
    const publicUrl = pub.publicUrl;
    urls.push(publicUrl);

    const { error: ePhoto } = await supabase.from("photos").insert({ place_id: placeRow.id, space_id: sp.id, file_url: publicUrl, storage_path: path });
    if (ePhoto) throw new Error(`[PHOTOS] ${ePhoto.message || ePhoto.code}`);
  }

  return { id: placeRow.id, title: placeRow.title, memo: placeRow.memo, lat: placeRow.lat, lng: placeRow.lng, photos: urls };
}

/* ================== ページ本体 ================== */
export default function Page() {
  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [newAt, setNewAt] = useState<{ lat: number; lng: number } | null>(null);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const router = useRouter();

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

  
  // 起動時ロード
  useEffect(() => {
    (async () => {
      try {
        const { data: ses } = await supabase.auth.getSession();
        if (!ses.session) return;
        const mySpace = await ensureMySpace();
        if (!mySpace?.id) return;

        const { data: ps } = await supabase
          .from("places")
          .select("id, title, memo, lat, lng")
          .eq("space_id", mySpace.id)
          .order("created_at", { ascending: false });

        const ids = (ps ?? []).map((p) => p.id);
        let photosBy: Record<string, string[]> = {};
        if (ids.length > 0) {
          const { data: phs } = await supabase.from("photos").select("place_id, file_url").in("place_id", ids);
          for (const ph of phs ?? []) {
            const k = (ph as any).place_id as string;
            const u = (ph as any).file_url as string;
            if (!photosBy[k]) photosBy[k] = [];
            photosBy[k].push(u);
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
          }))
        );
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // モーダル開く前にビューを保持（初期位置戻りを抑制）
  const openModalAt = (p: { lat: number; lng: number }) => {
    const snap = getViewRef.current();
    setInitialView(snap);
    setNewAt(p);
    setSelectedId(null);
    setTimeout(() => setViewRef.current(snap), 0);
  };

  const selected = useMemo(() => places.find((x) => x.id === selectedId) || null, [places, selectedId]);

  return (
    <>
      {/* マップ */}
      <MapView
        places={places}
        onRequestNew={openModalAt}
        onSelect={(p) => setSelectedId(p.id)}
        selectedId={selectedId}
        flyTo={flyTo}
        bindGetView={(fn) => { getViewRef.current = fn; }}
        bindSetView={(fn) => { setViewRef.current = fn; }}
        initialView={initialView}
      />

    
     {/* 検索（中央・幅をクランプ、ノッチ対応） */}
<div
  style={{
    position: "fixed",
    top: "calc(env(safe-area-inset-top, 0px) + 10px)",
    left: 0,
    right: 0,
    zIndex: 10000,
    pointerEvents: "auto",
    paddingLeft: "max(12px, env(safe-area-inset-left, 0px))",
    paddingRight: "max(12px, env(safe-area-inset-right, 0px))",
  }}
  onMouseDown={(e) => e.stopPropagation()}
  onClick={(e) => e.stopPropagation()}
  onWheel={(e) => e.stopPropagation()}
  onTouchStart={(e) => e.stopPropagation()}
>
  <div
    style={{
      // 画面中央に固定。幅は 240px〜520px の間で画面比で可変
      width: "clamp(240px, 70vw, 520px)",
      margin: "0 auto",
    }}
  >
    <SearchBox onPick={(p) => setFlyTo(p)} />
  </div>
</div>

{/* ログアウト（右上に独立配置。検索に押し出されない） */}
<button
  style={{
    position: "fixed",
    top: "calc(env(safe-area-inset-top, 0px) + 10px)",
    right: "max(12px, env(safe-area-inset-right, 0px))",
    zIndex: 10001,
    background: "rgba(255,255,255,0.9)",
    border: "1px solid #ddd",
    borderRadius: 10,
    padding: "10px 14px",
    cursor: "pointer",
    boxShadow: "0 4px 16px rgba(0,0,0,.08)",
    backdropFilter: "saturate(120%) blur(6px)",
  }}
  onClick={async (e) => {
    e.stopPropagation();
    try {
      await supabase.auth.signOut();
   　 } finally {
    　  router.replace("/login");
   　　 }
　　  }}
　　>
　　  ログアウト
　　</button>
  </div>
</div>

      {/* 右下＋投稿 */}
      <button
        onClick={() => {
          const c = getViewRef.current();
          openModalAt({ lat: c.lat, lng: c.lng });
        }}
        style={{ position: "fixed", right: 20, bottom: 20, zIndex: 10000, background: "#000", color: "#fff", borderRadius: 999, padding: "12px 16px", boxShadow: "0 8px 24px rgba(0,0,0,.25)", cursor: "pointer" }}
      >
        ＋ 投稿
      </button>

     {/* 下プレビュー（縦レイアウト：タイトル → メモ → 写真 全幅） */}
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
    {/* ✨ タイトル（中央・ぶち抜き） */}
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

    {/* × クローズ（左上） */}
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

    {/* ✏️ 編集（右上） */}
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

    {/* 📝 メモ（全幅） */}
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

    {/* 🖼️ 写真（全幅・残り高さを全部使う） */}
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 8,
        overflowY: "auto",
        flex: 1, // ← 残り高さぜんぶ
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



      {/* 投稿モーダル */}
      <PostModal
        open={!!newAt}
        place={{ lat: newAt?.lat ?? 0, lng: newAt?.lng ?? 0 }}
        onClose={() => {
          setNewAt(null);
          const snap = initialView ?? getViewRef.current();
          setTimeout(() => setViewRef.current(snap), 0);
        }}
        onSubmit={async (d) => {
          try {
            const created = await insertPlace({
              title: d.title, memo: d.memo, lat: d.lat, lng: d.lng, visitedAt: d.visitedAt, files: d.photos,
            });
            setPlaces((prev) => [
              { id: created.id, name: created.title ?? "新規", memo: created.memo ?? undefined, lat: created.lat, lng: created.lng, photos: created.photos ?? [] },
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

      {/* 編集モーダル */}
      {selected && (
        <EditModal
          open={editOpen}
          place={{ id: selected.id, title: selected.name ?? "", memo: selected.memo ?? "" }}
          onClose={() => setEditOpen(false)}
          onSaved={({ title, memo, addPhotos }) => {
            // 画面側の即時反映
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
