"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Entitlement = { id: string; entitlement_type: "if_then_bingo" | "stay_coupon"; active: boolean; valid_from: string | null; valid_until: string | null };
type Member = { user_id: string; email: string; status: "active" | "disabled"; admin_note: string | null; created_at: string; last_login_at: string | null; user_entitlements: Entitlement[] };

export default function MembersAdminPage() {
  const [members, setMembers] = useState<Member[]>([]); const [email, setEmail] = useState(""); const [note, setNote] = useState("");
  const [message, setMessage] = useState(""); const [allowed, setAllowed] = useState<boolean | null>(null);
  const request = useCallback(async (method: string, body?: unknown) => {
    const { data } = await supabase.auth.getSession();
    return fetch("/api/members", { method, headers: { authorization: `Bearer ${data.session?.access_token ?? ""}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  }, []);
  const load = useCallback(async () => { const response = await request("GET"); setAllowed(response.ok); if (response.ok) setMembers((await response.json()).members); }, [request]);
  useEffect(() => { void load(); }, [load]);
  async function add(event: FormEvent) { event.preventDefault(); const response = await request("POST", { email, adminNote: note }); const data = await response.json(); setMessage(response.ok ? data.existing ? "既存の会員を表示しました。" : "会員を追加しました。" : data.error); if (response.ok) { setEmail(""); setNote(""); await load(); } }
  async function update(body: unknown) { const response = await request("PATCH", body); setMessage(response.ok ? "変更を保存しました。" : (await response.json()).error); if (response.ok) await load(); }
  if (allowed === null) return <main className="members-admin"><p>管理者権限を確認中…</p></main>;
  if (!allowed) return <main className="members-admin"><h1>会員管理</h1><p>管理者だけがアクセスできます。</p></main>;
  return <main className="members-admin"><nav><Link href="/admin/bingo">旅ビンゴ管理</Link></nav><h1>会員管理</h1><form className="member-add" onSubmit={add}><h2>会員を追加</h2><input required type="email" placeholder="メールアドレス" value={email} onChange={e=>setEmail(e.target.value)}/><input placeholder="管理メモ（任意）" value={note} onChange={e=>setNote(e.target.value)}/><button>追加</button></form>{message&&<p role="status">{message}</p>}<div className="member-list">{members.map(member=><article key={member.user_id}><header><div><strong>{member.email}</strong><small>登録: {new Date(member.created_at).toLocaleString("ja-JP")}</small><small>最終ログイン: {member.last_login_at ? new Date(member.last_login_at).toLocaleString("ja-JP") : "未ログイン"}</small></div><label>状態<select value={member.status} onChange={e=>void update({userId:member.user_id,status:e.target.value,adminNote:member.admin_note})}><option value="active">有効</option><option value="disabled">停止</option></select></label></header><h3>利用可能サービス</h3><EntitlementEditor member={member} type="if_then_bingo" label="if then bingo" update={update}/><EntitlementEditor member={member} type="stay_coupon" label="滞在中クーポン" update={update}/></article>)}</div></main>;
}

function EntitlementEditor({member,type,label,update}:{member:Member;type:Entitlement["entitlement_type"];label:string;update:(body:unknown)=>Promise<void>}) {
  const current=member.user_entitlements.find(e=>e.entitlement_type===type); const [active,setActive]=useState(current?.active??false); const [from,setFrom]=useState(current?.valid_from?.slice(0,16)??""); const [until,setUntil]=useState(current?.valid_until?.slice(0,16)??"");
  return <div className="entitlement-row"><label><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/>{label}</label>{type==="stay_coupon"&&<><label>開始<input type="datetime-local" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>終了<input type="datetime-local" value={until} onChange={e=>setUntil(e.target.value)}/></label></>}<button onClick={()=>void update({userId:member.user_id,entitlement:{type,active,validFrom:from?new Date(from).toISOString():null,validUntil:until?new Date(until).toISOString():null}})}>保存</button></div>;
}
