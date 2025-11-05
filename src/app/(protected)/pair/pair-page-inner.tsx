"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type PairGroup = {
  id: string;
  name: string | null;
  owner_id: string;
  invite_token: string | null;
};

export default function PairPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = useMemo(() => params.get("token"), [params]);

  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [pairs, setPairs] = useState<PairGroup[]>([]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess?.session) { setPairs([]); return; }

      // RPC一本：JOINなし、列名固定
      const { data, error } = await supabase.rpc("get_my_pairs");
      if (error) throw error;

      setPairs((data ?? []).map((r: any) => ({
        id: r.pair_group_id,
        name: r.name,
        owner_id: r.owner_id,
        invite_token: r.invite_token,
      })));
    } catch (e) {
      console.warn(e);
      setPairs([]);
    }
  }

  async function createPair() {
    setLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess?.session) throw new Error("ログインしてから実行してね。");

      const { error } = await supabase.rpc("create_pair_group", { p_name: newName || null });
      if (error) throw error;

      setNewName("");
      await refresh();
      alert("ペアを作成したよ。招待リンクを相手に送ってね。");
    } catch (e: any) {
      alert(e?.message || "作成に失敗したよ。");
    } finally { setLoading(false); }
  }

  async function joinByToken() {
    if (!token) return;
    setLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess?.session) throw new Error("ログインしてから実行してね。");

      const { error } = await supabase.rpc("pair_join_with_token", { p_token: token, p_role: "member" });
      if (error) throw error;

      await refresh();
      alert("ペアに参加したよ！");
      const u = new URL(location.href);
      u.searchParams.delete("token");
      history.replaceState(null, "", u.toString());
    } catch (e: any) {
      alert(e?.message || "参加に失敗したよ。");
    } finally { setLoading(false); }
  }

  async function copyInvite(invite_token: string | null) {
    if (!invite_token) { alert("このペアには招待トークンがまだ無いみたい。"); return; }
    const url = `${location.origin}/pair?token=${invite_token}`;
    await navigator.clipboard.writeText(url);
    alert("招待リンクをコピーしたよ！");
  }

  // ── UI ──────────────────────────────────────────────────────────────
  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      {/* 背景：透明度高めの青グラデ＋ぼかし */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          background:
            "radial-gradient(1200px 800px at 20% -10%, rgba(56,130,246,0.25), transparent 60%)," +
            "radial-gradient(1000px 700px at 90% 10%, rgba(99,102,241,0.18), transparent 60%)," +
            "linear-gradient(180deg, rgba(3,22,52,0.65), rgba(3,22,52,0.65))",
          backdropFilter: "blur(6px)",
          zIndex: 0,
        }}
      />

      {/* ヘッダー */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 16px",
          background: "rgba(12,24,48,0.55)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(6px)",
        }}
      >
        <button
          onClick={() => router.push("/")}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.06)",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          ← 戻る
        </button>
        <h1 style={{ color: "#EAF2FF", fontSize: 18, fontWeight: 800, letterSpacing: 0.3 }}>
          ペア管理
        </h1>
      </header>

      {/* コンテンツカード */}
      <main
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 900,
          margin: "24px auto",
          padding: "0 16px",
        }}
      >
        {/* 招待トークン通知 */}
        {token && (
          <div
            style={{
              border: "1px solid rgba(255,255,255,0.18)",
              background: "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06))",
              color: "#EAF2FF",
              borderRadius: 14,
              padding: 14,
              marginBottom: 16,
              boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ marginBottom: 8, fontWeight: 700 }}>招待リンクから開いとるけぇ、すぐ参加できるよ。</div>
            <button
              onClick={joinByToken}
              disabled={loading}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(59,130,246,0.25)",
                color: "#fff",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {loading ? "参加中…" : "このペアに参加する"}
            </button>
          </div>
        )}

        {/* 新規作成カード */}
        <section
          style={{
            border: "1px solid rgba(255,255,255,0.18)",
            background: "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06))",
            color: "#EAF2FF",
            borderRadius: 18,
            padding: 16,
            marginBottom: 20,
            boxShadow: "0 12px 28px rgba(0,0,0,0.25)",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center" }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="新しいペアの名前"
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.22)",
                background: "rgba(255,255,255,0.08)",
                color: "#fff",
                outline: "none",
              }}
            />
            <button
              onClick={createPair}
              disabled={loading}
              style={{
                padding: "12px 16px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.22)",
                background: "rgba(37,99,235,0.55)",
                color: "#fff",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {loading ? "作成中…" : "作成"}
            </button>
          </div>
          <p style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
            ペアを作ったら、招待リンクを共有して相手を呼び込めるよ。
          </p>
        </section>

        {/* ペア一覧（複数対応のグリッド） */}
        <h2 style={{ color: "#D8E6FF", fontSize: 16, fontWeight: 800, margin: "12px 0" }}>
          あなたが入っているペア
        </h2>

        {pairs.length === 0 ? (
          <p style={{ color: "rgba(255,255,255,0.8)" }}>まだペアが無いみたい。</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 12,
            }}
          >
            {pairs.map((g) => (
              <div
                key={g.id}
                style={{
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))",
                  color: "#EAF2FF",
                  borderRadius: 16,
                  padding: 14,
                  boxShadow: "0 10px 24px rgba(0,0,0,0.22)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>
                    {g.name || "（名前未設定）"}
                  </div>
                  {/* ロール表示（owner/ member） */}
                  <RoleBadge pairId={g.id} ownerId={g.owner_id} />
                </div>

                <div style={{ fontSize: 12, opacity: 0.85 }}>ID: {g.id}</div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => copyInvite(g.invite_token)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.22)",
                      background: "rgba(59,130,246,0.25)",
                      color: "#fff",
                      fontWeight: 800,
                      cursor: "pointer",
                      flex: "0 0 auto",
                    }}
                  >
                    招待リンクをコピー
                  </button>
                  <button
                    onClick={() => router.push(`/pair/${g.id}`)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.22)",
                      background: "rgba(255,255,255,0.08)",
                      color: "#fff",
                      fontWeight: 800,
                      cursor: "pointer",
                      flex: "1 1 auto",
                    }}
                  >
                    開く
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

/** ロール表示バッジ（owner / member） */
function RoleBadge({ pairId, ownerId }: { pairId: string; ownerId: string }) {
  const [role, setRole] = useState<"owner" | "member" | null>(null);

  useEffect(() => {
    (async () => {
      const { data: me } = await supabase.auth.getUser();
      const uid = me?.user?.id;
      if (!uid) return;
      setRole(uid === ownerId ? "owner" : "member");
    })();
  }, [ownerId]);

  const bg = role === "owner" ? "rgba(16,185,129,0.25)" : "rgba(99,102,241,0.25)";
  const label = role === "owner" ? "オーナー" : "メンバー";

  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 800,
        padding: "4px 8px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.22)",
        background: bg,
        color: "#fff",
      }}
    >
      {label}
    </span>
  );
}
