"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type PairGroup = {
  id: string;
  name: string | null;
  owner_id: string;
  invite_token: string | null;
};

export default function PairPageInner() {
  const params = useSearchParams();
  const token = useMemo(() => params.get("token"), [params]);

  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [pairs, setPairs] = useState<PairGroup[]>([]);

  // 初回＆参加後の一覧取得
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    const { data: me } = await supabase.auth.getUser();
    const uid = me?.user?.id;
    if (!uid) {
      setPairs([]);
      return;
    }

    // 1) 自分の membership だけ拾う（JOINしない＝曖昧id回避）
    const { data: mem, error: e1 } = await supabase
      .from("pair_members")
      .select("pair_id")
      .eq("user_id", uid);

    if (e1) {
      console.warn(e1);
      setPairs([]);
      return;
    }

    const ids = (mem ?? []).map((r: any) => r.pair_id);
    if (ids.length === 0) {
      setPairs([]);
      return;
    }

    // 2) その id 群で pair_groups を取得
    const { data: groups, error: e2 } = await supabase
      .from("pair_groups")
      .select("id, name, owner_id, invite_token")
      .in("id", ids);

    if (e2) {
      console.warn(e2);
      setPairs([]);
      return;
    }
    setPairs((groups ?? []) as PairGroup[]);
  }

  // ペア作成（RPC：親→自分をownerで追加をトランザクション実行）
  async function createPair() {
    setLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess?.session) throw new Error("ログインしてから実行してね。");

      const { error } = await supabase.rpc("create_pair_group", {
        p_name: newName || null,
      });
      if (error) throw error;

      setNewName("");
      await refresh();
      alert("ペアを作成したよ。招待リンクを相手に送ってね。");
    } catch (e: any) {
      alert(e?.message || "作成に失敗したよ。");
    } finally {
      setLoading(false);
    }
  }

  // 招待リンクから参加
  async function joinByToken() {
    if (!token) return;
    setLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess?.session) throw new Error("ログインしてから実行してね。");

      const { error } = await supabase.rpc("pair_join_with_token", {
        p_token: token,
        p_role: "member",
      });
      if (error) throw error;

      await refresh();
      alert("ペアに参加したよ！");
      // URLの?tokenを消しておく（履歴は残さず置換）
      const u = new URL(location.href);
      u.searchParams.delete("token");
      history.replaceState(null, "", u.toString());
    } catch (e: any) {
      alert(e?.message || "参加に失敗したよ。");
    } finally {
      setLoading(false);
    }
  }

  // 招待リンクコピー
  async function copyInvite(invite_token: string | null) {
    if (!invite_token) {
      alert("このペアには招待トークンがまだ無いみたい。");
      return;
    }
    const url = `${location.origin}/pair?token=${invite_token}`;
    await navigator.clipboard.writeText(url);
    alert("招待リンクをコピーしたよ！");
  }

  return (
    <div style={{ maxWidth: 720, margin: "24px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>ペア管理</h1>

      {/* 招待リンクから参加（URLに?token=...がある時だけ出す） */}
      {token && (
        <div
          style={{
            border: "1px solid #ddd",
            padding: 12,
            borderRadius: 10,
            marginBottom: 16,
            background: "#fffbe6",
          }}
        >
          <div style={{ marginBottom: 8 }}>招待リンクが開かれとるけぇ、参加できるよ。</div>
          <button onClick={joinByToken} disabled={loading} style={{ padding: "8px 12px", fontWeight: 700 }}>
            {loading ? "参加中…" : "このペアに参加する"}
          </button>
        </div>
      )}

      {/* 新規作成 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 8,
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="サンプルペアー"
          style={{ padding: 10, border: "1px solid #ddd", borderRadius: 10 }}
        />
        <button onClick={createPair} disabled={loading} style={{ padding: "10px 14px", fontWeight: 800 }}>
          {loading ? "作成中…" : "作成"}
        </button>
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 800, margin: "12px 0" }}>あなたが入っているペア</h2>
      {pairs.length === 0 ? (
        <p style={{ color: "#666" }}>まだペアがありません。</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {pairs.map((g) => (
            <div
              key={g.id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: 800 }}>{g.name || "（名前未設定）"}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>ID: {g.id}</div>
              </div>
              <button onClick={() => copyInvite(g.invite_token)} style={{ padding: "8px 12px", fontWeight: 700 }}>
                招待リンクをコピー
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
