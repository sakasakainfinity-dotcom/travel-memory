// src/lib/ensureMySpace.ts
"use client";
import { supabase } from "./supabaseClient";

/**
 * 必ず space.id を返す開発用ユーティリティ
 * - ログイン済: これまで通り自分の space を返す（無ければ作成）
 * - 未ログイン: 共有スペース "public-space" を作成/取得して返す（RLSゆるめ前提の開発用）
 */
export async function ensureMySpace(): Promise<{ id: string } | null> {
  // 1) セッション
  const { data: ses, error: eSess } = await supabase.auth.getSession();
  if (eSess) throw eSess;
  const uid = ses.session?.user.id ?? null;

  // 2) ログイン済みなら従来ロジック
  if (uid) {
    // 2-1) 既存メンバー行
    const { data: myMembers, error: e0 } = await supabase
      .from("space_members")
      .select("space_id, role")
      .eq("user_id", uid)
      .limit(1);
    if (e0) throw e0;
    if (myMembers && myMembers.length > 0) {
      return { id: myMembers[0].space_id as string };
    }

    // 2-2) スペースを新規作成
    const { data: insertedSpace, error: e1 } = await supabase
      .from("spaces")
      .insert({ name: "My Space", type: "solo", owner_id: uid })
      .select("id")
      .single();
    if (e1) throw e1;

    // 2-3) 自分をメンバー追加
    const { error: e2 } = await supabase
      .from("space_members")
      .insert({ space_id: insertedSpace.id, user_id: uid, role: "owner" });
    if (e2) throw e2;

    return { id: insertedSpace.id as string };
  }

  // 3) 未ログイン時は 共有スペース "public-space" を返す（無ければ作る）
  //    ※ RLS は開発用に public に開けておく前提
  //    先に存在確認
  const { data: existing, error: eFind } = await supabase
    .from("spaces")
    .select("id")
    .eq("name", "public-space")
    .limit(1);
  if (eFind) throw eFind;
  if (existing && existing.length > 0) {
    return { id: existing[0].id as string };
  }

  // 無ければ作る（owner_id は null 許容の設計でOK / 既に NOT NULL ならダッシュボードで owner_id に任意のUUIDを入れて許容に変えて）
  const { data: inserted, error: eIns } = await supabase
    .from("spaces")
    .insert({ name: "public-space", type: "solo", owner_id: null })
    .select("id")
    .single();
  if (eIns) throw eIns;

  return { id: inserted.id as string };
}

