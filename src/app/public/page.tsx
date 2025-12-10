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
  likedByMe?: boolean;
  wantedByMe?: boolean;
  visitedByMe?: boolean;
　visitedCount?: number; 
};

export default function PublicPage() {
  const router = useRouter();

  const [places, setPlaces] = useState<PublicPlace[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [initialView, setInitialView] = useState<View | undefined>(undefined);

  const [reactBusyId, setReactBusyId] = useState<string | null>(null);

  const getViewRef = useRef<() => View>(() => ({ lat: 35.68, lng: 139.76, zoom: 4 }));
  const setViewRef = useRef<(v: View) => void>(() => {});

  // -------------------------------------------------------
  // 公開投稿の読み込み（写真 & リアクション込み）
  // -------------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        // ログインユーザー（自分のリアクション判定用）
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

        // 写真まとめて取得
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

              // リアクションをまとめて取得
        type ReactionRow = {
          place_id: string;
          user_id: string;
          kind: "like" | "want" | "visited"; // ← visited 追加
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

        // 🔥 MapView 用の拡張データに整形
        setPlaces(
          (rows ?? []).map((p: any) => {
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
              id: p.id,
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
              likedByMe: react.likedByMe,
              wantedByMe: react.wantedByMe,
              visitedByMe: react.visitedByMe, // ← ここが MapView に飛んでいく
            } as PublicPlace;
          })
        );
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // 選択中の投稿
  const selected = useMemo(
    () => places.find((x) => x.id === selectedId) || null,
    [places, selectedId]
  );

  // -------------------------------------------------------
  // いいね / 行きたい！のトグル処理
  // -------------------------------------------------------
  async function toggleReaction(placeId: string, kind: "like" | "want") {
    try {
      setReactBusyId(`${placeId}:${kind}`);

      const { data: ses } = await supabase.auth.getSession();
      const uid = ses.session?.user.id;
      if (!uid) {
        alert("リアクションするにはログインが必要じゃよ。");
        return;
      }

      const target = places.find((p) => p.id === placeId);
      if (!target) return;

      const already = kind === "like" ? target.likedByMe : target.wantedByMe;

      if (already) {
        // すでに押している → 取り消し
        const { error } = await supabase
          .from("place_reactions")
          .delete()
          .eq("place_id", placeId)
          .eq("user_id", uid)
          .eq("kind", kind);

        if (error) throw error;

        setPlaces((prev) =>
          prev.map((p) =>
            p.id !== placeId
              ? p
              : {
                  ...p,
                  likeCount:
                    kind === "like"
                      ? Math.max(0, (p.likeCount ?? 0) - 1)
                      : p.likeCount,
                  wantCount:
                    kind === "want"
                      ? Math.max(0, (p.wantCount ?? 0) - 1)
                      : p.wantCount,
                  likedByMe: kind === "like" ? false : p.likedByMe,
                  wantedByMe: kind === "want" ? false : p.wantedByMe,
                }
          )
        );
      } else {
        // まだ押してない → 追加
        const { error } = await supabase
          .from("place_reactions")
          .insert({
            place_id: placeId,
            user_id: uid,
            kind,
          });

        if (error) throw error;

        setPlaces((prev) =>
          prev.map((p) =>
            p.id !== placeId
              ? p
              : {
                  ...p,
                  likeCount:
                    kind === "like" ? (p.likeCount ?? 0) + 1 : p.likeCount,
                  wantCount:
                    kind === "want" ? (p.wantCount ?? 0) + 1 : p.wantCount,
                  likedByMe: kind === "like" ? true : p.likedByMe,
                  wantedByMe: kind === "want" ? true : p.wantedByMe,
                }
          )
        );
      }
    } catch (e) {
      console.error(e);
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
              if (p.id) setSelectedId(p.id);
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
      />

      {/* 下プレビュー */}
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
        >
          {/* タイトル */}
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

          {/* 投稿者 + 投稿日時 */}
          <div
            style={{
              fontSize: 11,
              color: "#6b7280",
              textAlign: "center",
              marginTop: 4,
            }}
          >
            {selected.createdByName}{" "}
            {selected.createdAt &&
              `・${selected.createdAt.toLocaleDateString("ja-JP")}`}
          </div>

          {/* リアクションボタン */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 8,
              marginTop: 6,
              flexWrap: "wrap",
            }}
          >
            {/* いいね */}
            <button
              type="button"
              disabled={reactBusyId === `${selected.id}:like`}
              onClick={() => toggleReaction(selected.id, "like")}
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                border: selected.likedByMe
                  ? "1px solid #f97316"
                  : "1px solid #fed7aa",
                background: selected.likedByMe ? "#f97316" : "#fff7ed",
                color: selected.likedByMe ? "#fff" : "#9a3412",
                fontSize: 12,
                cursor:
                  reactBusyId === `${selected.id}:like`
                    ? "default"
                    : "pointer",
              }}
            >
              ❤️ いいね（{selected.likeCount ?? 0}）
            </button>

            {/* 行きたい！ */}
            <button
              type="button"
              disabled={reactBusyId === `${selected.id}:want`}
              onClick={() => toggleReaction(selected.id, "want")}
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                border: selected.wantedByMe
                  ? "1px solid #22c55e"
                  : "1px solid #bbf7d0",
                background: selected.wantedByMe ? "#22c55e" : "#f0fdf4",
                color: selected.wantedByMe ? "#022c22" : "#15803d",
                fontSize: 12,
                cursor:
                  reactBusyId === `${selected.id}:want`
                    ? "default"
                    : "pointer",
              }}
            >
              ✈ 行きたい！（{selected.wantCount ?? 0}）
            </button>
          </div>

          {/* メモ */}
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

          {/* 写真一覧 */}
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
              <div style={{ fontSize: 12, color: "#9ca3af" }}>
                写真はまだありません
              </div>
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
    </>
  );
}
