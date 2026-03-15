// src/app/history/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { ensureMySpace } from "@/lib/ensureMySpace";
import { useRouter } from "next/navigation";

type Row = {
  id: string;
  title: string | null;
  memo: string | null;
  lat: number;
  lng: number;
  thumbnail: string | null;
};

type SpotCollectionRow = {
  id: string;
  title: string;
  description: string | null;
  share_slug: string;
  items: Row[];
};

function makePlaceKey(title: string | null, lat: number, lng: number) {
  const normTitle = (title ?? "").replace(/\s+/g, "").toLowerCase();
  const r = (n: number) => Math.round(n * 1e4) / 1e4;
  return `${normTitle}|${r(lat)}|${r(lng)}`;
}

function shortText(t?: string | null) {
  if (!t) return "";
  return t.length > 70 ? `${t.slice(0, 70)}…` : t;
}

export default function HistoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<Row[]>([]);
  const [publicItems, setPublicItems] = useState<Row[]>([]);
  const [collections, setCollections] = useState<SpotCollectionRow[]>([]);
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [collectionLoading, setCollectionLoading] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<string[]>([]);
  const [savingCollection, setSavingCollection] = useState(false);
  const [collectionError, setCollectionError] = useState<string | null>(null);

  const publicMap = useMemo(() => {
    const m: Record<string, Row> = {};
    for (const p of publicItems) m[p.id] = p;
    return m;
  }, [publicItems]);

  async function loadCollections(userId: string) {
    setCollectionLoading(true);
    try {
      const { data: cs, error: cErr } = await supabase
        .from("spot_collections")
        .select("id, title, description, share_slug")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (cErr) throw cErr;
      const cols = (cs ?? []) as { id: string; title: string; description: string | null; share_slug: string }[];
      if (cols.length === 0) {
        setCollections([]);
        return;
      }

      const collectionIds = cols.map((c) => c.id);
      const { data: itRows, error: iErr } = await supabase
        .from("spot_collection_items")
        .select("collection_id, place_id, sort_order")
        .in("collection_id", collectionIds)
        .order("sort_order", { ascending: true });

      if (iErr) throw iErr;
      const itemsRaw = (itRows ?? []) as { collection_id: string; place_id: string; sort_order: number }[];
      const placeIds = Array.from(new Set(itemsRaw.map((x) => x.place_id)));

      const rowById: Record<string, Row> = {};
      if (placeIds.length > 0) {
        const { data: places, error: pErr } = await supabase
          .from("places")
          .select("id, title, memo, lat, lng, visibility")
          .in("id", placeIds);
        if (pErr) throw pErr;

        const existingIds = (places ?? []).map((p: any) => p.id);
        const thumbBy: Record<string, string> = {};
        if (existingIds.length > 0) {
          const { data: phs, error: phErr } = await supabase
            .from("photos")
            .select("place_id, file_url, created_at")
            .in("place_id", existingIds)
            .order("created_at", { ascending: true });
          if (!phErr && phs) {
            for (const ph of phs as { place_id: string; file_url: string }[]) {
              if (!thumbBy[ph.place_id]) thumbBy[ph.place_id] = ph.file_url;
            }
          }
        }

        for (const p of places ?? []) {
          const row = p as any;
          if (row.visibility !== "public") continue;
          rowById[row.id] = {
            id: row.id,
            title: row.title,
            memo: row.memo,
            lat: row.lat,
            lng: row.lng,
            thumbnail: thumbBy[row.id] ?? null,
          };
        }
      }

      const grouped: Record<string, Row[]> = {};
      for (const it of itemsRaw) {
        const row = rowById[it.place_id];
        if (!row) continue;
        (grouped[it.collection_id] ||= []).push(row);
      }

      setCollections(
        cols.map((c) => ({
          id: c.id,
          title: c.title,
          description: c.description,
          share_slug: c.share_slug,
          items: grouped[c.id] ?? [],
        }))
      );
    } catch (e) {
      console.error(e);
      setCollections([]);
    } finally {
      setCollectionLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const { data: ses } = await supabase.auth.getSession();
        const userId = ses.session?.user?.id ?? null;
        setUid(userId);

        const sp = await ensureMySpace();
        if (!sp?.id) {
          setItems([]);
          return;
        }

        // 場所を新しい順で取得
        const { data: ps, error: ePlaces } = await supabase
          .from("places")
          .select("id, title, memo, lat, lng, created_at")
          .eq("space_id", sp.id)
          .order("created_at", { ascending: false });

        if (ePlaces || !ps) {
          console.error(ePlaces);
          setItems([]);
          return;
        }

        const seen = new Set<string>();
        const uniq: any[] = [];
        for (const p of ps) {
          const key = makePlaceKey(p.title, p.lat, p.lng);
          if (seen.has(key)) continue;
          seen.add(key);
          uniq.push(p);
        }

        const ids = uniq.map((p) => p.id);
        const thumbBy: Record<string, string> = {};
        if (ids.length > 0) {
          const { data: phs } = await supabase
            .from("photos")
            .select("place_id, file_url, created_at")
            .in("place_id", ids)
            .order("created_at", { ascending: true });

          for (const ph of (phs ?? []) as { place_id: string; file_url: string }[]) {
            if (!thumbBy[ph.place_id]) thumbBy[ph.place_id] = ph.file_url;
          }
        }

        setItems(
          uniq.map((p) => ({
            id: p.id,
            title: p.title,
            memo: p.memo,
            lat: p.lat,
            lng: p.lng,
            thumbnail: thumbBy[p.id] ?? null,
          }))
        );

        if (userId) {
          const { data: pubs, error: pubErr } = await supabase
            .from("places")
            .select("id, title, memo, lat, lng, created_at")
            .eq("created_by", userId)
            .eq("visibility", "public")
            .order("created_at", { ascending: false });
          if (pubErr) throw pubErr;

          const pubIds = (pubs ?? []).map((p: any) => p.id);
          const thumbByPub: Record<string, string> = {};
          if (pubIds.length > 0) {
            const { data: pubPhs } = await supabase
              .from("photos")
              .select("place_id, file_url, created_at")
              .in("place_id", pubIds)
              .order("created_at", { ascending: true });
            for (const ph of (pubPhs ?? []) as { place_id: string; file_url: string }[]) {
              if (!thumbByPub[ph.place_id]) thumbByPub[ph.place_id] = ph.file_url;
            }
          }

          setPublicItems(
            ((pubs ?? []) as any[]).map((p) => ({
              id: p.id,
              title: p.title,
              memo: p.memo,
              lat: p.lat,
              lng: p.lng,
              thumbnail: thumbByPub[p.id] ?? null,
            }))
          );

          await loadCollections(userId);
        }
      } catch (err) {
        console.error(err);
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function openCreate() {
    setEditingCollectionId(null);
    setTitle("");
    setDescription("");
    setSelectedPlaceIds([]);
    setCollectionError(null);
    setEditorOpen(true);
  }

  function openEdit(c: SpotCollectionRow) {
    setEditingCollectionId(c.id);
    setTitle(c.title);
    setDescription(c.description ?? "");
    setSelectedPlaceIds(c.items.map((x) => x.id));
    setCollectionError(null);
    setEditorOpen(true);
  }

  function togglePlace(placeId: string, checked: boolean) {
    setSelectedPlaceIds((prev) => {
      if (checked) {
        if (prev.includes(placeId)) return prev;
        if (prev.length >= 20) {
          setCollectionError("1つのスポットまとめに入れられるのは最大20件です。");
          return prev;
        }
        setCollectionError(null);
        return [...prev, placeId];
      }
      return prev.filter((id) => id !== placeId);
    });
  }

  function moveSelected(placeId: string, dir: -1 | 1) {
    setSelectedPlaceIds((prev) => {
      const idx = prev.indexOf(placeId);
      if (idx < 0) return prev;
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const copied = [...prev];
      [copied[idx], copied[next]] = [copied[next], copied[idx]];
      return copied;
    });
  }

  async function saveCollection() {
    if (!uid) {
      setCollectionError("ログイン状態を確認できませんでした。");
      return;
    }
    if (!title.trim()) {
      setCollectionError("タイトルは必須です。");
      return;
    }
    if (selectedPlaceIds.length === 0) {
      setCollectionError("投稿を1件以上選択してください。");
      return;
    }
    if (selectedPlaceIds.length > 20) {
      setCollectionError("1つのスポットまとめに入れられるのは最大20件です。");
      return;
    }

    try {
      setSavingCollection(true);
      setCollectionError(null);
      let collectionId = editingCollectionId;

      if (editingCollectionId) {
        const { error } = await supabase
          .from("spot_collections")
          .update({
            title: title.trim(),
            description: description.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingCollectionId)
          .eq("user_id", uid);
        if (error) throw error;
      } else {
        const shareSlug = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
        const { data, error } = await supabase
          .from("spot_collections")
          .insert({
            user_id: uid,
            title: title.trim(),
            description: description.trim() || null,
            is_public: true,
            share_slug: shareSlug,
          })
          .select("id")
          .single();
        if (error || !data?.id) throw error ?? new Error("spot collection create failed");
        collectionId = data.id;
      }

      if (!collectionId) throw new Error("collection id missing");

      const { error: delErr } = await supabase
        .from("spot_collection_items")
        .delete()
        .eq("collection_id", collectionId);
      if (delErr) throw delErr;

      const payload = selectedPlaceIds.map((placeId, idx) => ({
        collection_id: collectionId,
        place_id: placeId,
        sort_order: idx,
      }));
      const { error: insErr } = await supabase.from("spot_collection_items").insert(payload);
      if (insErr) throw insErr;

      await loadCollections(uid);
      setEditorOpen(false);
    } catch (e: any) {
      console.error(e);
      setCollectionError(e?.message ?? "保存に失敗しました。");
    } finally {
      setSavingCollection(false);
    }
  }

  if (loading) return <div style={{ padding: 16 }}>読み込み中…</div>;

  return (
    <main style={{ padding: 16, position: "relative", minHeight: "100vh" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
        <h1 style={{ fontWeight: 900, fontSize: 20, margin: 0 }}>投稿履歴</h1>
      </div>

      {editorOpen && (
        <section style={{ border: "1px solid #dbeafe", background: "#eff6ff", borderRadius: 12, padding: 12, marginBottom: 16 }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>{editingCollectionId ? "スポットまとめを編集" : "スポットまとめを作成"}</div>
          <div style={{ display: "grid", gap: 8 }}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル（必須）" style={{ padding: 10, borderRadius: 8, border: "1px solid #bfdbfe" }} />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="説明文（任意）" rows={3} style={{ padding: 10, borderRadius: 8, border: "1px solid #bfdbfe", resize: "vertical" }} />
          </div>

          <div style={{ marginTop: 10, fontWeight: 700, fontSize: 14 }}>公開投稿を選択（{selectedPlaceIds.length}/20）</div>
          <div style={{ marginTop: 8, maxHeight: 280, overflow: "auto", display: "grid", gap: 8 }}>
            {publicItems.map((p) => {
              const checked = selectedPlaceIds.includes(p.id);
              return (
                <label key={p.id} style={{ border: "1px solid #dbeafe", borderRadius: 8, padding: 8, background: "#fff", display: "flex", gap: 8 }}>
                  <input type="checkbox" checked={checked} onChange={(e) => togglePlace(p.id, e.target.checked)} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{p.title || "無題"}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{shortText(p.memo) || "（メモなし）"}</div>
                  </div>
                </label>
              );
            })}
            {publicItems.length === 0 && <div style={{ color: "#64748b", fontSize: 13 }}>選択できる public 投稿がありません。</div>}
          </div>

          <div style={{ marginTop: 10, fontWeight: 700, fontSize: 14 }}>選択順（公開ページの表示順）</div>
          <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
            {selectedPlaceIds.map((id, idx) => {
              const row = publicMap[id];
              if (!row) return null;
              return (
                <div key={id} style={{ background: "#fff", border: "1px solid #dbeafe", borderRadius: 8, padding: "6px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{idx + 1}. {row.title || "無題"}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button type="button" onClick={() => moveSelected(id, -1)} style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}>上へ</button>
                    <button type="button" onClick={() => moveSelected(id, 1)} style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}>下へ</button>
                  </div>
                </div>
              );
            })}
          </div>

          {collectionError && <div style={{ marginTop: 8, color: "#dc2626", fontWeight: 700 }}>{collectionError}</div>}
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <button type="button" onClick={saveCollection} disabled={savingCollection} style={{ border: "none", background: "#2563eb", color: "#fff", borderRadius: 8, fontWeight: 800, padding: "8px 12px", cursor: "pointer" }}>{savingCollection ? "保存中…" : "保存する"}</button>
            <button type="button" onClick={() => setEditorOpen(false)} style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 8, fontWeight: 700, padding: "8px 12px", cursor: "pointer" }}>キャンセル</button>
          </div>
        </section>
      )}

    
      <section style={{ marginBottom: 16 }}>
        <h2 style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>あなたのスポットまとめ</h2>
        {collectionLoading ? (
          <div style={{ color: "#6b7280" }}>読み込み中…</div>
        ) : collections.length === 0 ? (
          <div style={{ color: "#6b7280" }}>まだスポットまとめがありません</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))", gap: 12 }}>
            {collections.map((c) => {
              const cover = c.items[0]?.thumbnail ?? null;
              return (
                <article key={c.id} style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
                  {cover ? (
                    <img src={cover} alt="" loading="lazy" style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }} />
                  ) : (
                    <div style={{ height: 140, background: "#f3f4f6", display: "grid", placeItems: "center", color: "#9ca3af" }}>No photo</div>
                  )}
                  <div style={{ padding: 10 }}>
                    <div style={{ fontWeight: 800 }}>{c.title}</div>
                    <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6, minHeight: 34 }}>{shortText(c.description) || "（説明なし）"}</div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{c.items.length}件</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                       <button type="button" onClick={() => router.push("/share")} style={{ border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", borderRadius: 999, padding: "6px 10px", cursor: "pointer", fontWeight: 700 }}>マイマップ共有に追加（まとめスポット）</button>
                      <a href={`/spot/${c.share_slug}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#1d4ed8", alignSelf: "center", textDecoration: "none" }}>公開ページを見る</a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {items.length === 0 && <div style={{ color: "#6b7280" }}>まだ投稿がありません</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))", gap: 12 }}>
        {items.map((it) => (
          <article key={it.id} style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
            {it.thumbnail ? (
              <img src={it.thumbnail} alt="" loading="lazy" style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }} />
            ) : (
              <div style={{ height: 160, background: "#f3f4f6", display: "grid", placeItems: "center", color: "#9ca3af" }}>No photo</div>
            )}
            <div style={{ padding: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={it.title || "無題"}>{it.title || "無題"}</div>
              <div style={{ marginTop: 6, fontSize: 13, color: "#6b7280", height: 40, overflow: "hidden" }}>{it.memo || "（メモなし）"}</div>
              <Link href={`/?focus=${it.id}&open=1&lat=${it.lat}&lng=${it.lng}`} aria-label="地図で見る" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, fontWeight: 800, textDecoration: "none", padding: "8px 12px", borderRadius: 999, border: "1px solid rgba(0,0,0,.08)", background: "rgba(255,255,255,0.85)", boxShadow: "0 6px 20px rgba(0,0,0,.08)", backdropFilter: "saturate(120%) blur(6px)" }}>
                地図で見る →
              </Link>
            </div>
          </article>
        ))}
      </div>

       <button
        type="button"
        onClick={openCreate}
        style={{
          position: "fixed",
          right: 16,
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
          zIndex: 51,
          border: "none",
          background: "linear-gradient(135deg, #10b981, #059669)",
          color: "#fff",
          borderRadius: 999,
          fontWeight: 900,
          padding: "12px 16px",
          cursor: "pointer",
          boxShadow: "0 10px 24px rgba(15,23,42,0.25)",
        }}
      >
        ＋ 共有まとめをつくる
      </button>

      <button
        type="button"
        onClick={() => router.push("/")}
        style={{ position: "fixed", left: 16, bottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)", zIndex: 50, padding: "12px 18px", borderRadius: 9999, border: "none", background: "rgba(37,99,235,0.95)", boxShadow: "0 10px 24px rgba(15,23,42,0.35)", fontSize: 14, fontWeight: 800, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
      >
        ← マップに戻る
      </button>
    </main>
  );
}
