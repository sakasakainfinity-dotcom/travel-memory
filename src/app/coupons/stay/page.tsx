"use client";
import { useEffect, useState } from "react";
import MagicLinkLogin from "@/components/MagicLinkLogin";
import { supabase } from "@/lib/supabaseClient";

export default function StayCouponPage(){
  const [state,setState]=useState<"loading"|"login"|"active"|"before"|"expired"|"denied">("loading"); const [period,setPeriod]=useState("");
  useEffect(()=>{void (async()=>{const {data:{session}}=await supabase.auth.getSession();const user=session?.user;if(!user){setState("login");return;}const {data:member}=await supabase.from("member_accounts").select("status").eq("user_id",user.id).maybeSingle();const {data:e}=await supabase.from("user_entitlements").select("active,valid_from,valid_until").eq("user_id",user.id).eq("entitlement_type","stay_coupon").maybeSingle();if(member?.status!=="active"||!e?.active){setState("denied");return;}const now=Date.now(),from=e.valid_from?Date.parse(e.valid_from):null,until=e.valid_until?Date.parse(e.valid_until):null;setPeriod(`${e.valid_from?new Date(e.valid_from).toLocaleString("ja-JP"):"開始日なし"} 〜 ${e.valid_until?new Date(e.valid_until).toLocaleString("ja-JP"):"終了日なし"}`);setState(from&&now<from?"before":until&&now>until?"expired":"active");})();},[]);
  if(state==="login")return <MagicLinkLogin next="/coupons/stay" title="滞在中クーポン"/>; if(state==="loading")return <main className="coupon-page">確認中…</main>;
  return <main className="coupon-page"><div><p>まちやど公式予約者限定</p><h1>滞在中クーポン</h1><p>{period}</p>{state==="active"?<><h2>ご利用いただけます</h2><p>対象店舗で3,000円以上のお会計時に500円引き。</p></>:state==="before"?<h2>このクーポンはまだ利用期間前です</h2>:state==="expired"?<h2>このクーポンの利用期間は終了しました</h2>:<h2>このアカウントではクーポンを利用できません</h2>}</div></main>;
}
