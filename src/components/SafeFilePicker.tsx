// src/components/SafeFilePicker.tsx
"use client";
import { useRef } from "react";
import { convertToUploadableImage } from "@/lib/convertToUploadableImage";

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

  async function handleFiles(fs: FileList | null) {
    const arr = Array.from(fs ?? []);
    if (arr.length === 0) {
      alert("写真が選べてません。もう一度お試しください。");
      return;
    }

    // 入り口ログ：選ばれたファイル一覧
    console.groupCollapsed("[SafeFilePicker] selected files");
    for (const f of arr) {
      console.log("RAW  ->", { name: f.name, type: f.type, size: f.size });
    }
    console.groupEnd();

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

    // ★ HEIC→JPEG 変換（前後ログ付き）
    const convertedArr: File[] = [];
    for (const file of arr) {
      try {
        console.groupCollapsed("[SafeFilePicker] convert");
        console.log("before", { name: file.name, type: file.type, size: file.size });

        const converted = await convertToUploadableImage(file);

        console.log("after ", { name: converted.name, type: converted.type, size: converted.size });
        console.groupEnd();

        convertedArr.push(converted);
      } catch (err) {
        console.error("変換失敗:", err);
        alert("HEIC画像の変換に失敗しました。別の写真を選んでください。");
      }
    }

    // 下流へ渡す直前の確認ログ
    console.groupCollapsed("[SafeFilePicker] passing to onPick");
    for (const f of convertedArr) {
      console.log("PASS ->", { name: f.name, type: f.type, size: f.size });
    }
    console.groupEnd();

    onPick(convertedArr);

    // 同じファイルを選び直せるようにリセット
    if (ref.current) ref.current.value = "";
  }

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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

      {/* 代替ルート：Files（白丸対策の“確実”ボタン） */}
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
    </div>
  );
}



