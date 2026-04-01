"use client";

import { useMemo, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ensureMySpace } from "@/lib/ensureMySpace";

type ListRow = {
  id: string;
  title: string | null;
  memo: string | null;
  ai_summary: string | null;
  status: "wishlist" | "visited";
  lat: number;
  lng: number;
  created_at: string;
  photos: string[];
  place_category_id: string | null;
};

type CategoryRow = {
  id: string;
  name: string;
};

const MAX_CATEGORY_COUNT = 20;

export default function WishlistListPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ListRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [tab, setTab] = useState<"wishlist" | "visited">("wishlist");
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);

  useEffect(() => {
    (async () => {
      const mySpace = await ensureMySpace();
      if (!mySpace?.id) return;
      setSpaceId(mySpace.id);

      const { data: categoryRows, error: categoryError } = await supabase
        .from("place_categories")
        .select("id,name")
        .eq("space_id", mySpace.id)
        .order("created_at", { ascending: true });
      if (categoryError) throw categoryError;
      setCategories((categoryRows ?? []) as CategoryRow[]);

      const { data: places, error } = await supabase
        .from("places")
        .select("id,title,memo,ai_summary,status,lat,lng,created_at,place_category_id")
        .eq("space_id", mySpace.id)
        .eq("visibility", "private")
        .in("status", ["wishlist", "visited"])
        .order("created_at", { ascending: false });
      if (error) throw error;

      const ids = (places ?? []).map((p: any) => p.id);
      const photosBy: Record<string, string[]> = {};
      if (ids.length > 0) {
        const { data: phs } = await supabase.from("photos").select("place_id,file_url").in("place_id", ids);
        for (const ph of phs ?? []) {
          const pid = (ph as any).place_id as string;
          const url = (ph as any).file_url as string;
          (photosBy[pid] ||= []).push(url);
        }
      }

      setRows(
        ((places ?? []) as any[]).map((p) => ({
          ...p,
          status: (p.status ?? ((photosBy[p.id] ?? []).length > 0 ? "visited" : "wishlist")) as "wishlist" | "visited",
          photos: photosBy[p.id] ?? [],
        }))
      );
    })().catch((e) => {
      console.error(e);
      alert("一覧の読み込みに失敗しました");
    });
  }, []);

  const filtered = useMemo(() => rows.filter((r) => r.status === tab), [rows, tab]);
  const rowsByCategory = useMemo(() => {
    return categories
      .map((category) => ({
        category,
        count: rows.filter((r) => r.place_category_id === category.id && r.status === "wishlist").length,
      }))
      .filter((x) => x.count > 0);
  }, [categories, rows]);

  const createCategory = async () => {
    if (!spaceId) return;
    if (categories.length >= MAX_CATEGORY_COUNT) {
      alert(`カテゴリーは最大${MAX_CATEGORY_COUNT}件までです。`);
      return;
    }
    const name = prompt("新しいカテゴリー名を入力してください（40文字まで）")?.trim();
    if (!name) return;

    if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      alert("同じカテゴリー名がすでにあります。");
      return;
    }

    setCreatingCategory(true);
    try {
      const { data, error } = await supabase
        .from("place_categories")
        .insert({ space_id: spaceId, name })
        .select("id,name")
        .single();
      if (error) throw error;
      setCategories((prev) => [...prev, data as CategoryRow]);
    } catch (e) {
      console.error(e);
      alert("カテゴリーの作成に失敗しました。");
    } finally {
      setCreatingCategory(false);
    }
  };

  const updatePlaceCategory = async (placeId: string, placeCategoryId: string | null) => {
    const previous = rows;
    setRows((prev) => prev.map((r) => (r.id === placeId ? { ...r, place_category_id: placeCategoryId } : r)));
    const { error } = await supabase.from("places").update({ place_category_id: placeCategoryId }).eq("id", placeId);
    if (error) {
      setRows(previous);
      alert("カテゴリーの更新に失敗しました。");
    }
  };

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "18px 14px 100px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 900 }}>行きたい場所リスト</h1>
      <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button
          onClick={createCategory}
          disabled={creatingCategory || categories.length >= MAX_CATEGORY_COUNT}
          style={{ border: "1px solid #111827", borderRadius: 999, padding: "8px 12px", background: "#fff", cursor: "pointer", fontWeight: 700 }}
        >
          カテゴリーをつくる
        </button>
        <span style={{ fontSize: 12, color: "#6b7280" }}>
          {categories.length}/{MAX_CATEGORY_COUNT}
        </span>
      </div>

      {rowsByCategory.length > 0 && (
        <section style={{ marginTop: 12, border: "1px solid #e5e7eb", borderRadius: 12, padding: 10 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>カテゴリー別マップURL</div>
          <div style={{ display: "grid", gap: 6 }}>
            {rowsByCategory.map(({ category, count }) => (
              <button
                key={category.id}
                onClick={() => router.push(`/?category=${category.id}&titles=1`)}
                style={{ border: "1px solid #d1d5db", borderRadius: 10, background: "#fff", textAlign: "left", padding: "8px 10px", cursor: "pointer" }}
              >
                ⭐ {category.name}（{count}件）だけを地図で表示
              </button>
            ))}
          </div>
        </section>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 12, marginBottom: 14 }}>
        <button onClick={() => setTab("wishlist")} style={chip(tab === "wishlist")}>⭐ 行きたい</button>
        <button onClick={() => setTab("visited")} style={chip(tab === "visited")}>📷 行った</button>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {filtered.map((r) => (
          <article key={r.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, display: "grid", gridTemplateColumns: "84px 1fr", gap: 10 }}>
            <div style={{ width: 84, height: 84, borderRadius: 8, overflow: "hidden", background: "#f3f4f6", display: "grid", placeItems: "center" }}>
              {r.photos[0] ? <img src={r.photos[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span>{r.status === "wishlist" ? "⭐" : "📷"}</span>}
            </div>
            <div>
              <div style={{ fontWeight: 800 }}>{r.title || "無題"}</div>
              <div style={{ fontSize: 12, color: "#4b5563", marginTop: 4 }}>{r.ai_summary || r.memo || "（メモなし）"}</div>
              <div style={{ marginTop: 8 }}>
                <select
                  value={r.place_category_id ?? ""}
                  onChange={(e) => updatePlaceCategory(r.id, e.target.value || null)}
                  style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "6px 8px", background: "#fff" }}
                >
                  <option value="">カテゴリー未設定</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <span style={{ fontSize: 12 }}>{r.status === "wishlist" ? "⭐ wishlist" : "📷 visited"}</span>
                <button
                  style={{ border: "1px solid #d1d5db", borderRadius: 999, padding: "6px 10px", background: "#fff", cursor: "pointer" }}
                  onClick={() => router.push(`/?focus=${r.id}&open=1&lat=${r.lat}&lng=${r.lng}`)}
                >
                  地図へ飛ぶ
                </button>
              </div>
            </div>
          </article>
        ))}
        {filtered.length === 0 && <div style={{ color: "#6b7280" }}>まだありません。</div>}
      </div>
    </main>
  );
}

function chip(active: boolean): React.CSSProperties {
  return {
    border: active ? "1px solid #111827" : "1px solid #d1d5db",
    background: active ? "#111827" : "#fff",
    color: active ? "#fff" : "#111827",
    borderRadius: 999,
    padding: "8px 12px",
    fontWeight: 800,
    cursor: "pointer",
  };
}
