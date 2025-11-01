// src/app/pair/pair-page-inner.tsx
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
    const { data, error } = await supabase
      .from("pair_members")
      .select("pair_id, pair_groups:pair_id(id, name, owner_id, invite_token)")
      .order("joined_at", { ascending: false });

    if (error) {
      console.warn("load pairs failed", error);
      return;
    }
    const list = (data || []).map((r: any) => r.pair_groups as Pair);
    const map = new Map(list.map((p) => [p.id, p]));
    setPairs(Array.from(map.values()));
  }

  useEffect(() => {
    refresh();
  }, []);

  const hasToken = useMemo(() => !!token, [token]);

  async function createPair() {
  if (!me) return alert("ログインが必要です。");
  setLoading(true);
  try {
    const { data, error } = await supabase.rpc("create_pair_group", { p_name: newName || null });
    if (error) throw error;

    setNewName("");
    await refresh();
    alert("ペアを作成したよ。招待リンクを相手に送ってね。");
  } catch (e:any) {
    alert(e?.message || "作成に失敗しました");
  } finally {
    setLoading(false);
  }
}

  async function joinByToken() {
    if (!token) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc("pair_join_with_token", { p_token: token });
      if (error) throw error;
      await refresh();
      alert("ペアに参加したよ！");
    } catch (e: any) {
      alert(e?.message || "参加に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  function inviteUrl(p: Pair) {
    if (!p.invite_token) return "(招待コード未発行)";
    return `${location.origin}/pair?token=${p.invite_token}`;
  }

  return (
    <div style={{ maxWidth: 800, margin: "24px auto", padding: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800 }}>ペア管理</h1>

      {hasToken && (
        <div style={{ margin: "12px 0", padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          <b>招待リンクからアクセス中。</b>
          <div style={{ marginTop: 8 }}>
            <button onClick={joinByToken} disabled={loading} style={{ padding: "8px 12px", fontWeight: 700 }}>
              {loading ? "参加中…" : "このペアに参加する"}
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <h2 style={{ fontWeight: 700 }}>新しくペアを作る</h2>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input
            placeholder="ペア名（任意）"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ padding: 8, flex: 1 }}
          />
          <button onClick={createPair} disabled={loading} style={{ padding: "8px 12px", fontWeight: 700 }}>
            {loading ? "作成中…" : "作成"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <h2 style={{ fontWeight: 700 }}>あなたが入っているペア</h2>
        <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
          {pairs.length === 0 ? (
            <div style={{ color: "#666" }}>まだペアがありません。</div>
          ) : (
            pairs.map((p) => (
              <div key={p.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{p.name ?? "（無題ペア）"}</div>
                <div style={{ fontSize: 12, color: "#555", wordBreak: "break-all" }}>
                  招待リンク：{" "}
                  <a href={inviteUrl(p)} style={{ textDecoration: "underline" }}>
                    {inviteUrl(p)}
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
