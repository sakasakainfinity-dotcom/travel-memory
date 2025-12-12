// src/lib/groupByPlace.ts

export type PostRow = {
  id: string;
  title: string | null;
  memo: string | null;
  lat: number;
  lng: number;
  thumbnail: string | null;
  user_name?: string | null;
  created_at?: string | null;
};

export type PlaceGroup = {
  key: string;
  lat: number;
  lng: number;
  title: string | null;
  postCount: number;
  posts: PostRow[];
};

/** タイトル＋座標（小数4桁 ≈ 11m）で場所キー化 */
export function makePlaceKey(title: string | null, lat: number, lng: number) {
  const normTitle = (title ?? "").replace(/\s+/g, "").toLowerCase();
  const r = (n: number) => Math.round(n * 1e4) / 1e4;
  return `${normTitle}|${r(lat)}|${r(lng)}`;
}

/** 生の投稿一覧 → 場所ごとグループ化 */
export function groupByPlace(rows: PostRow[]): PlaceGroup[] {
  const map = new Map<string, PlaceGroup>();

  for (const row of rows) {
    const key = makePlaceKey(row.title, row.lat, row.lng);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        lat: row.lat,
        lng: row.lng,
        title: row.title,
        postCount: 1,
        posts: [row],
      });
    } else {
      existing.postCount += 1;
      existing.posts.push(row);
    }
  }

  // ルール：投稿は新しい順
  for (const g of map.values()) {
    g.posts.sort((a, b) => {
      const ad = a.created_at ?? "";
      const bd = b.created_at ?? "";
      return ad < bd ? 1 : ad > bd ? -1 : 0;
    });
  }

  return Array.from(map.values());
}
