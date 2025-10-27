// src/components/SafeFilePicker.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { convertToUploadableImage } from "@/lib/convertToUploadableImage";

type LogLine = string;

export default function SafeFilePicker({
  label = "写真を追加",
  multiple = true,
  onPick,
}: {
  label?: string;
  multiple?: boolean;
  onPick: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [tapCount, setTapCount] = useState(0);

  const addLog = (l: LogLine) => setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()}  ${l}`]);

  useEffect(() => {
    addLog("✅ SafeFilePicker mounted");
  }, []);

  // iOS Safari / PWA で label+hidden input が反応しないことがある。
  // → ボタンの上に "透明のinputを全面にかぶせる" 方式にする
  //   display:none は使わない（iOSがイベント拾わないことがある）
  async function handleFiles(fs: FileList | null) {
    addLog("⚡ onChange fired");
    const arr = Array.from(fs ?? []);
    addLog(`選択枚数: ${arr.length}`);

    if (arr.length === 0) {
      addLog("⚠ ファイル0枚");
      return;
    }

    // iOSの未読込ガード
    const bad = arr.find((f) => !f.type.startsWith("image/") || f.size < 10_000);
    if (bad) {
      addLog(`⚠ 読み込み前の可能性 name=${bad.name} type=${bad.type || "(empty)"} size=${bad.size}`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    // 変換（HEIC→JPEG）
    const convertedArr: File[] = [];
    for (const file of arr) {
      addLog(`RAW  name="${file.name}" type="${file.type || "(empty)"}" size=${file.size}`);
      try {
        const converted = await convertToUploadableImage(file);
        addLog(`AFTER name="${converted.name}" type="${converted.type || "(empty)"}" size=${converted.size}`);
        convertedArr.push(converted);
      } catch (e) {
        addLog(`❌ 変換失敗: ${(e as Error)?.message || e}`);
      }
    }

    // 下流へ
    convertedArr.forEach((f) =>
      addLog(`PASS name="${f.name}" type="${f.type || "(empty)"}" size=${f.size}`)
    );
    onPick(convertedArr);

    // 同じファイルを選べるようリセット
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* デバッグ用の“押したらカウント増える”ボタン（レンダ＆イベント確認） */}
      <button
        type="button"
        onClick={() => {
          setTapCount((n) => n + 1);
          addLog("👆 Debug tap button clicked");
        }}
        style={{
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid #ddd",
          background: "#f5f5f5",
          fontWeight: 700,
          width: "fit-content",
        }}
      >
        Debug: 反応テスト（{tapCount}）
      </button>

      {/* iOS対応：相対配置の枠の上に透明inputを全面オーバーレイ */}
      <div style={{ position: "relative", display: "inline-block" }}>
        <button
          type="button"
          style={{
            display: "inline-block",
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#fff",
            fontWeight: 700,
          }}
          onClick={() => addLog("👆 表のボタンがタップされました")}
        >
          {label}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/*,.heic,.heif"
          multiple={multiple}
          onChange={(e) => handleFiles(e.target.files)}
          // iOSで確実に拾うためのオーバーレイ
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0,      // 透明化（display:noneはNG）
            cursor: "pointer",
          }}
        />
      </div>

      {/* 代替：Files（色違いのボタン） */}
      <div style={{ position: "relative", display: "inline-block" }}>
        <button
          type="button"
          style={{
            display: "inline-block",
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "rgba(17,24,39,0.04)",
            fontWeight: 700,
          }}
          onClick={() => addLog("👆 代替ボタンがタップされました")}
        >
          ファイルから選ぶ
        </button>

        <input
          type="file"
          accept="image/*,.heic,.heif"
          multiple={multiple}
          onChange={(e) => handleFiles(e.target.files)}
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0,
            cursor: "pointer",
          }}
        />
      </div>

      {/* 画面内ログ（スマホで見える） */}
      <div
        style={{
          maxHeight: 160,
          overflow: "auto",
          border: "1px dashed #bbb",
          padding: 8,
          borderRadius: 8,
          background: "#fafafa",
          fontSize: 12,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Upload Debug</div>
        {logs.length === 0 ? (
          <div style={{ color: "#666" }}>
            ここにログが出ます（mounted / tap / onChange / RAW / AFTER / PASS）
          </div>
        ) : (
          logs.map((l, i) => <div key={i}><code>{l}</code></div>)
        )}
      </div>
    </div>
  );
}

