"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Place } from "@/types/db";
import { ensureMySpace } from "@/lib/ensureMySpace";
import { fetchPlacePhotos, replacePlacePhotos } from "@/lib/placePhotoManager";

const CATEGORIES = ["食事", "宿泊", "体験", "お土産", "店舗", "娯楽", "マニアック", "その他"];

export default function EditPlacePage() {
  const params = useParams() as { id?: string | string[] };
  const placeId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const router = useRouter();
  const [place, setPlace] = useState<Place | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [accountName, setAccountName] = useState("名無しの旅人");

  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [category, setCategory] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);

  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p));
    };
  }, [previews]);

  useEffect(() => {
    if (!placeId) return;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const [{ data, error }, photosRes, userRes] = await Promise.all([
          supabase.from("places").select("*").eq("id", placeId).single(),
          fetchPlacePhotos(placeId),
          supabase.auth.getUser(),
        ]);

        if (error) throw error;
        const p = data as Place;
        setPlace(p);

        setTitle(p.title ?? "");
        setMemo(p.memo ?? "");
        setCategory(p.tags?.[0] ?? "");
        setExistingPhotos(photosRes.map((photo) => photo.file_url).filter(Boolean));

        const user = userRes.data.user;
        const displayName =
          (user?.user_metadata as any)?.display_name ||
          (user?.user_metadata as any)?.name ||
          (user?.email?.split("@")[0] ?? "名無しの旅人");
        setAccountName(displayName);
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
          title: title || null,
          memo: memo || null,
          tags: category ? [category] : [],
        })
        .eq("id", placeId);

      if (error) throw error;

      if (files.length > 0) {
        const mySpace = await ensureMySpace();
        if (!mySpace?.id) throw new Error("スペース情報を取得できませんでした");
        await replacePlacePhotos({ placeId, spaceId: mySpace.id, files });
      }

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

      <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, background: "#f8fafc", padding: 10 }}>
        投稿者: {accountName}
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        <label>
          ① タイトル（任意）
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 8 }}
          />
        </label>

        <label>
          ② 画像アップロード（選ぶと既存画像を置き換え）
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            style={{ display: "block", marginTop: 6 }}
          />
        </label>

        {files.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            {previews.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={`${src}-${i}`} src={src} alt={`new-${i + 1}`} style={{ width: "100%", borderRadius: 8, height: 90, objectFit: "cover" }} />
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            {existingPhotos.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={`${src}-${i}`} src={src} alt={`old-${i + 1}`} style={{ width: "100%", borderRadius: 8, height: 90, objectFit: "cover" }} />
            ))}
          </div>
        )}

        <label>
          ③ ひとこと（任意）
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            style={{ width: "100%", height: 140, padding: 8, border: "1px solid #ddd", borderRadius: 8 }}
          />
        </label>

        <label>
          ④ カテゴリー（任意）
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 8 }}>
            <option value="">選択しない</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

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
          {saving ? "保存中..." : "保存する"}
        </button>
      </div>
    </main>
  );
}
