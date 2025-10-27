// src/app/.../MemoryForm.tsx など（置き換え）

"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { format } from "date-fns";
import SafeFilePicker from "@/components/SafeFilePicker";
import { uploadWithOptionalThumb } from "@/lib/image";

// SafeFilePicker から受け取る型（同じ定義を再掲）
type Picked = { original: File; thumbnail: File | null; contentType: string };

function withTimeout<T>(p: Promise<T>, ms = 30000) {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Upload timeout")), ms);
    p.then(v => { clearTimeout(t); resolve(v); })
     .catch(e => { clearTimeout(t); reject(e); });
  });
}

export default function MemoryForm({ spaceId, placeId }: { spaceId: string; placeId: string }) {
  const [visitedAt, setVisitedAt] = useState(format(new Date(), "yyyy-MM-dd"));
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState<Picked[]>([]);
  const [loading, setLoading] = useState(false);

  async function submit() {
    try {
      setLoading(true);

      // 1) memory 作成
      const { data: memory, error: e1 } = await supabase
        .from("memories")
        .insert({
          space_id: spaceId,
          place_id: placeId,
          visited_at: visitedAt,
          note: note || null
        })
        .select()
        .single();
      if (e1) throw e1;

      // 2) 画像（原本＋サムネ）アップロード
      //    - 12MB超はスキップ（原本そのまま保存方針）
      const tasks: Promise<void>[] = [];
      for (const it of picked) {
        const f = it.original;
        if (f.size > 12 * 1024 * 1024) {
          console.warn("skip large file:", f.name);
          continue;
        }

        const job = (async () => {
          // 原本＋サムネ(ある場合)を保存
          const res = await withTimeout(
            uploadWithOptionalThumb(it.original, it.thumbnail),
            60_000
          );

          const original_path = res.original.path;
          const thumb_path = res.thumbnail?.path ?? null;
          const content_type = it.contentType;

          // ↙ まずは拡張スキーマ（original_url / thumb_url / content_type）がある前提で insert
          try {
            const { error: e2 } = await supabase.from("photos").insert({
              space_id: spaceId,
              memory_id: memory.id,
              original_url: original_path,
              thumb_url: thumb_path,
              content_type
            });
            if (e2) throw e2;
          } catch (e) {
            // ↙ 既存スキーマ互換フォールバック（file_url しか無い場合）
            //    - 原本だけ保存。必要なら別行にサムネも保存したい人はここを拡張してね。
            console.warn("fallback insert (file_url only)", e);
            const { error: e3 } = await supabase.from("photos").insert({
              space_id: spaceId,
              memory_id: memory.id,
              file_url: original_path
            });
            if (e3) throw e3;
          }
        })().catch(err => console.error("upload failed", err));

        tasks.push(job);
      }

      await Promise.allSettled(tasks);

      alert("保存したよ！");
      window.location.href = `/place/${placeId}`;
    } catch (err: any) {
      alert(err?.message ?? "保存に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 10, marginTop: 24 }}>
      <label>
        訪問日
        <input
          type="date"
          value={visitedAt}
          onChange={(e) => setVisitedAt(e.target.value)}
          style={{ padding: 8 }}
        />
      </label>

      <label>
        メモ
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          style={{ padding: 8 }}
        />
      </label>

      {/* ← ここを SafeFilePicker に置き換え（HEICでもOK、サムネはJPEG化） */}
      <div>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>写真（複数OK）</div>
        <SafeFilePicker
          multiple
          label="写真を追加HEIC対応・サムネ生成"
          onPick={(items) => setPicked(items)}
        />
        <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
          ※ 原本はそのまま保存、プレビュー用に小さなJPEGサムネも一緒に保存します。12MB超はスキップ。
        </div>
      </div>

      <button
        onClick={submit}
        disabled={loading}
        style={{ padding: "10px 14px", fontWeight: 700 }}
      >
        {loading ? "保存中..." : "思い出を保存"}
      </button>
    </div>
  );
}


