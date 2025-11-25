// src/components/PlaceForm.tsx
"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  spaceId: string;
  defaultLat?: number;
  defaultLng?: number;
  defaultTitle?: string;
};

export default function PlaceForm({ spaceId, defaultLat, defaultLng, defaultTitle }: Props) {
  const [lat, setLat] = useState<number | "">("");
  const [lng, setLng] = useState<number | "">("");
  const [title, setTitle] = useState<string>("");
  const [address, setAddress] = useState<string>("");

  // ★ 公開範囲: public / private / pair
  const [visibility, setVisibility] = useState<"public" | "private" | "pair">("private");

  useEffect(() => {
    if (typeof defaultLat === "number") setLat(defaultLat);
    if (typeof defaultLng === "number") setLng(defaultLng);
    if (defaultTitle) setTitle(defaultTitle);
  }, [defaultLat, defaultLng, defaultTitle]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (lat === "" || lng === "") {
      alert("緯度経度が未入力じゃ。地図をクリックするか検索して埋めてね。");
      return;
    }

    const { data, error } = await supabase
      .from("places")
      .insert({
        space_id: spaceId,
        lat: Number(lat),
        lng: Number(lng),
        title: title || null,
        address: address || null,
        visibility, // ★ 3状態のどれかが入る
      })
      .select("id")
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    // 追加後は詳細へ
    window.location.href = `/place/${data.id}`;
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 8 }}>
      <label>タイトル</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="場所の名前" />

      <label>住所（任意）</label>
      <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="住所など" />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <label>緯度（lat）</label>
          <input
            value={lat}
            onChange={(e) => setLat(e.target.value ? Number(e.target.value) : "")}
            placeholder="34.385"
          />
        </div>
        <div>
          <label>経度（lng）</label>
          <input
            value={lng}
            onChange={(e) => setLng(e.target.value ? Number(e.target.value) : "")}
            placeholder="132.455"
          />
        </div>
      </div>

      {/* 公開範囲（place自体のvisibility） */}
      <fieldset
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: 10,
          marginTop: 8,
        }}
      >
        <legend style={{ padding: "0 6px", fontWeight: 700 }}>場所の公開範囲</legend>

        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4, fontSize: 14 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="radio"
              name="place_visibility"
              value="public"
              checked={visibility === "public"}
              onChange={() => setVisibility("public")}
            />
            公開（全国だれでもこのピンが見える）
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="radio"
              name="place_visibility"
              value="private"
              checked={visibility === "private"}
              onChange={() => setVisibility("private")}
            />
            非公開（自分だけ）
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="radio"
              name="place_visibility"
              value="pair"
              checked={visibility === "pair"}
              onChange={() => setVisibility("pair")}
            />
            ペア限定（ペア相手とのマップにだけ表示）
          </label>
        </div>

        <p style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
          ※ ここは「場所そのもの」の公開範囲だよ。メモの共有先は下のフォーム（MemoryForm）で決める。
        </p>
      </fieldset>

      <button
        type="submit"
        style={{
          marginTop: 8,
          background: "#111",
          color: "#fff",
          borderRadius: 8,
          border: "none",
          padding: "10px 14px",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        まず場所を保存
      </button>
    </form>
  );
}
