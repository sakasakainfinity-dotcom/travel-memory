"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Pair = { id: string; name: string | null; owner_id: string; invite_token: string | null };

export default function PairPageInner() {
  const sp = useSearchParams();
  const token = sp.get("token");
  const [me, setMe] = useState<string | null>(null);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  async function refresh() {
    const { data } = await supabase
      .from("pair_members")
      .select("pair_id, pair_groups:pair_id(id, name, owner_id, invite_token)")
      .order("joined_at", { ascending: false });

    const list = (data || []).map((r: any) => r.pair_groups as Pair);
    const map = new Map(list.map((p) => [p.id, p]));
    setPairs(Array.from(map.values()));
  }
  useEffect(() => { refresh(); }, []);

  const hasToken = useMemo(() => !!token, [token]);

  async function createPair() {
    if (!me) return alert("ログインが必要です。");
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("pair_groups")
        .insert({ owner_id: me, name: newName || null, invite_token: crypto.randomUUID() })
        .select()
        .single();
      if (error) throw error;

      await supabase.from("pair_members").insert({ pair_id: data.id, user_id: me, role: "owner" });

      setNewName("");
      await refresh();
      alert("ペアを作成しました。招待リンクを相手に送ってください。");
    } catch (e:any) {
      alert(e.message || "作成に失敗しました");
    } finally { setLoading(false); }
  }

  async function joinBy

