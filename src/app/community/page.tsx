"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type FeedPost = {
  id: string;
  title: string | null;
  memo: string | null;
  created_by_name?: string | null;
  created_at?: string | null;
  photos: string[];
  likeCount: number;
  likedByMe: boolean;
};

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function CommunityPage() {
  const router = useRouter();

  const [q, setQ] = useState("");
  const dq = useDebounced(q, 300);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null); // created_at cursor
  const [hasMore, setHasMore] = useState(true);

  const [uid, setUid] = useState<string | null>(null);
  const busyRef = useRef<Set<string>>(new Set()); // postId:like

  useEffect(() => {
    (async () => {
      const { data: ses } = await supabase.auth.getSession();
      setUid(ses.session?.user.id ?? null);
    })();
  }, []);

  async function loadFirst() {
    setPosts([]);
    setCursor(null);
    setHasMore(true);
    await loadMore(true);
  }

  async function loadMore(isFirst = false) {
    if (loading) return;
    if (!hasMore && !isFirst) return;

    setLoading(true);
    setErr(null);

    try {
      const pageSize = 20;

      // 1) places（public）を新しい順
      let query = supabase
        .from("places")
        .select("id, title, memo, created_by_name, created_at, lat, lng, visibility")
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(pageSize);

      if (cursor) {
        query = query.lt("created_at", cursor);
      }

      // 2) キーワード検索（雑に OR ilike）
      const kw = dq.trim();
      if (kw) {
        // OR: title / memo / created_by_name
        query = query.or(
          `title.ilike.%${kw}%,memo.ilike.%${kw}%,created_by_name.ilike.%${kw}%`
        );
      }

   

      // 5) const { data, error } = await supabase.rpc("public_feed", {
  q: dq.trim() || null,
  cursor: cursor || null,
  page_size: 20,
  viewer: uid || null,
});
if (error) throw error;

const rows = (data ?? []) as any[];
if (rows.length === 0) {
  setHasMore(false);
  return;
}

const nextCursor = rows[rows.length - 1]?.created_at ?? null;

const page = rows.map((r: any) => ({
  id: r.id,
  title: r.title ?? null,
  memo: r.memo ?? null,
  created_by_name: r.created_by_name ?? "名無しの旅人",
  created_at: r.created_at ?? null,
  photos: (r.photo_urls ?? []).slice(0, 4), // ★最大4枚に制限（軽量化）
  likeCount: Number(r.like_count ?? 0),
  likedByMe: !!r.liked_by_me,
}));

