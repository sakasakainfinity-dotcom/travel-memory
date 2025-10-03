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
      })
      .select("id")
      .single();
    if (error) return alert(error.message);
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
