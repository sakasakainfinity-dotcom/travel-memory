// src/app/.../MemoryForm.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/lib/supabaseClient";
import SafeFilePicker from "@/components/SafeFilePicker";
import { uploadWithOptionalThumb } from "@/lib/image";

type Picked = { original: File; thumbnail: File | null; contentType: string };

type PairRow = {
  pair_id: string;
  pair_groups: { id: string; name: string | null; owner_id: string; invite_token: string | null };
};

function withTimeout<T>(p: Promise<T>, ms = 30000) {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Upload timeout")), ms);
    p.then(v => { clearTimeout(t); resolve(v); })
     .catch(e => { clearTimeout(t); reject(e); });
  });
}

export default function MemoryForm({
  spaceId,
  placeId,
}: {
  spaceId: string;
  placeId: string;
}) {
  // 基本フォーム
  const [visitedAt, setVisitedAt] = useState(format(new Date(), "yyyy-MM-dd"));
  const [note, setNote] = useState("");
  // 画像（SafeFilePickerから受領）
  const [picked, setPicked] = useState<Picked[]>([]);
  // ペア選択
  const [pairs, setPairs] = useState<{ id: string; name: string | null }[]>([]);
  const [pairId, setPairId] = useState<string | "">("");
  // 状態
  const [loading, setLoading] = useState(false);
  const [debug, setDebug] = useState<string>("");

  // 自分が属するペア一覧を取得
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from("pair_members")
          .select("pair_id, pair_groups:pair_id(id, name, owner_id, invite_token)")
          .order("joined_at", { ascending: false })
          .returns<PairRow[]>();
        if (error) throw error;
        const uniq = new Map<string, { id: string; name: string | null }>();
        (data || []).forEach((r) => {
          if (r?.pair_groups?.id) {
            uniq.set(r.pair_groups.id, { id: r.pair_groups.id, name: r.pair_groups.name });
          }
        });
        const list = Array.from(uniq.values());
        setPairs(list);
        // 既に何も選んでなければ最初のペアを初期選択（任意）
        if (!pairId && list.length > 0) setPairId(list[0].id);
      } catch (e: any) {
        console.warn("failed to load pairs", e?.message || e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickedInfo = useMemo(
    () => (picked.length ? `${picked.length}枚（HEICはサムネJPEG生成）` : "未選択"),
    [picked]
  );

  async function submit() {
    try {
      setLoading(true);
      setDebug("start submit");

      // 1) memories を作成（ペアID付与）
      const { data: memory, error: e1 } = await supabase
        .from("memories")
        .insert({
          space_id: spaceId,
          place_id: placeId,
          visited_at: visitedAt,
          note: note || null,
          pair_id: pairId || null, // ←ペアB対応
        })
        .select()
        .single();

      if (e1) throw e1;
      setDebug("insert memory ok: " + memory.id);

      // 2) 写真アップロード（原本＋任意サムネ）
      // 12MB超はスキップ、失敗しても他は続行
      const tasks: Promise<void>[] = [];
      for (const it of picked) {
        const f = it.original;
        if (f.size > 12 * 1024 * 1024) {
          console.warn("skip large file:", f.name);
          continue;
        }
        const job = (async () => {
          const res = await withTimeout(
            uploadWithOptionalThumb(it.original, it.thumbnail),
            60_000
          );
          const original_path = res.original.path;
          const thumb_path = res.thumbnail?.path ?? null;
          const content_type = it.contentType;

          // まずは拡張スキーマ（original_url / thumb_url / content_type）がある前提
          try {
            const { error: e2 } = await supabase.from("photos").insert({
              space_id: spaceId,
              memory_id: memory.id,
              original_url: original_path,
              thumb_url: thumb_path,
              content_type,
            });
            if (e2) throw e2;
          } catch (e) {
            // 旧スキーマ互換（file_url のみ）
            console.warn("fallback insert (file_url only)", e);
            const { error: e3 } = await supabase.from("photos").insert({
              space_id: spaceId,
              memory_id: memory.id,
              file_url: original_path,
            });
            if (e3) throw e3;
          }
        })().catch((err) => console.error("upload failed", err));
        tasks.push(job);
      }

      await Promise.allSettled(tasks);
      setDebug("upload tasks settled");

      alert("保存したよ！"); // さくっと通知
      // ページ遷移：ペアで共有した思い出は相手にも見える
      window.location.href = `/place/${placeId}`;
    } catch (err: any) {
      alert(err?.message ?? "保存に失敗しました");
      setDebug("error: " + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
      {/* ペア選択 */}
      <label style={{ display: "grid", gap: 6 }}>
        <div style={{ fontWeight: 700 }}>共有先（ペア）</div>
        <select
          value={pairId}
          onChange={(e) => setPairId(e.target.value)}
          style={{ padding: 8 }}
        >
          {pairs.length === 0 && <option value="">（ペア未作成）</option>}
          {pairs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name ?? "（無題ペア）"}
            </option>
          ))}
          <option value="">自分だけ（ペア無し）</option>
        </select>
        <div style={{ fontSize: 12, color: "#666" }}>
          ※ ペアを選ぶと、同じペアの相手にもこの思い出が見えるよ。
        </div>
      </label>

      {/* 訪問日 */}
      <label>
        訪問日
        <input
          type="date"
          value={visitedAt}
          onChange={(e) => setVisitedAt(e.target.value)}
          style={{ padding: 8 }}
        />
      </label>

      {/* メモ */}
      <label>
        メモ
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          style={{ padding: 8 }}
        />
      </label>

      {/* 写真ピッカー（HEIC対応・サムネ生成） */}
      <div>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>写真（複数OK）</div>
        <SafeFilePicker
          multiple
          label="写真を追加（HEIC対応・サムネ生成）"
          onPick={(items) => setPicked(items)}
        />
        <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
          選択：{pickedInfo} ／ 12MB超はスキップ。サムネ生成に失敗しても原本は保存するけぇ安心して。
        </div>
      </div>

      {/* 送信ボタン */}
      <button
        onClick={submit}
        disabled={loading}
        style={{ padding: "10px 14px", fontWeight: 700 }}
      >
        {loading ? "保存中..." : "思い出を保存"}
      </button>

      {/* 最小デバッグ（PWAでも見えるように画面出し） */}
      <p style={{ color: "#666", fontSize: 12 }}>{debug}</p>
    </div>
  );
}