setPosts((prev) => [...prev, ...page]);
setCursor(nextCursor);
if (rows.length < 20) setHasMore(false);
画面用に整形
      const page: FeedPost[] = rows.map((r) => {
        const lk = likeByPost[r.id] ?? { count: 0, likedByMe: false };
        return {
          id: r.id,
          title: r.title ?? null,
          memo: r.memo ?? null,
          created_by_name: r.created_by_name ?? "名無しの旅人",
          created_at: r.created_at ?? null,
          photos: photosBy[r.id] ?? [],
          likeCount: lk.count,
          likedByMe: lk.likedByMe,
        };
      });

      setPosts((prev) => [...prev, ...page]);
      setCursor(nextCursor);
      if (rows.length < pageSize) setHasMore(false);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // 検索語が変わったら最初から
    loadFirst();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq]);

  async function toggleLike(postId: string) {
    if (!uid) return alert("いいねはログインが必要じゃよ。");

    const key = `${postId}:like`;
    if (busyRef.current.has(key)) return;
    busyRef.current.add(key);

    // 楽観更新
    setPosts((prev) =>
      prev.map((p) =>
        p.id !== postId
          ? p
          : {
              ...p,
              likedByMe: !p.likedByMe,
              likeCount: Math.max(0, p.likeCount + (p.likedByMe ? -1 : 1)),
            }
      )
    );

    try {
      const target = posts.find((p) => p.id === postId);
      const already = !!target?.likedByMe;

      if (already) {
        const { error } = await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", uid);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("post_likes")
          .insert({ post_id: postId, user_id: uid });
        if (error) throw error;
      }
    } catch (e) {
      console.error(e);
      alert("いいね更新に失敗したかも…");
      // 失敗したら取り消し（雑だけど安全）
      setPosts((prev) =>
        prev.map((p) =>
          p.id !== postId
            ? p
            : {
                ...p,
                likedByMe: !p.likedByMe,
                likeCount: Math.max(0, p.likeCount + (p.likedByMe ? -1 : 1)),
              }
        )
      );
    } finally {
      busyRef.current.delete(key);
    }
  }

  const headerSub = useMemo(() => {
    if (!dq.trim()) return "最新の公開投稿";
    return `「${dq.trim()}」で検索中`;
  }, [dq]);

  return (
    <div
      style={{
        minHeight: "100svh",
        background: "linear-gradient(135deg, #05070c, #0b1220, #060a12)",
        color: "#f8fafc",
        padding: 16,
      }}
    >
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        {/* Top */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <button
            onClick={() => router.back()}
            style={{
              border: "1px solid rgba(148,163,184,0.25)",
              background: "rgba(2,6,23,0.35)",
              color: "#e2e8f0",
              padding: "8px 10px",
              borderRadius: 10,
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            ← 戻る
          </button>
          <div style={{ fontSize: 12, color: "rgba(226,232,240,0.55)" }}>Community</div>
        </div>

        {/* Hero */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: -0.2 }}>みんなの投稿</div>
          <div style={{ marginTop: 6, color: "rgba(226,232,240,0.7)", fontSize: 13 }}>{headerSub}</div>

          {/* Search */}
          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="キーワード（場所名・メモ・投稿者名）"
              style={{
                flex: 1,
                minWidth: 240,
                borderRadius: 12,
                border: "1px solid rgba(148,163,184,0.25)",
                background: "rgba(2,6,23,0.35)",
                color: "#e2e8f0",
                padding: "10px 12px",
                outline: "none",
              }}
            />
            <button
              onClick={() => {
                setQ("");
              }}
              style={{
                borderRadius: 12,
                border: "1px solid rgba(148,163,184,0.25)",
                background: "rgba(2,6,23,0.35)",
                color: "#e2e8f0",
                padding: "10px 12px",
                cursor: "pointer",
                fontWeight: 800,
              }}
            >
              クリア
            </button>
          </div>
        </div>

        {/* Error */}
        {err && (
          <div
            style={{
              marginTop: 12,
              background: "rgba(127,29,29,0.75)",
              border: "1px solid rgba(248,113,113,0.35)",
              padding: "10px 12px",
              borderRadius: 12,
              fontSize: 12,
            }}
          >
            読み込み失敗：{err}
          </div>
        )}

        {/* Feed */}
        <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
          {posts.map((p) => (
            <div
              key={p.id}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(148,163,184,0.18)",
                borderRadius: 16,
                padding: 12,
                boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
              }}
            >
              {/* meta */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.title || "無題"}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(226,232,240,0.6)", marginTop: 2 }}>
                    {p.created_by_name || "名無しの旅人"}
                    {p.created_at ? ` ・${new Date(p.created_at).toLocaleDateString("ja-JP")}` : ""}
                  </div>
                </div>

                <button
                  onClick={() => toggleLike(p.id)}
                  style={{
                    borderRadius: 999,
                    border: p.likedByMe ? "1px solid rgba(251,113,133,0.7)" : "1px solid rgba(148,163,184,0.25)",
                    background: p.likedByMe ? "linear-gradient(180deg, rgba(251,113,133,0.9), rgba(244,63,94,0.9))" : "rgba(2,6,23,0.35)",
                    color: "#fff",
                    padding: "8px 12px",
                    cursor: "pointer",
                    fontWeight: 900,
                    fontSize: 12,
                    whiteSpace: "nowrap",
                  }}
                  title={uid ? "いいね" : "ログインが必要"}
                >
                  ❤️ {p.likeCount}
                </button>
              </div>

              {/* memo */}
              <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.55, color: "rgba(248,250,252,0.9)", whiteSpace: "pre-wrap" }}>
                {p.memo || "（メモなし）"}
              </div>

              {/* photos */}
              <div style={{ marginTop: 10 }}>
                {p.photos.length === 0 ? (
                  <div style={{ fontSize: 12, color: "rgba(226,232,240,0.55)" }}>写真なし</div>
                ) : (
                  <>
                    <img
                      src={p.photos[0]}
                      alt=""
                      style={{
                        width: "100%",
                        height: 260,
                        objectFit: "cover",
                        borderRadius: 14,
                        border: "1px solid rgba(148,163,184,0.18)",
                      }}
                      loading="lazy"
                    />
                    {p.photos.length > 1 && (
                      <div style={{ display: "flex", gap: 8, marginTop: 8, overflowX: "auto", paddingBottom: 4 }}>
                        {p.photos.slice(1).map((u) => (
                          <img
                            key={u}
                            src={u}
                            alt=""
                            style={{
                              width: 120,
                              height: 84,
                              objectFit: "cover",
                              borderRadius: 12,
                              border: "1px solid rgba(148,163,184,0.18)",
                              flex: "0 0 auto",
                            }}
                            loading="lazy"
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* More */}
        <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>
          {hasMore ? (
            <button
              onClick={() => loadMore(false)}
              disabled={loading}
              style={{
                borderRadius: 14,
                border: "1px solid rgba(148,163,184,0.25)",
                background: "rgba(2,6,23,0.35)",
                color: "#e2e8f0",
                padding: "10px 14px",
                cursor: loading ? "default" : "pointer",
                fontWeight: 900,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "読み込み中…" : "もっと見る"}
            </button>
          ) : (
            <div style={{ fontSize: 12, color: "rgba(226,232,240,0.55)", padding: 10 }}>ここまで</div>
          )}
        </div>
      </div>
    </div>
  );
}
