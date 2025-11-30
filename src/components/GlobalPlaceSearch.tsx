'use client';

import { useState } from 'react';

type SearchResult = {
  id: string;
  name: string;
  fullName: string;
  lat: number;
  lng: number;
};

type Props = {
  onSelect: (result: SearchResult) => void;
};

export function GlobalPlaceSearch({ onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(value: string) {
    setQuery(value);
    setError(null);

    // 1〜2文字は検索せん（ノイズ多すぎ）
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }

    try {
      setLoading(true);

      const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(
        value.trim()
      )}.json?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY}&language=ja&limit=5`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('geocoding failed');

      const data = await res.json();

      const mapped: SearchResult[] = (data.features ?? []).map(
        (f: any, idx: number) => ({
          id: f.id ?? String(idx),
          name: f.text ?? '',
          fullName: f.place_name ?? f.text ?? '',
          lng: f.center?.[0],
          lat: f.center?.[1],
        })
      );

      setResults(mapped);
    } catch (e) {
      console.error(e);
      setError('検索に失敗しました');
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(r: SearchResult) {
    onSelect(r);
    // 選んだらリスト閉じる
    setResults([]);
    setQuery(r.fullName);
  }

  return (
    <div className="w-full max-w-xl mx-auto z-10">
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="店名・スポット名で検索（例：マクドナルド渋谷駅前店）"
        className="w-full border rounded px-3 py-2 text-sm bg-white/90"
      />
      {loading && (
        <div className="mt-1 text-xs text-gray-500">検索中…</div>
      )}
      {error && (
        <div className="mt-1 text-xs text-red-500">{error}</div>
      )}
      {results.length > 0 && (
        <ul className="mt-1 max-h-60 overflow-y-auto bg-white border rounded shadow text-sm">
          {results.map((r) => (
            <li
              key={r.id}
              className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
              onClick={() => handleSelect(r)}
            >
              <div className="font-medium">{r.name}</div>
              <div className="text-xs text-gray-500">{r.fullName}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
