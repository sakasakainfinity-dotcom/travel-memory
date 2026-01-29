// src/app/public/page.tsx
"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Place as MapPlace } from "@/components/MapView";
import { useRouter } from "next/navigation";
import SearchBox from "@/components/SearchBox";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

type View = { lat: number; lng: number; zoom: number };

type PublicPost = MapPlace & {
  createdByName?: string;
  createdAt?: Date | null;
  memo?: string;
  photos?: string[];
  likeCount?: number;
  likedByMe?: boolean;
};

type PublicMarkerPlace = MapPlace & {
  postCount?: number;
  wantCount?: number;
  visitedCount?: number;
  wantedByMe?: boolean;
  visitedByMe?: boolean;
};

// ★同じ場所判定キー（title + lat/lng 丸め）
function makePlaceKey(title: string | null | undefined, lat: number, lng: number) {
  const normTitle = (title ?? "").replace(/\s+/g, "").toLowerCase();
  const r = (n: number) => Math.round(n * 1e4) / 1e4; // 小数4桁
  return `${normTitle}|${r(lat)}|${r(lng)}`;
}

// ★配列を200個ずつに分ける道具
function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function MenuButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        borderRadius: 12,
        border: "1px solid rgba(17,24,39,0.12)",
        background: "#fff",
        padding: "12px 12px",
        cursor: "pointer",
        fontWeight: 900,
        color: "#111827",
        boxShadow: "0 8px 18px rgba(0,0,0,0.06)",
      }}
    >
      {label}
    </button>
  );
}


export default function PublicPage() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);


  // ✅ ここが正しい：useStateはコンポーネント内
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [activePhotoUrl, setActivePhotoUrl] = useState<string | null>(null);
  const [activePostId, setActivePostId] = useState<string | null>(null);

  const [places, setPlaces] = useState<PublicMarkerPlace[]>([]);
  const [postsByPlaceKey, setPostsByPlaceKey] = useState<Record<string, PublicPost[]>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dlMsg, setDlMsg] = useState<string | null>(null);

  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [initialView, setInitialView] = useState<View | undefined>(undefined);
  const [reactBusyId, setReactBusyId] = useState<string | null>(null);
  const [placeIdToKey, setPlaceIdToKey] = useState<Record<string, string>>({});

  const getViewRef = useRef<() => View>(() => ({ lat: 35.68, lng: 139.76, zoom: 4 }));
  const setViewRef = useRef<(v: View) => void>(() => {});

