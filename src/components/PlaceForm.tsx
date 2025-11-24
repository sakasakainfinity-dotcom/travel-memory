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

  // ★ 公開／非公開
  const [visibility, setVisibility] = useState<"public" | "private">("private");

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
        visibility, // ★ ここで保存
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

      {/* 公開範囲 */}
      <fieldset
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: 10,
          marginTop: 8,
        }}
      >
        <legend style={{ padding: "0 6px", fontWeight: 700 }}>公開範囲</legend>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 4 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="radio"
              name="visibility"
              value="public"
              checked={visibility === "public"}
              onChange={() => setVisibility("public")}
            />
            公開（みんなに見せる）
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="radio"
              name="visibility"
              value="private"
              checked={visibility === "private"}
              onChange={() => setVisibility("private")}
            />
            非公開（自分だけ）
          </label>
        </div>

        <p style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
          ※ 迷ったら非公開にしとき。あとから公開に変えるUIもそのうち付けよ。
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

