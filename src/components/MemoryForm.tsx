// src/components/MemoryForm.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { format } from "date-fns";

type UPair = { id: string; name: string | null };

function withTimeout<T>(p: Promise<T>, ms = 30000) {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Upload timeout")), ms);
    p.then((v) => {
      clearTimeout(t);
      resolve(v);
    }).catch((e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

export default function MemoryForm({ spaceId, placeId }: { spaceId: string; placeId: string }) {
  // 既存の項目
  const [visitedAt, setVisitedAt] = useState(format(new Date(), "yyyy-MM-dd"));
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);

  // 追加：場所（place）の公開範囲（public / private / pair）
  const [placeVisibility, setPlaceVisibility] = useState<"public" | "private" | "pair">("private");

  // メモの公開先（ペア共有用）
  const [pairs, setPairs] = useState<UPair[]>([]);
  const [pairId, setPairId] = useState<string>(""); // "" = 非公開（pair_id=null）

  // place の現在の visibility を取得
  useEffect(() => {
    (async () => {
      if (!placeId) return;

      const { data, error } = await supabase
        .from("places")
        .select("visibility")
        .eq("id", placeId)
        .single();

      if (error) {
        console.warn("places visibility load error:", error.message);
        return;
      }

      if (
        data?.visibility === "public" ||
        data?.visibility === "private" ||
        data?.visibility === "pair"
      ) {
        setPlaceVisibility(data.visibility);
      }
    })();
  }, [placeId]);

  // 自分のペア一覧を取得
  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess?.session) {
        setPairs([]);
        return;
      }

      const { data, error } = await supabase.rpc("get_my_pairs");
      if (error) {
        console.warn("get_my_pairs error:", error.message);
        setPairs([]);
        return;
      }

      const list = (data ?? []).map((r: any) => ({
        id: r.pair_group_id as string,
        name: r.name as string | null,
      }));
      setPairs(list);

      const last =
        typeof window !== "undefined"
          ? localStorage.getItem("defaultPairId") || ""
          : "";
      setPairId(last);
    })();
  }, []);

  async function submit() {
    try {
      setLoading(true);

      // 1) memories insert（pairIdが空ならnull＝非公開メモ）
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

      // 1.5) 場所(place)のvisibilityを更新（public / private / pair）
      const { error: eVis } = await supabase
        .from("places")
        .update({ visibility: placeVisibility })
        .eq("id", placeId);

      if (eVis) {
        console.warn("update place visibility error:", eVis.message);
        // メモ保存は成功しているので throw まではしない
      }

      // 2) 写真アップロード（あれば）※12MB超はスキップ
      const tasks: Promise<any>[] = [];
      if (files && files.length > 0) {
        for (const f of Array.from(files)) {
          if (f.size > 12 * 1024 * 1024) {
            console.warn("skip large file:", f.name);
            continue;
          }
          const path = `${spaceId}/${placeId}/${memory.id}/${crypto.randomUUID()}`;
          const t = withTimeout(
            supabase.storage.from("memories").upload(path, f, {
              cacheControl: "3600",
              upsert: false,
            })
          )
            .then(({ data }) =>
              supabase.from("photos").insert({
                space_id: spaceId,
                memory_id: memory.id,
                file_url: data!.path, // 表示時に署名URLを発行
              })
            )
            .catch((err) => console.error("upload failed:", err));
          tasks.push(t);
        }
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
    <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
      <label>
        訪問日
        <input
          type="date"
          value={visitedAt}
          onChange={(e) => setVisitedAt(e.target.value)}
          style={{ padding: 8, width: "100%" }}
        />
      </label>

      <label>
        メモ
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          style={{ padding: 8, width: "100%" }}
        />
      </label>

      {/* 場所（place）の公開範囲：3状態 */}
      <fieldset style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12 }}>
        <legend style={{ padding: "0 6px", fontWeight: 800 }}>場所の公開範囲</legend>

        <div style={{ display: "flex", flexDirection: "column", gap: 4, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="radio"
              name="place_visibility"
              value="public"
              checked={placeVisibility === "public"}
              onChange={() => setPlaceVisibility("public")}
            />
            公開（全国だれでもこのピンが見える）
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="radio"
              name="place_visibility"
              value="private"
              checked={placeVisibility === "private"}
              onChange={() => setPlaceVisibility("private")}
            />
            非公開（自分だけ）
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="radio"
              name="place_visibility"
              value="pair"
              checked={placeVisibility === "pair"}
              onChange={() => setPlaceVisibility("pair")}
            />
            ペア限定（ペア相手とのマップにだけ表示）
          </label>
        </div>

        <p style={{ marginTop: 8, color: "#6b7280", fontSize: 12 }}>
          ※ ここは「場所そのもの」の公開範囲。下の公開先は「このメモを誰に見せるか」だよ。
        </p>
      </fieldset>

      {/* メモの公開先：非公開 or ペア */}
      <fieldset style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12 }}>
        <legend style={{ padding: "0 6px", fontWeight: 800 }}>このメモの公開先</legend>

        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="radio"
              name="memory_visibility"
              checked={pairId === ""}
              onChange={() => setPairId("")}
            />
            非公開（ペアに紐づけない）
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="radio"
              name="memory_visibility"
              checked={pairId !== ""}
              onChange={() => {
                if (pairs.length === 1) setPairId(pairs[0].id);
              }}
            />
            ペアに共有
          </label>

          <select
            disabled={pairId === ""}
            value={pairId === "" ? "" : pairId}
            onChange={(e) => setPairId(e.target.value)}
            style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd", minWidth: 220 }}
          >
            <option value="" disabled hidden>
              ペアを選択
            </option>
            {pairs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || "（名前未設定）"}
              </option>
            ))}
          </select>
        </div>

        <p style={{ marginTop: 8, color: "#6b7280", fontSize: 12 }}>
          ※ 非公開はあなた専用。ペアに共有を選ぶと、そのペアのメンバー全員に見えるようになるよ。
        </p>
      </fieldset>

      <label>
        写真（複数可）
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => setFiles(e.target.files)}
        />
      </label>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
        <button onClick={() => history.back()} style={{ padding: "10px 14px" }}>
          閉じる
        </button>
        <button
          onClick={submit}
          disabled={loading}
          style={{ padding: "10px 14px", fontWeight: 700 }}
        >
          {loading ? "保存中..." : "保存"}
        </button>
      </div>
    </div>
  );
}





