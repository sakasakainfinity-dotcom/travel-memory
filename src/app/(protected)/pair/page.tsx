// src/app/pair/page.tsx
import { Suspense } from "react";
import PairPageInner from "./pair-page-inner";

// 静的書き出しを止める（プレビューでも本番でもOK）
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function PairPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>読み込み中…</div>}>
      <PairPageInner />
    </Suspense>
  );
}

// 参加ボタンのハンドラ（TS/React）
async function joinByToken() {
  if (!token) return;           // URLから拾った?token
  setLoading(true);
  try {
    const { error } = await supabase.rpc("pair_join_with_token", {
      p_token: token,
      p_role: "member",
    });
    if (error) throw error;
    await refresh();
    alert("ペアに参加したよ！");
  } catch (e: any) {
    alert(e?.message || "参加に失敗しました");
  } finally {
    setLoading(false);
  }
}
