"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import PhotoGrid from "@/components/PhotoGrid";
import type { Place } from "@/types/db";

type Photo = {
  id: string;
  file_url: string;
  w: number | null;
  h: number | null;
  created_at: string;
};

export default function PlaceDetailPage() {
  const params = useParams<{ id: string }>();
  // 念のため配列対策（型はstringのはずだけど保険）
  const placeId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [place, setPlace] = useState<Place | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!placeId) return;
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const { data: p, error: e1 } = await supabase
          .from("places")
          .select("*")
          .eq("id", placeId)
          .single();
        if (e1) throw e1;
        setPlace(p as Place);
      } catch (e: any) {
        setErr(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [placeId]);

  // place に紐づく memories → photos
  useEffect(() => {
    if (!placeId) return;
    (async () => {
      try {
        const { data: ms, error: em } = await supabase
          .from("memories")
          .select("id")
          .eq("place_id", placeId);
        if (em) throw em;

        if (!ms || ms.length === 0) {
          setPhotos([]);
          return;









