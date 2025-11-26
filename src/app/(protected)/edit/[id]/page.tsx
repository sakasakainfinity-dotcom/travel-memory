"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Place } from "@/types/db";

export default function EditPlacePage() {
  const params = useParams() as { id?: string | string[] };
  const placeId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const router = useRouter();
  const [place, setPlace] = useState<Place | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private" | "pair">(
    "private"
  );

  useEffect(() => {
    if (!placeId) return;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const { data, error } = await supabase
          .from("places")
          .select("*")
          .eq("id", placeId)
          .single();

        if (error) throw error;
        const p = data as Place;
        setPlace(p);

        setTitle(p.title ?? "");
        setMemo(p.memo ?? "");
        setVisibility((p as any).visibility ?? "private");

      } catch (e: any) {
        setErr(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [placeId]);

  async function save() {
    if (!placeId) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from("places")
        .update({
          title,
          memo,
          visibility,
        })
        .eq("id", placeId);

      if (error) throw error;

      alert("保存したよ！");
      router.push(`/place/${placeId}`);
    } catch (e: any) {
      alert(`保存に失敗した：${e?.message ?? e}`);
    } finally {
      setSaving(false);
    }
  }

  if (!placeId) {
    return (
      <main style={{ padding: 16 }}>
        <p>URLがおかしいみたいじゃ。</p>
        <Link href="/">← 戻る</Link>
      </main>
    );
  }

  if (loading) {
    return (
      <main style={{ display: "grid", placeItems: "center", height: "100vh" }}>
        <div>Loading…</div>
      </main>
    );
  }

  if (err) {
    return (
      <main style={{ padding: 16 }}>
        <p style={{ color: "crimson" }}>{err}</p>
        <Link href="/">← 戻る</Link>
      </main>
    );
  }

  return (
    <main style={{ padding: 16, display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={() => router.back()} style={{ border: "none", background: "transparent" }}>
          ← 戻る
        </button>
        <h1 style={{ margin: 0 }}>投稿を編集</h1>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        <label>
          タイトル
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 8 }}
          />
        </label>

        <label>
          メモ
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            style={{ width: "100%", height: 140, padding: 8, border: "1px solid #ddd", borderRadius: 8 }}
          />
        </label>

        <div>
          <label className="mb-1 block text-sm">公開範囲</label>
          <div style={{ display: "grid", gap: 6 }}>
            <label>
              <input
                type="radio"
                name="vis"
                value="public"
                checked={visibility === "public"}
                onChange={() => setVisibility("public")}
              />
              公開（青ピン）
            </label>
            <label>
              <input
                type="radio"
                name="vis"
                value="private"
                checked={visibility === "private"}
                onChange={() => setVisibility("private")}
              />
              非公開（赤ピン）
            </label>
            <label>
              <input
                type="radio"
                name="vis"
                value="pair"
                checked={visibility === "pair"}
                onChange={() => setVisibility("pair")}
              />
              ペア限定（黄ピン）
            </label>
          </div>
        </div>

        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "#111827",
            color: "#fff",
            fontWeight: 700,
          }}
        >
          保存する
        </button>
      </div>
    </main>
  );
}

