// src/components/PostPreviewCard.tsx
"use client";

export default function PostPreviewCard({
  title,
  memo,
  photos,
  lat,
  lng,
  onClose,
  onEdit,
}: {
  title?: string | null;
  memo?: string | null;
  photos?: string[] | null;
  lat: number;
  lng: number;
  onClose?: () => void;
  onEdit?: () => void;
}) {
  const imgs = Array.isArray(photos) ? photos.filter(Boolean) : [];

  return (
    <div className="h-full w-full overflow-hidden rounded-t-2xl bg-white">
      {/* ヘッダ */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold">
            {title && title.trim() ? title : "（無題）"}
          </div>
          <div className="mt-0.5 text-xs text-neutral-600">
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onEdit && (
            <button
              onClick={onEdit}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50"
            >
              編集
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-md px-2 py-1 text-neutral-500 hover:bg-neutral-100"
              aria-label="閉じる"
              title="閉じる"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 本文＋写真 */}
      <div className="flex h-[calc(100%-52px)] gap-12 overflow-hidden px-4 py-3">
        {/* メモ */}
        <div className="min-w-0 flex-1 overflow-auto">
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {memo && memo.trim() ? memo : "（メモなし）"}
          </div>
        </div>

        {/* 写真 */}
        <div className="hidden w-[44%] shrink-0 overflow-auto md:block">
          {imgs.length === 0 ? (
            <div className="rounded-lg border bg-neutral-50 p-4 text-center text-sm text-neutral-500">
              写真はありません
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-8">
              {imgs.map((src, i) => (
                <div
                  key={src + i}
                  className="overflow-hidden rounded-xl border shadow-sm"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`photo-${i + 1}`}
                    className="h-40 w-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



