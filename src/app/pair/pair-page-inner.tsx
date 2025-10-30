// src/app/pair/pair-page-inner.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// ここに、さっき作った中身（useSearchParams を使う本体）をそのまま移植
// ＝ これまでの PairPage コンポーネントの中身を丸ごとここへ
export default function PairPageInner() {
  const sp = useSearchParams();
  const token = sp.get("token");
  // ……（以前貼ったロジックそのまま）……
  // me, pairs, refresh(), createPair(), joinByToken() など全部ここ
  // return (...) もそのまま

  // -- 略（前メッセージの実装をそのままペーストしてください） --
  return (/* 既存のUI */);
}
