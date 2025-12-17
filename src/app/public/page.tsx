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

// Public 用に拡張した Place 型
type PublicPlace = MapPlace & {
  createdByName?: string;
  createdAt?: Date | null;
  likeCount?: number;
  wantCount?: number;
  visitedCount?: number;
  likedByMe?: boolean;
  wantedByMe?: boolean;
  visitedByMe?: boolean;

  // ★追加：同一場所に紐づく投稿数（マーカー用）
  postCount?: number;
};

// ★同じ場所判定キー（title + lat/lng 丸め）
function makePlaceKey(title: string | null | undefined, lat: number, lng: number) {
  const normTitle = (title ?? "").replace(/\s+/g, "").toLowerCase();
  const r = (n: number) => Math.round(n * 1e4) / 1e4; // 小数4桁
  return `${normTitle}|${r(lat)}|${r(lng)}`;
}

export default function PublicPage() {
  const router = useRouter();

  // MapView に渡す「1場所=1マーカー」の配列
  const [places, setPlaces] = useState<PublicPlace[]>([]);
  // ★その場所キーに紐づく投稿全部（下パネルで使う）
 const [placeIdToKey, setPlaceIdToKey] = useState<Record<string, string>>({});
  const [postsByPlaceKey, setPostsByPlaceKey] = useState<Record<string, PublicPlace[]>>({});


  // 選択は「場所キー」
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [initialView, setInitialView] = useState<View | undefined>(undefined);
  const [reactBusyId, setReactBusyId] = useState<string | null>(null);

  const getViewRef = useRef<() => View>(() => ({ lat: 35.68, lng: 139.76, zoom: 4 }));
  const setViewRef = useRef<(v: View) => void>(() => {});

  // 公開投稿の読み込み
  useEffect(() => {
    (async () => {
      try {
        // ログインユーザー（リアクション判定用）
        const { data: ses } = await supabase.auth.getSession();
        const uid = ses.session?.user.id ?? null;

        const { data: ps, error } = await supabase
          .from("places")
          .select("id, title, memo, lat, lng, visibility, created_by_name, created_at")
          .eq("visibility", "public")
          .order("created_at", { ascending: false });

        if (error) throw error;

        const rows = (ps ?? []) as any[];
        const ids = rows.map((p) => p.id as string);

        // 写真をまとめて取得
        let photosBy: Record<string, string[]> = {};
        if (ids.length > 0) {
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

        // リアクションをまとめて取得（like / want / visited）
        type ReactionRow = {
          place_id: string;
          user_id: string;
          kind: "like" | "want" | "visited";
        };

        let reactionBy: Record<
          string,
          {
            likeCount: number;
            wantCount: number;
            visitedCount: number;
            likedByMe: boolean;
            wantedByMe: boolean;
            visitedByMe: boolean;
          }
        > = {};

        if (ids.length > 0) {
          const { data: rs, error: eR } = await supabase
            .from("place_reactions")
            .select("place_id, user_id, kind")
            .in("place_id", ids);

          if (eR) throw eR;

          for (const r of (rs ?? []) as ReactionRow[]) {
            const pid = r.place_id;
            if (!reactionBy[pid]) {
              reactionBy[pid] = {
                likeCount: 0,
                wantCount: 0,
                visitedCount: 0,
                likedByMe: false,
                wantedByMe: false,
                visitedByMe: false,
              };
            }
            const bucket = reactionBy[pid];

            if (r.kind === "like") {
              bucket.likeCount++;
              if (uid && r.user_id === uid) bucket.likedByMe = true;
            } else if (r.kind === "want") {
              bucket.wantCount++;
              if (uid && r.user_id === uid) bucket.wantedByMe = true;
            } else if (r.kind === "visited") {
              bucket.visitedCount++;
              if (uid && r.user_id === uid) bucket.visitedByMe = true;
            }
          }
        }

        // ===== ここが今回の本体：同じ場所を「束ねる」 =====
        // 1) まず「1投稿=1件」の PublicPlace を作る（idは place.id のまま）
        const postPlaces: PublicPlace[] = rows.map((p: any) => {
          const react =
            reactionBy[p.id] ?? {
              likeCount: 0,
              wantCount: 0,
              visitedCount: 0,
              likedByMe: false,
              wantedByMe: false,
              visitedByMe: false,
            };

          return {
            id: p.id, // ←ここは「投稿ID（places.id）」のまま保持
            name: p.title,
            memo: p.memo ?? undefined,
            lat: p.lat,
            lng: p.lng,
            photos: photosBy[p.id] ?? [],
            visibility: "public",
            createdByName: p.created_by_name ?? "名無しの旅人",
            createdAt: p.created_at ? new Date(p.created_at) : null,
            likeCount: react.likeCount,
            wantCount: react.wantCount,
            visitedCount: react.visitedCount,
            likedByMe: react.likedByMe,
            wantedByMe: react.wantedByMe,
            visitedByMe: react.visitedByMe,
          } as PublicPlace;
        });

        // 2) placeKey -> 投稿配列
        const grouped: Record<string, PublicPlace[]> = {};
        for (const post of postPlaces) {
          const key = makePlaceKey(post.name, post.lat, post.lng);
          (grouped[key] ||= []).push(post);
        }

        // 3) MapView 用の「1場所=1マーカー」を作る（代表1件を使う）
        //    id は placeKey にする（選択・検索・マーカー識別が安定する）
        const markerPlaces: PublicPlace[] = Object.entries(grouped).map(([key, posts]) => {
          // ルール：グループ内は createdAt 新しい順（rowsが降順なので基本そのまま）
          const sorted = [...posts].sort((a, b) => {
            const ad = a.createdAt?.getTime() ?? 0;
            const bd = b.createdAt?.getTime() ?? 0;
            return bd - ad;
          });

          const repr = sorted[0]; // 代表（最新）
          return {
            ...repr,
            id: key, // ★重要：MapViewに渡すIDは「場所キー」
            postCount: posts.length, // ★投稿数
          } as PublicPlace;
        });

        setPostsByPlaceKey(grouped);
        setPlaces(markerPlaces);
        const idMap: Record<string, string> = {};
for (const [key, posts] of Object.entries(grouped)) {
  for (const p of posts) {
    idMap[p.id] = key;
  }
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

// リアクションのトグル（like / want / visited 共通）
// ★注意：placeId は「投稿（places.id）」の方を渡す
async function toggleReaction(
  placeId: string,
  kind: "like" | "want" | "visited"
) {
  const busyKey = `${placeId}:${kind}`;
  const { data: ses } = await supabase.auth.getSession();
  const uid = ses.session?.user.id;

  if (!uid) {
    alert("リアクションするにはログインが必要じゃよ。");
    return;
  }

  // placeId → placeKey
  const key = placeIdToKey[placeId];
  if (!key) return;

  // 今の状態を prev から読んで、次の状態を作る（ここが大事）
  let already = false;
  let snapshot: Record<string, PublicPlace[]> | null = null;

  try {
    setReactBusyId(busyKey);

    // ✅ 1) 先にUI更新（楽観的更新）
    setPostsByPlaceKey((prev) => {
      snapshot = prev; // 失敗時に戻す用

      const arr = prev[key] ?? [];
      const target = arr.find((p) => p.id === placeId);
      if (!target) return prev;

      already =
        kind === "like"
          ? !!target.likedByMe
          : kind === "want"
          ? !!target.wantedByMe
          : !!target.visitedByMe;

      const nextArr = arr.map((p) => {
        if (p.id !== placeId) return p;

        if (already) {
          // 押してた → 取り消し
          return {
            ...p,
            likeCount:
              kind === "like" ? Math.max(0, (p.likeCount ?? 0) - 1) : p.likeCount,
            wantCount:
              kind === "want" ? Math.max(0, (p.wantCount ?? 0) - 1) : p.wantCount,
            visitedCount:
              kind === "visited"
                ? Math.max(0, (p.visitedCount ?? 0) - 1)
                : p.visitedCount,
            likedByMe: kind === "like" ? false : p.likedByMe,
            wantedByMe: kind === "want" ? false : p.wantedByMe,
            visitedByMe: kind === "visited" ? false : p.visitedByMe,
          };
        } else {
          // 押してない → 追加
          return {
            ...p,
            likeCount: kind === "like" ? (p.likeCount ?? 0) + 1 : p.likeCount,
            wantCount: kind === "want" ? (p.wantCount ?? 0) + 1 : p.wantCount,
            visitedCount:
              kind === "visited" ? (p.visitedCount ?? 0) + 1 : p.visitedCount,
            likedByMe: kind === "like" ? true : p.likedByMe,
            wantedByMe: kind === "want" ? true : p.wantedByMe,
            visitedByMe: kind === "visited" ? true : p.visitedByMe,
          };
        }
      });

      return { ...prev, [key]: nextArr };
    });

    // ✅ 2) あとからDB更新
    if (already) {
      const { error } = await supabase
        .from("place_reactions")
        .delete()
        .eq("place_id", placeId)
        .eq("user_id", uid)
        .eq("kind", kind);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("place_reactions").insert({
        place_id: placeId,
        user_id: uid,
        kind,
      });
      if (error) throw error;
    }

    // （デバッグ用）押した瞬間にUIが変わってるか確認
    console.log("optimistic updated", placeId, kind, "already:", already);
  } catch (e) {
    console.error(e);

    // ✅ 3) 失敗したらUIを戻す
    if (snapshot) {
      setPostsByPlaceKey(snapshot);
    }

    alert("反応の更新に失敗したかも…時間をおいてもう一度試してみて。");
  } finally {
    setReactBusyId(null);
  }
}


  return (
    <>
      {/* 右上トグル */}
      <div
        style={{
          position: "fixed",
          top: "calc(env(safe-area-inset-top, 0px) + 10px)",
          right: "max(12px, env(safe-area-inset-right, 0px))",
          zIndex: 10001,
          pointerEvents: "auto",
        }}
      >
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
          {/* Private */}
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

          {/* Public */}
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
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "999px",
                background: "#2563eb",
              }}
            />
            Public
          </div>
        </div>
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
              setFlyTo({
                lat: p.lat,
                lng: p.lng,
                zoom: p.zoom ?? 15,
              });
              if (p.id) setSelectedId(p.id); // ← placeKey が入ってくる
            }}
          />
        </div>
      </div>

      {/* マップ本体 */}
      <MapView
        places={places}
        onRequestNew={() => {
          alert("公開マップでは投稿できんよ。自分のマップ（Private）で投稿してね。");
        }}
        onSelect={(p) => setSelectedId(p.id)} // ← placeKey
        selectedId={selectedId}
        flyTo={flyTo}
        bindGetView={(fn) => {
          getViewRef.current = fn;
        }}
        bindSetView={(fn) => {
          setViewRef.current = fn;
        }}
        initialView={initialView}
      />

      {/* 下パネル：同じ場所の投稿を全部（スクロール） */}
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
          {/* タイトル（場所） */}
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
              title={selectedTitle || "無題"}
            >
              {selectedTitle || "無題"}（{selectedPosts.length}件）
            </div>
          </div>

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

                {/* リアクションボタン（3つ） */}
                <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                  {/* いいね */}
                  <button
                    type="button"
                    disabled={reactBusyId === `${post.id}:like`}
                    onClick={() => toggleReaction(post.id, "like")}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 999,
                      border: post.likedByMe ? "1px solid #f97316" : "1px solid #fed7aa",
                      background: post.likedByMe ? "#f97316" : "#fff7ed",
                      color: post.likedByMe ? "#fff" : "#9a3412",
                      fontSize: 12,
                      cursor: reactBusyId === `${post.id}:like` ? "default" : "pointer",
                    }}
                  >
                    ❤️ いいね（{post.likeCount ?? 0}）
                  </button>

                  {/* 行きたい！ */}
                  <button
                    type="button"
                    disabled={reactBusyId === `${post.id}:want`}
                    onClick={() => toggleReaction(post.id, "want")}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 999,
                      border: post.wantedByMe ? "1px solid #fbbf24" : "1px solid #fef3c7",
                      background: post.wantedByMe ? "#fbbf24" : "#fffbeb",
                      color: post.wantedByMe ? "#78350f" : "#92400e",
                      fontSize: 12,
                      cursor: reactBusyId === `${post.id}:want` ? "default" : "pointer",
                    }}
                  >
                    ⭐ 行きたい！（{post.wantCount ?? 0}）
                  </button>

                  {/* 行った！ */}
                  <button
                    type="button"
                    disabled={reactBusyId === `${post.id}:visited`}
                    onClick={() => toggleReaction(post.id, "visited")}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 999,
                      border: post.visitedByMe ? "1px solid #10b981" : "1px solid #d1fae5",
                      background: post.visitedByMe ? "#10b981" : "#ecfdf5",
                      color: post.visitedByMe ? "#ecfdf5" : "#065f46",
                      fontSize: 12,
                      cursor: reactBusyId === `${post.id}:visited` ? "default" : "pointer",
                    }}
                  >
                    ✓ 行った！（{post.visitedCount ?? 0}）
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
                      style={{
                        width: "100%",
                        height: "22vh",
                        objectFit: "cover",
                        borderRadius: 10,
                        border: "1px solid #eee",
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
    </>
  );
}