useEffect(() => {
  const sp = new URLSearchParams(window.location.search);
  const paid = sp.get("paid");
  const sessionId = sp.get("session_id");
  const placeId = sp.get("placeId");

  if (paid !== "1" || !sessionId || !placeId) return;

  (async () => {
    try {
      setDlMsg("決済確認中…");

      const res = await fetch("/api/stripe/finalize-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, placeId }),
      });

      if (!res.ok) {
  const t = await res.text();
  throw new Error(`finalize-download ${res.status}: ${t || "empty body"}`);
}

      const { downloadUrl } = await res.json();
      if (!downloadUrl) throw new Error("downloadUrl missing");

      setDlMsg("ダウンロードが完了しました 📸");
const t = window.setTimeout(() => setDlMsg(null), 1200);
return () => window.clearTimeout(t);
      
      const r = await fetch(downloadUrl);
      const blob = await r.blob();
      const a = document.createElement("a");
      const objUrl = URL.createObjectURL(blob);
      a.href = objUrl;
      a.download = `travel-memory-${placeId}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);

      setDlMsg(null);
    } catch (e) {
  console.error(e);
  const msg = e instanceof Error ? e.message : String(e);
  setDlMsg(`エラー: ${msg}`);
}
  })();
}, []);


  // 公開投稿の読み込み
  useEffect(() => {
    (async () => {
      try {
        const { data: ses } = await supabase.auth.getSession();
        const uid = ses.session?.user.id ?? null;

        // 1) 公開投稿（places）取得
        const { data: ps, error } = await supabase
          .from("places")
          .select("id, title, memo, lat, lng, visibility, created_by_name, created_at")
          .eq("visibility", "public")
          .order("created_at", { ascending: false });

        if (error) throw error;
        const rows = (ps ?? []) as any[];
        const postIds = rows.map((p) => p.id as string);

        // 2) 写真（photos）取得
        let photosBy: Record<string, string[]> = {};
        if (postIds.length > 0) {
          for (const ids of chunk(postIds, 200)) {
            const { data: phs, error: ePh } = await supabase
              .from("photos")
              .select("place_id, file_url")
              .in("place_id", ids);
            if (ePh) throw ePh;

            for (const ph of phs ?? []) {
              const pid = (ph as any).place_id as string;
              const url = (ph as any).file_url as string;
              (photosBy[pid] ||= []).push(url);
            }
          }
        }

        // 3) 投稿いいね集計（post_likes）
        type LikeRow = { post_id: string; user_id: string };
        const likeByPost: Record<string, { likeCount: number; likedByMe: boolean }> = {};
        if (postIds.length > 0) {
          for (const ids of chunk(postIds, 200)) {
            const { data: ls, error: eL } = await supabase
              .from("post_likes")
              .select("post_id, user_id")
              .in("post_id", ids);
            if (eL) throw eL;

            for (const r of (ls ?? []) as LikeRow[]) {
              const pid = r.post_id;
              if (!likeByPost[pid]) likeByPost[pid] = { likeCount: 0, likedByMe: false };
              likeByPost[pid].likeCount++;
              if (uid && r.user_id === uid) likeByPost[pid].likedByMe = true;
            }
          }
        }

        // 4) 投稿（PublicPost）生成
        const postPlaces: PublicPost[] = rows.map((p: any) => {
          const like = likeByPost[p.id] ?? { likeCount: 0, likedByMe: false };
          return {
            id: p.id,
            name: p.title,
            memo: p.memo ?? undefined,
            lat: Number(p.lat),
            lng: Number(p.lng),
            photos: photosBy[p.id] ?? [],
            createdByName: p.created_by_name ?? "名無しの旅人",
            createdAt: p.created_at ? new Date(p.created_at) : null,
            likeCount: like.likeCount,
            likedByMe: like.likedByMe,
          } as PublicPost;
        });

        const safePostPlaces = postPlaces.filter(
          (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180
        );

        // 5) placeKey で束ねる（投稿→場所）
        const grouped: Record<string, PublicPost[]> = {};
        for (const post of safePostPlaces) {
          const key = makePlaceKey(post.name, post.lat, post.lng);
          (grouped[key] ||= []).push(post);
        }

        // 6) 場所フラグ集計（place_flags）
        const placeKeys = Object.keys(grouped);

        type FlagRow = { place_key: string; user_id: string; kind: "want" | "visited" };
        const flagByKey: Record<
          string,
          { wantCount: number; visitedCount: number; wantedByMe: boolean; visitedByMe: boolean }
        > = {};

        if (placeKeys.length > 0) {
          for (const keys of chunk(placeKeys, 200)) {
            const { data: fs, error: eF } = await supabase
              .from("place_flags")
              .select("place_key, user_id, kind")
              .in("place_key", keys);
            if (eF) throw eF;

            for (const r of (fs ?? []) as FlagRow[]) {
              const k = r.place_key;
              if (!flagByKey[k]) {
                flagByKey[k] = { wantCount: 0, visitedCount: 0, wantedByMe: false, visitedByMe: false };
              }
              if (r.kind === "want") {
                flagByKey[k].wantCount++;
                if (uid && r.user_id === uid) flagByKey[k].wantedByMe = true;
              } else {
                flagByKey[k].visitedCount++;
                if (uid && r.user_id === uid) flagByKey[k].visitedByMe = true;
              }
            }
          }
        }

        // 7) MapView用の「1場所=1マーカー」生成（代表投稿 + flags）
        const markerPlaces: PublicMarkerPlace[] = Object.entries(grouped).map(([key, posts]) => {
          const sorted = [...posts].sort((a, b) => {
            const ad = a.createdAt?.getTime() ?? 0;
            const bd = b.createdAt?.getTime() ?? 0;
            return bd - ad;
          });
          const repr = sorted[0];
          const f =
            flagByKey[key] ?? ({ wantCount: 0, visitedCount: 0, wantedByMe: false, visitedByMe: false } as const);

          return {
            ...repr,
            id: key,
            postCount: posts.length,
            wantCount: f.wantCount,
            visitedCount: f.visitedCount,
            wantedByMe: f.wantedByMe,
            visitedByMe: f.visitedByMe,
          } as PublicMarkerPlace;
        });

        // 8) state反映（地図に青●）
        setPostsByPlaceKey(grouped);
        setPlaces(markerPlaces);

        // postId -> placeKey の辞書
        const idMap: Record<string, string> = {};
        for (const [k, posts] of Object.entries(grouped)) {
          for (const p of posts) idMap[p.id] = k;
        }
        setPlaceIdToKey(idMap);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // 選択中の「場所の投稿全部」
  const selectedPosts = useMemo(() => {
    if (!selectedId) return [];
    return postsByPlaceKey[selectedId] ?? [];
  }, [postsByPlaceKey, selectedId]);

  const selectedTitle = useMemo(() => {
    if (!selectedId) return "";
    const marker = places.find((x) => x.id === selectedId);
    return marker?.name ?? "";
  }, [places, selectedId]);

  async function togglePostLike(postId: string) {
    const busyKey = `${postId}:like`;
    try {
      setReactBusyId(busyKey);

      const { data: ses } = await supabase.auth.getSession();
      const uid = ses.session?.user.id;
      if (!uid) return alert("ログインが必要じゃよ。");

      const key = placeIdToKey[postId];
      if (!key) return;

      const target = (postsByPlaceKey[key] ?? []).find((p) => p.id === postId);
      if (!target) return;

      const already = !!target.likedByMe;

      // ✅ UI即時反映（楽観）
      setPostsByPlaceKey((prev) => {
        const arr = prev[key] ?? [];
        return {
          ...prev,
          [key]: arr.map((p) =>
            p.id !== postId
              ? p
              : {
                  ...p,
                  likedByMe: !already,
                  likeCount: Math.max(0, (p.likeCount ?? 0) + (already ? -1 : 1)),
                }
          ),
        };
      });

      // DB
      if (already) {
        const { error } = await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", uid);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("post_likes").insert({ post_id: postId, user_id: uid });
        if (error) throw error;
      }
    } catch (e) {
      console.error(e);
      alert("いいね更新に失敗したかも…");
    } finally {
      setReactBusyId(null);
    }
  }

async function togglePlaceFlag(placeKey: string, kind: "want" | "visited") {
  const busyKey = `${placeKey}:${kind}`;
  try {
    setReactBusyId(busyKey);

    const { data: ses } = await supabase.auth.getSession();
    const uid = ses.session?.user.id;
    if (!uid) return alert("ログインが必要じゃよ。");

    const marker = places.find((p) => p.id === placeKey);
    if (!marker) return;

    const already = kind === "want" ? !!marker.wantedByMe : !!marker.visitedByMe;

    // ✅ UI即時反映
    setPlaces((prev) =>
      prev.map((p) => {
        if (p.id !== placeKey) return p;
        if (kind === "want") {
          return {
            ...p,
            wantedByMe: !already,
            wantCount: Math.max(0, (p.wantCount ?? 0) + (already ? -1 : 1)),
          };
        }
        return {
          ...p,
          visitedByMe: !already,
          visitedCount: Math.max(0, (p.visitedCount ?? 0) + (already ? -1 : 1)),
        };
      })
    );

    // DB
    if (already) {
      const { error } = await supabase
        .from("place_flags")
        .delete()
        .eq("place_key", placeKey)
        .eq("user_id", uid)
        .eq("kind", kind);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("place_flags")
        .insert({ place_key: placeKey, user_id: uid, kind });
      if (error) throw error;
    }
  } catch (e) {
    console.error(e);
    alert("場所フラグ更新に失敗したかも…");
  } finally {
    setReactBusyId(null);
  }
}


  return (
    <>
      {/* ★★★ ここに入れる ★★★ */}
    {dlMsg && (
      <div
        style={{
          position: "fixed",
          top: 12,
          left: 12,
          zIndex: 10002,
          padding: "10px 12px",
          background: "rgba(0,0,0,0.7)",
          color: "#fff",
          borderRadius: 10,
          fontSize: 12,
        }}
      >
        {dlMsg}
      </div>
    )}
      
      {/* 右上：トグル + ☰（トグルの下に配置） */}
<div
  style={{
    position: "fixed",
    top: "calc(env(safe-area-inset-top, 0px) + 10px)",
    right: "max(12px, env(safe-area-inset-right, 0px))",
    zIndex: 10001,
    pointerEvents: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 8, // ← トグルと☰の縦間隔
    alignItems: "flex-end",
  }}
>
  {/* Private / Public トグル */}
  <div
    style={{
      display: "flex",
      borderRadius: 999,
      border: "1px solid #111827",
      overflow: "hidden",
      background: "#fff",
      fontSize: 12,
    }}
  >
    <button
      type="button"
      onClick={() => router.push("/")}
      style={{
        padding: "6px 14px",
        background: "#ffffff",
        color: "#111827",
        border: "none",
        cursor: "pointer",
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 999, background: "#22c55e" }} />
      Private
    </button>

    <div
      style={{
        padding: "6px 14px",
        background: "#111827",
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontWeight: 700,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 999, background: "#2563eb" }} />
      Public
    </div>
  </div>

  {/* ☰ メニューボタン（トグルの下） */}
  <button
    type="button"
    onClick={() => setMenuOpen(true)}
    style={{
      width: 36,
      height: 32,
      borderRadius: 8,
      border: "1px solid rgba(17,24,39,0.25)",
      background: "#fff",
      color: "#111827",
      cursor: "pointer",
      fontWeight: 900,
      display: "grid",
      placeItems: "center",
    }}
    aria-label="メニュー"
  >
    ☰
  </button>
</div>



      {/* 左上 検索 */}
      <div
        style={{
          position: "fixed",
          top: "calc(env(safe-area-inset-top, 0px) + 50px)",
          left: "max(12px, env(safe-area-inset-left, 0px))",
          zIndex: 10000,
          pointerEvents: "auto",
        }}
      >
        <div style={{ width: "clamp(220px, 60vw, 340px)" }}>
          <SearchBox
            places={places}
            onPick={(p) => {
              setFlyTo({ lat: p.lat, lng: p.lng, zoom: p.zoom ?? 15 });
              if (p.id) setSelectedId(p.id);
            }}
          />
        </div>
      </div>

     {/* ================= マップ本体 ================= */}
<MapView
  places={places}
  onRequestNew={() => alert("公開マップでは投稿できんよ。自分のマップ（Private）で投稿してね。")}
  onSelect={(p) => setSelectedId(p.id)}
  selectedId={selectedId}
  flyTo={flyTo}
  bindGetView={(fn) => {
    getViewRef.current = fn;
  }}
  bindSetView={(fn) => {
    setViewRef.current = fn;
  }}
  initialView={initialView}
  mode="public"
/>

{/* ================= 下パネル：同じ場所の投稿（1回だけ） ================= */}
{selectedId && (
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
  >
    {/* 閉じる */}
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
    >
      ×
    </button>

    {/* タイトル（場所） + Placeボタン */}
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ minWidth: 0, flex: 1, textAlign: "center" }}>
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
          title={selectedTitle || "無題"}
        >
          {selectedTitle || "無題"}（{selectedPosts.length}件）
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        {(() => {
          const m = places.find((x) => x.id === selectedId);
          const wanted = !!m?.wantedByMe;
          const visited = !!m?.visitedByMe;

          return (
            <>
              <button
                type="button"
                disabled={reactBusyId === `${selectedId}:want`}
                onClick={() => togglePlaceFlag(selectedId!, "want")}
                style={{
                  padding: "7px 12px",
                  borderRadius: 999,
                  border: wanted ? "1px solid #f59e0b" : "1px solid #fde68a",
                  background: wanted ? "linear-gradient(180deg,#fcd34d,#f59e0b)" : "#fffbeb",
                  color: wanted ? "#111827" : "#92400e",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                  boxShadow: wanted ? "0 10px 18px rgba(245,158,11,0.25)" : "none",
                }}
              >
                ⭐ 行きたい
              </button>

              <button
                type="button"
                disabled={reactBusyId === `${selectedId}:visited`}
                onClick={() => togglePlaceFlag(selectedId!, "visited")}
                style={{
                  padding: "7px 12px",
                  borderRadius: 999,
                  border: visited ? "1px solid #10b981" : "1px solid #bbf7d0",
                  background: visited ? "linear-gradient(180deg,#34d399,#10b981)" : "#ecfdf5",
                  color: visited ? "#052e16" : "#065f46",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                  boxShadow: visited ? "0 10px 18px rgba(16,185,129,0.22)" : "none",
                }}
              >
                ✓ 行った
              </button>
            </>
          );
        })()}
      </div>
    </div>

    {/* 投稿一覧（スクロール） */}
    <div style={{ overflowY: "auto", display: "grid", gap: 12, paddingTop: 4 }}>
      {selectedPosts.length === 0 && (
        <div style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", padding: 20 }}>
          投稿が見つからんかった…
        </div>
      )}

      {selectedPosts.map((post) => (
        <div
          key={post.id}
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 12,
            background: "#fff",
            display: "grid",
            gap: 10,
          }}
        >
          {/* 投稿者 + 投稿日時 */}
          <div style={{ fontSize: 11, color: "#6b7280", textAlign: "center" }}>
            {post.createdByName ?? "名無しの旅人"}{" "}
            {post.createdAt && `・${post.createdAt.toLocaleDateString("ja-JP")}`}
          </div>

          {/* Like（投稿単位） */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              disabled={reactBusyId === `${post.id}:like`}
              onClick={() => togglePostLike(post.id)}
              style={{
                padding: "7px 12px",
                borderRadius: 999,
                border: post.likedByMe ? "1px solid #fb7185" : "1px solid #fecdd3",
                background: post.likedByMe ? "linear-gradient(180deg,#fb7185,#f43f5e)" : "#fff1f2",
                color: post.likedByMe ? "#fff" : "#9f1239",
                fontSize: 12,
                fontWeight: 800,
                cursor: reactBusyId === `${post.id}:like` ? "default" : "pointer",
                boxShadow: post.likedByMe ? "0 10px 18px rgba(244,63,94,0.20)" : "none",
              }}
            >
              ❤️ {post.likeCount ?? 0}
            </button>
          </div>

          {/* メモ */}
          <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
            {post.memo || "（メモなし）"}
          </div>

          {/* 写真一覧 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 8,
            }}
          >
            {(post.photos ?? []).length === 0 && (
              <div style={{ fontSize: 12, color: "#9ca3af" }}>写真はまだありません</div>
            )}

            {(post.photos ?? []).map((u) => (
              <img
                key={u}
                src={u}
                loading="lazy"
                onClick={() => {
                  setActivePhotoUrl(u);
                  setActivePostId(post.id);
                  setPhotoModalOpen(true);
                }}
                style={{
                  width: "100%",
                  height: "22vh",
                  objectFit: "cover",
                  borderRadius: 10,
                  border: "1px solid #eee",
                  cursor: "pointer",
                }}
                alt=""
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
)}

{/* ================= 右スライドメニュー（下パネルの外！） ================= */}
{menuOpen && (
  <div
    onClick={() => setMenuOpen(false)}
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.45)",
      zIndex: 10050,
      display: "grid",
      justifyItems: "end",
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: "min(420px, 92vw)",
        height: "100%",
        background: "rgba(255,255,255,0.98)",
        borderLeft: "1px solid rgba(17,24,39,0.12)",
        padding: 14,
        overflowY: "auto",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontWeight: 900 }}>メニュー</div>
        <button
          onClick={() => setMenuOpen(false)}
          style={{
            borderRadius: 10,
            border: "1px solid rgba(17,24,39,0.15)",
            background: "#fff",
            padding: "6px 10px",
            cursor: "pointer",
            fontWeight: 900,
          }}
        >
          ×
        </button>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <MenuButton label="みんなの投稿" onClick={() => { setMenuOpen(false); router.push("/community"); }} />
        <MenuButton label="投稿履歴" onClick={() => { setMenuOpen(false); router.push("/history"); }} />
        <MenuButton label="有料プラン" onClick={() => { setMenuOpen(false); router.push("/plans"); }} />
        <MenuButton label="AI 旅行プラン" onClick={() => { setMenuOpen(false); router.push("/ai-trip"); }} />
        <MenuButton label="シェアする" onClick={() => { setMenuOpen(false); router.push("/share"); }} />
        <MenuButton label="撮りたいリスト" onClick={() => { setMenuOpen(false); router.push("/list"); }} />
        <MenuButton label="アカウント設定" onClick={() => { setMenuOpen(false); router.push("/account"); }} />
        <MenuButton label="このアプリについて" onClick={() => { setMenuOpen(false); router.push("/about"); }} />
      </div>
    </div>
  </div>
)}

{/* ================= 全画面写真モーダル（returnの最後） ================= */}
{photoModalOpen && activePhotoUrl && (
  <div
    onClick={() => {
      setPhotoModalOpen(false);
      setActivePhotoUrl(null);
      setActivePostId(null);
    }}
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.92)",
      zIndex: 999999,
      display: "grid",
      placeItems: "center",
      padding: 12,
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: "min(980px, 96vw)",
        height: "min(86vh, 900px)",
        display: "grid",
        gridTemplateRows: "1fr auto",
        gap: 12,
      }}
    >
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <img
          src={activePhotoUrl}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            borderRadius: 12,
            background: "rgba(255,255,255,0.04)",
          }}
        />

        <button
          onClick={() => {
            setPhotoModalOpen(false);
            setActivePhotoUrl(null);
            setActivePostId(null);
          }}
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            border: "1px solid rgba(255,255,255,0.25)",
            background: "rgba(0,0,0,0.35)",
            color: "#fff",
            borderRadius: 10,
            padding: "8px 10px",
            cursor: "pointer",
            fontWeight: 800,
          }}
        >
          ×
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button
          onClick={async () => {
  const r = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postId: activePostId }), // いま開いてる投稿ID
  });
  const j = await r.json();
  if (!r.ok) return alert(j?.error ?? "決済の開始に失敗した…");

  window.location.href = j.url;
}}
        >
          高画質で保存（システム利用料 ¥100）
          <div style={{ marginTop: 6, fontSize: 12, color: "rgba(17,24,39,0.65)", lineHeight: 1.4 }}>
  ※ダウンロードされた写真は、投稿者へ還元される仕組みを作成中です。
</div>
        </button>
      </div>
    </div>
  </div>
)}
 </>
  );
}
