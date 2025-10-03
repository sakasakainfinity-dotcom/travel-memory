// src/lib/spacePairing.ts
"use client";
import { supabase } from "./supabaseClient";
import { ensureMySpace } from "./ensureMySpace";

/** ランダム招待コード生成（英大+小+数 10桁） */
function genCode(len = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/** 招待コードを作成 */
export async function createPairInvite(): Promise<{ code: string }> {
  const { data: ses } = await supabase.auth.getSession();
  const uid = ses.session?.user.id;
  if (!uid) throw new Error("ログインが必要です");

  const sp = await ensureMySpace();
  if (!sp?.id) throw new Error("Space を取得できませんでした");

  const code = genCode(10);

  const { error } = await supabase
    .from("pair_invites")
    .insert({ space_id: sp.id, code, created_by: uid });
  if (error) throw new Error(`招待作成に失敗: ${error.message}`);

  return { code };
}

/** 招待コードを使って参加 */
export async function redeemPairInvite(code: string): Promise<{ joinedSpaceId: string }> {
  const c = code.trim();
  if (!c) throw new Error("コードが空です");

  const { data: ses } = await supabase.auth.getSession();
  const uid = ses.session?.user.id;
  if (!uid) throw new Error("ログインが必要です");

  // 1) 招待を使用済みにする（used_by を自分にセット、used_at を now）
  //    RLS で「未使用＆期限内」だけ update 許可
  const { data: inviteRow, error: eUp } = await supabase
    .from("pair_invites")
    .update({ used_by: uid, used_at: new Date().toISOString() })
    .eq("code", c)
    .is("used_by", null)
    .lt("expires_at", new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString()) // 形式上の比較（RLSでも期限チェック済）
    .select("space_id")
    .single();

  if (eUp) throw new Error(`コードが無効か期限切れです: ${eUp.message}`);
  if (!inviteRow?.space_id) throw new Error("不正な招待です");

  const spaceId: string = (inviteRow as any).space_id;

  // 2) 自分をその Space の member として追加（既に居たら何もしない）
  const { data: exists } = await supabase
    .from("space_members")
    .select("space_id")
    .eq("space_id", spaceId)
    .eq("user_id", uid)
    .limit(1);
  if (!exists || exists.length === 0) {
    const { error: eIns } = await supabase
      .from("space_members")
      .insert({ space_id: spaceId, user_id: uid, role: "member" });
    if (eIns) throw new Error(`参加に失敗: ${eIns.message}`);
  }

  return { joinedSpaceId: spaceId };
}
