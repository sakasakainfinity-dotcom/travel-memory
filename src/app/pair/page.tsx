import { Suspense } from "react";
import PairPageInner from "./pair-page-inner";

// ← これらはサーバー側のファイルでだけ書ける
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function PairPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>読み込み中…</div>}>
      <PairPageInner />
    </Suspense>
  );
}

