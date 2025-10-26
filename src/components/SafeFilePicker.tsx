// src/components/SafeFilePicker.tsx
"use client";
import { useRef, useState } from "react";
import { convertToUploadableImage } from "@/lib/convertToUploadableImage";

type LogLine = { tag: string; name: string; type: string; size: number };

export default function SafeFilePicker({
  label = "写真を追加",
  multiple = true,
  onPick,
}: {
  label?: string;
  multiple?: boolean;
  onPick: (files: File[]) => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);

  const addLog = (l: LogLine) => setLogs((old) => [...old, l]);

  async function handleFiles(fs: FileList | null) {
    const arr = Array.from(fs ?? []);
    if (arr.length === 0) {
      alert("写真が選べてません。もう一度お試しください。");
      return;
    }

    // 入り口ログ（変換前）
    arr.forEach((f) => addLog({ tag: "RAW", name: f.name, type: f.type || "(empty)", size: f.size }));

    // iOS白丸中だと size が極小or0のことがある。最低10KBでチェック
    const bad = arr.find((f) => !f.type.startsWith("image/") || f.size < 10_000);
    if (bad) {
      alert(
        "写真データの読み込みが終わっていない可能性があります。\n" +
          "・数秒待ってからもう一度選ぶ\n" +
          "・または「ファイルから選ぶ」ボタンを使う（確実）\n" +
          "で解決できます。"
      );
      if (ref.current) ref.current.value = "";
      return;
    }

    // HEIC→JPEG 変換
    const convertedArr: File[] = [];
    for (const file of arr) {
      try {
        const converted = await convertToUploadableImage(file);
　　　　alert(
  `RAW: ${file.name} (${file.type || "empty"})\n` +
  `AFTER: ${converted.name} (${converted.type || "empty"})`
);

         addLog({ tag: "AFTER", name: converted.name, type: converted.type || "(empty)", size: converted.size });
        convertedArr.push(converted);
      } catch (err) {
        console.error("変換失敗:", err);
        alert("HEIC画像の変換に失敗しました。別の写真を選んでください。");
      }
    }

    // 下流へ渡す直前
    convertedArr.forEach((f) => addLog({ tag: "PASS", name: f.name, type: f.type || "(empty)", size: f.size }));
    onPick(convertedArr);

    if (ref.current) ref.current.value = "";
  }

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <label
        style={{
          display: "inline-block",
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid #ddd",
          background: "#fff",
          cursor: "pointer",
          fontWeight: 700,
        }}
      >
        {label}
        <input
          ref={ref}
          type="file"
          accept="image/*,image/heic,image/heif"
          multiple={multiple}
          onChange={(e) => handleFiles(e.target.files)}
          style={{ display: "none" }}
        />
      </label>

      <label
        style={{
          display: "inline-block",
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid #ddd",
          background: "rgba(17,24,39,0.04)",
          cursor: "pointer",
          fontWeight: 700,
        }}
      >
        ファイルから選ぶ
        <input
          type="file"
          accept="image/*,image/heic,image/heif"
          multiple={multiple}
          onChange={(e) => handleFiles(e.target.files)}
          style={{ display: "none" }}
        />
      </label>

      {/* 画面内デバッグ窓（スマホでも見える） */}
      <div style={{
        maxHeight: 120,
        overflow: "auto",
        border: "1px dashed #bbb",
        padding: 8,
        borderRadius: 8,
        background: "#fafafa",
        fontSize: 12,
        width: "100%"
      }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Upload Debug</div>
        {logs.length === 0 ? (
          <div style={{ color: "#666" }}>ここに変換ログが出ます（RAW → AFTER → PASS）</div>
        ) : (
          logs.map((l, i) => (
            <div key={i}>
              <code>{l.tag}</code> name="{l.name}" • type="{l.type}" • size={l.size}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
