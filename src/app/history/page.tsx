'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { ensureMySpace } from '@/lib/ensureMySpace';

type Row = { id: string; title: string | null; memo: string | null; lat: number; lng: number; photos: string[] };

export default function HistoryPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const sp = await ensureMySpace();
        if (!sp?.id) return;
        const { data: ps } = await supabase
          .from('places')
          .select('id, title, memo, lat, lng, created_at')
          .eq('space_id', sp.id)
          .order('created_at', { ascending: false });

        const ids = (ps ?? []).map((p) => p.id);

// ★ 外側で1回だけ宣言（ここを残す！）
let photosBy: Record<string, string[]> = {};

if (ids.length > 0) {
  const { data: phs, error: ePh } = await supabase
    .from('photos')
    .select('place_id, file_url, created_at')
    .in('place_id', ids)
    .order('created_at', { ascending: false }); // 新しい順（1枚目=最新）

  if (!ePh) {
    for (const ph of (phs ?? []) as { place_id: string; file_url: string }[]) {
      (photosBy[ph.place_id] ||= []).push(ph.file_url);
    }
  }
}

// ↓ ここで外側の photosBy を使う（再宣言しない！）
　　　　　setItems(
　　　　　  (ps ?? []).map((p) => ({
  　　　　  id: p.id,
   　　　　 title: p.title,
   　　　　 memo: p.memo,
   　　　　 lat: p.lat,
   　　　　 lng: p.lng,
   　　　　 photos: photosBy[p.id] ?? [],  // ← サムネは photos[0]
　　　　  }))
　　　　);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div style={{ padding: 16 }}>読み込み中…</div>;

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '16px 12px 80px' }}>
      <h1 style={{ fontWeight: 900, fontSize: 20, marginBottom: 12 }}>投稿履歴</h1>
      {items.length === 0 && <div style={{ color: '#6b7280' }}>まだ投稿がありません</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 12 }}>
        {items.map((it) => (
          <article key={it.id} style={{ border: '1px solid #eee', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
            {it.photos[0] ? (
              <img src={it.photos[0]} alt="" style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
            ) : (
              <div style={{ height: 160, background: '#f3f4f6', display: 'grid', placeItems: 'center', color: '#9ca3af' }}>No photo</div>
            )}
            <div style={{ padding: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {it.title || '無題'}
              </div>
              <div style={{ marginTop: 6, fontSize: 13, color: '#6b7280', height: 40, overflow: 'hidden' }}>
                {it.memo || '（メモなし）'}
              </div>
              <Link href={`/?focus=${it.id}`} style={{ display: 'inline-block', marginTop: 8, fontWeight: 700 }}>
                地図で見る →
              </Link>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
