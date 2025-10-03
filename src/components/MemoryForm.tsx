"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { format } from "date-fns";

function withTimeout<T>(p: Promise<T>, ms = 30000) {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Upload timeout")), ms);
    p.then(v => { clearTimeout(t); resolve(v); }).catch(e => { clearTimeout(t); reject(e); });
  });
}

export default function MemoryForm({ spaceId, placeId }: { spaceId: string; placeId: string }) {
  const [visitedAt, setVisitedAt] = useState(format(new Date(), "yyyy-MM-dd"));
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    try {
      setLoading(true);

      // 1) memory作成
      const { data: memory, error: e1 } = await supabase
        .from("memories")
        .insert({ space_id: spaceId, place_id: placeId, visited_at: visitedAt, note: note || null })
        .select()
        .single();
      if (e1) throw e1;

      // 2) 写真（任意）。重すぎる画像は弾く（例: 12MB超）
      const tasks: Promise<any>[] = [];
      if (files && files.length > 0) {
        for (const f of Array.from(files)) {
          if (f.size > 12 * 1024 * 1024) {
            console.warn("skip large file:", f.name);
            continue;
          }
          const path = `${spaceId}/${placeId}/${memory.id}/${crypto.randomUUID()}.jpg`;
          const task = withTimeout(
            supabase.storage.from("memories").upload(path, f, { cacheControl: "3600", upsert: false })
          )
            .then(({ data }) => supabase.from("photos").insert({ space_id: spaceId, memory_id: memory.id, file_url: data!.path }))
            .catch(err => console.error("upload failed", err));
          tasks.push(task);
        }
      }

      // 並列で待つけど、失敗しても全体は続行
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
        <input type="date" value={visitedAt} onChange={(e) => setVisitedAt(e.target.value)} style={{ padding: 8 }} />
      </label>
      <label>
        メモ
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} style={{ padding: 8 }} />
      </label>
      <label>
        写真（複数OK）
        <input type="file" multiple accept="image/*" onChange={(e) => setFiles(e.target.files)} />
      </label>
      <button onClick={submit} disabled={loading} style={{ padding: "10px 14px", fontWeight: 700 }}>
        {loading ? "保存中..." : "思い出を保存"}
      </button>
      <p style={{ color: "#666" }}>※ まずは原本アップ。重すぎる画像はスキップするよ（>12MB）。</p>
    </div>
  );
}

