// src/components/SafeFilePicker.tsx
"use client";

import { useRef, useState } from "react";
import { decideContentType } from "@/lib/mime";
import { generateThumbnail } from "@/lib/thumbnail";

type Picked = { original: File; thumbnail: File | null; contentType: string };

export default function SafeFilePicker({
  label = "写真を追加",
  multiple = true,
  onPick,
}: {
  label?: string;
  multiple?: boolean;
  onPick: (files: Picked[]) => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const log = (s: string) => setLogs((o) => [...o, s]);

  async function handleFiles(fs: FileList | null) {
    const arr = Array.from(fs ?? []);
    if (arr.length === 0) {
      alert("写真が選べてません。もう一度お試しください。");
      return;
    }

    // 読み込み前の0サイズ回避
    const bad = arr.find((f) => f.size < 10_000);
    if (bad) {
      alert("写真の読み込みが終わっていません。数秒待ってからもう一度。");
      if (ref.current) ref.current.value = "";
      return;
    }

    setBusy(true);
    try {
      const picked: Picked[] = [];
      for (const f of arr) {
        const ct = await decideContentType(f);

        // RAWは非対応（原本は保存するが、サムネは作らない＝null）
        const isRaw = /image\/tiff/.test(ct) || /\.(dng|tif|tiff)$/i.test(f.name);

        const thumb = isRaw ? null : await generateThumbnail(f, { maxSide: 1280, quality: 0.8 });

        log(`picked: ${f.name} ct=${ct} thumb=${thumb ? thumb.name : "none"}`);
        picked.push({ original: f, thumbnail: thumb, contentType: ct });
      }
      onPick(picked);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <label
        style={{
          display: "inline-block",
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid #ddd",
          background: "#fff",
          cursor: "pointer",
          fontWeight: 700,
          width: "fit-content",
          opacity: busy ? 0.6 : 1,
          pointerEvents: busy ? "none" : "auto",
        }}
      >
        {busy ? "準備中…" : label}
        <input
          ref={ref}
          type="file"
          accept="image/*,.heic,.heif,.avif,.tif,.tiff,.dng"
          multiple={multiple}
          onChange={(e) => handleFiles(e.target.files)}
          style={{ display: "none" }}
        />
      </label>

      {/* 簡易ログ（必要なければ消してOK） */}
      <div style={{ maxHeight: 120, overflow: "auto", fontSize: 12, color: "#555" }}>
        {logs.map((l, i) => <div key={i}><code>{l}</code></div>)}
      </div>
    </div>
  );
}
