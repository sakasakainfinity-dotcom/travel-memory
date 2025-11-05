"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { format } from "date-fns";

type UPair = { id: string; name: string | null };

function withTimeout<T>(p: Promise<T>, ms = 30000) {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Upload timeout")), ms);
    p.then(v => { clearTimeout(t); resolve(v); }).catch(e => { clearTimeout(t); reject(e); });
  });
}

export default function MemoryForm({ spaceId, placeId }: { spaceId: string; placeId: string }) {
  // 既存
  const [visitedAt, setVisitedAt] = useState(format(new Date(), "yyyy-MM-dd"));
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);

  // 追加：公開先（非公開 or ペア）
  const [pairs, setPairs] = useState<UPair[]>([]);
  const [pairId, setPairId] = useState<string>(""); // "" = 非公開, それ以外はペアID

  // 自分のペア一覧を読み込み（RPC：JOINなし）
  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess?.session) { setPairs([]); return; }
      const { data, error } = await supabase.rpc("get_my_pairs");
      if (error) { console.warn(error); setPairs([]); return; }
      const list = (data ?? []).map((r: any) => ({ id: r.pair_group_id as string, name: r.name as string | null }));
      setPairs(list);
    })();
  }, []);

  async function submit() {
    try {
      setLoading(true);

      // 1) memory作成：pair_id は "" のとき null（＝非公開）
      const payload: any = {
        space_id: spaceId,
        place_id: placeId,
        visited_at: visitedAt,
        note: note || null,
        pair_id: pairId ? pairId : null,
      };

      const { data: memory, error: e1 } = await supabase
        .from("memories")
        .insert(payload)
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
          const path = `${spaceId}/${placeId}/${memory.id}/${crypto.randomUUID()}`;
          const task = withTimeout(
            supabase.storage.from("memories").upload(path, f, { cacheControl: "3600", upsert: false })
          )
            .then(({ data }) =>
              supabase.from("photos").insert({
                space_id: spaceId,
                memory_id: memory.id,
                file_url: data!.path, // 公開/署名URLは閲覧側で発行
              })
            )
            .catch(err => console.error("upload failed", err));
          tasks.push(task);
        }
      }

      await Promise.allSettled(tasks);

      alert("保存したよ！");
      // ペア投稿ならペア詳細へ、非公開なら元の場所へ…など好みで遷移先を変えてOK
      window.location.href = `/place/${placeId}`;
    } catch (err: any) {
      alert(err?.message ?? "保存に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 10, marginTop: 24 }}>
      {/* タイトル/住所などは既存のままにしてね（省略） */}

      <label>
        訪問日
        <input type="date" value={visitedAt} onChange={(e) => setVisitedAt(e.target.value)} style={{ padding: 8, width: "100%" }} />
      </label>

      <label>
        メモ
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} style={{ padding: 8, width: "100%" }} />
      </label>

      {/* ★ 追加：公開先セクション */}
      <fieldset
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          padding: 12,
        }}
      >
        <legend style={{ padding: "0 6px", color: "#111827", fontWeight: 800 }}>公開先</legend>

        {/* ラジオ：非公開 or ペアにする */}
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="radio"
              name="visibility"
              checked={pairId === ""}
              onChange={() => setPairId("")}
            />
            非公開（ペアに紐づけない）
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="radio"
              name="visibility"
              checked={pairId !== ""}
              onChange={() => {
                // ペアがひとつだけなら自動選択、それ以外は現状維持
                if (pairs.length === 1) setPairId(pairs[0].id);
              }}
            />
            ペアに共有
          </label>

          {/* ペア選択のドロップダウン（有効時だけ） */}
          <select
            disabled={pairId === ""} // 非公開のときは無効
            value={pairId === "" ? "" : pairId}
            onChange={(e) => setPairId(e.target.value)}
            style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd", minWidth: 220 }}
          >
            {/* value="" は選べないようにするので hidden */}
            <option value="" disabled hidden>ペアを選択</option>
            {pairs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || "（名前未設定）"}
              </option>
            ))}
          </select>
        </div>

        <p style={{ marginTop: 8, color: "#6b7280", fontSize: 12 }}>
          ※ 非公開を選ぶと、あなた以外には表示されません。ペアを選ぶと、そのペアのメンバー全員に共有されます。
        </p>
      </fieldset>

      <label>
        写真（複数可）
        <input type="file" multiple accept="image/*" onChange={(e) => setFiles(e.target.files)} />
      </label>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
        <button onClick={() => history.back()} style={{ padding: "10px 14px" }}>閉じる</button>
        <button onClick={submit} disabled={loading} style={{ padding: "10px 14px", fontWeight: 700 }}>
          {loading ? "保存中..." : "保存"}
        </button>
      </div>
    </div>
  );
}




