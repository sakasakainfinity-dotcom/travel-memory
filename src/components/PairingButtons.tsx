// src/components/PairingButtons.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function PairingButtons({ pairId, inviteToken }: { pairId?: string; inviteToken?: string }) {
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(!!session));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!signedIn) return null; // ★ 未ログインなら一切出さない

  async function copyInvite() {
    if (!inviteToken) return alert("招待リンクがありません。ペアページで作成してください。");
    const url = `${location.origin}/pair?token=${inviteToken}`;
    await navigator.clipboard.writeText(url);
    alert("招待リンクをコピーしました！");
  }

  async function leavePair() {
    if (!pairId) return;
    if (!confirm("このペアから退出しますか？")) return;
    setBusy(true);
    try {
      const { data: me } = await supabase.auth.getUser();
      const uid = me.user?.id;
      if (!uid) throw new Error("not logged in");
      await supabase.from("pair_members").delete().eq("pair_id", pairId).eq("user_id", uid);
      alert("退出しました。");
      location.reload();
    } catch (e: any) {
      alert(e.message || "失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button onClick={copyInvite} disabled={busy} style={{ padding: "8px 12px" }}>
        招待リンクをコピー
      </button>
      <button onClick={leavePair} disabled={busy || !pairId} style={{ padding: "8px 12px" }}>
        ペアを退出
      </button>
    </div>
  );
}


















