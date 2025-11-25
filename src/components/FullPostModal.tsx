// src/components/FullPostModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

export interface FullPostModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    address?: string;
    memo: string;
    visitedAt?: string;
    lat: number;
    lng: number;
    photos: File[];
    visibility: "public" | "private" | "pair"; // ★追加
  }) => void;
  place: { lat: number; lng: number };
  defaultMemo?: string;
  defaultVisibility?: "public" | "private" | "pair"; // ★初期値用（任意）
}

export default function FullPostModal({
  open,
  onClose,
  onSubmit,
  place,
  defaultMemo,
  defaultVisibility = "private", // ★デフォルト: 自分だけ
}: FullPostModalProps) {
  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [memo, setMemo] = useState(defaultMemo ?? "");
  const [visitedAt, setVisitedAt] = useState<string>(() => {
    const d = new Date();
    const z = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  });
  const [lat, setLat] = useState<number>(place.lat);
  const [lng, setLng] = useState<number>(place.lng);
  const [files, setFiles] = useState<File[]>([]);

  // ★ 公開範囲 state（青 / 赤 / 黄）
  const [visibility, setVisibility] = useState<"public" | "private" | "pair">(
    defaultVisibility
  );

  // ★ 開くたび“完全リセット”（前回の入力や写真を残さない）
  useEffect(() => {
    if (!open) return;
    const d = new Date();
    const z = (n: number) => String(n).padStart(2, "0");
    setTitle("");
    setAddress("");
    setMemo(defaultMemo ?? "");
    setVisitedAt(`${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`);
    setLat(place.lat);
    setLng(place.lng);
    setFiles([]);
    setVisibility(defaultVisibility); // ← visibility もリセット
  }, [open, place.lat, place.lng, defaultMemo, defaultVisibility]);

  const previews = useMemo(
    () => files.map((f) => ({ url: URL.createObjectURL(f), name: f.name })),
    [files]
  );
  useEffect(() => {
    return () => previews.forEach((p) => URL.revokeObjectURL(p.url));
  }, [previews]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[12000] grid place-items-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-2xl bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="text-lg font-semibold">フル投稿</div>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100"
          >
            ×
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm">タイトル</label>
            <input
              className="w-full rounded-md border px-3 py-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例：○○食堂"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm">住所（任意）</label>
            <input
              className="w-full rounded-md border px-3 py-2"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="住所など"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm">緯度</label>
              <input
                className="w-full rounded-md border px-3 py-2"
                value={Number.isFinite(lat) ? lat : ""}
                onChange={(e) => setLat(parseFloat(e.target.value))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm">経度</label>
              <input
                className="w-full rounded-md border px-3 py-2"
                value={Number.isFinite(lng) ? lng : ""}
                onChange={(e) => setLng(parseFloat(e.target.value))}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm">訪問日</label>
            <input
              type="date"
              className="w-full rounded-md border px-3 py-2"
              value={visitedAt}
              onChange={(e) => setVisitedAt(e.target.value)}
            />
          </div>

          {/* ★ 公開範囲：公開 / 自分だけ / ペア限定 */}
          <div>
            <label className="mb-1 block text-sm">公開範囲</label>
            <div className="space-y-1 rounded-md border px-3 py-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="visibility"
                  value="public"
                  checked={visibility === "public"}
                  onChange={() => setVisibility("public")}
                />
                <span>公開（全国どのユーザーからも見える・青ピン）</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="visibility"
                  value="private"
                  checked={visibility === "private"}
                  onChange={() => setVisibility("private")}
                />
                <span>非公開（自分だけ・赤ピン）</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="visibility"
                  value="pair"
                  checked={visibility === "pair"}
                  onChange={() => setVisibility("pair")}
                />
                <span>ペア限定（ペア相手とのマップだけで表示・黄ピン想定）</span>
              </label>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm">メモ</label>
            <textarea
              className="h-32 w-full rounded-md border px-3 py-2"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm">写真（複数可）</label>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            {previews.length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {previews.map((p) => (
                  <div key={p.url} className="overflow-hidden rounded-md border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url}
                      alt={p.name}
                      className="h-32 w-full object-cover"
                    />
                    <div className="truncate px-2 py-1 text-xs text-neutral-600">
                      {p.name}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            className="w-full rounded-lg bg-black px-4 py-2 text-white"
            onClick={() =>
              onSubmit({
                title: title.trim(),
                address: address.trim() || undefined,
                memo,
                visitedAt,
                lat,
                lng,
                photos: files,
                visibility, // ★ここで渡す
              })
            }
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}


