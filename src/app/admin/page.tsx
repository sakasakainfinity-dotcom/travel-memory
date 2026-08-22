"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AdminNavigation from "@/components/admin/AdminNavigation";
import MagicLinkLogin from "@/components/MagicLinkLogin";
import { supabase } from "@/lib/supabaseClient";

type Access = "checking" | "signed-out" | "forbidden" | "allowed" | "error";

const adminTools = [
  { href: "/admin/members", icon: "♙", eyebrow: "MEMBERS", title: "会員管理", description: "会員の追加・停止と、ビンゴや滞在中クーポンの利用権限を設定します。", action: "会員を管理する" },
  { href: "/admin/bingo", icon: "▦", eyebrow: "BINGO", title: "旅ビンゴ管理", description: "町ごとのビンゴを作成し、25マスの内容や公開状態を編集します。", action: "ビンゴを編集する" },
  { href: "/admin/coupon-usages", icon: "◫", eyebrow: "COUPONS", title: "クーポン利用実績", description: "店舗別の利用件数を集計し、最近のクーポン利用履歴を確認します。", action: "利用実績を見る" },
] as const;

export default function AdminDashboardPage() {
  const [access, setAccess] = useState<Access>("checking");
  const [email, setEmail] = useState("");

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(async ({ data, error }) => {
      if (!active) return;
      if (error) { setAccess("error"); return; }
      if (!data.session) { setAccess("signed-out"); return; }
      setEmail(data.session.user.email ?? "");
      const { data: profile, error: profileError } = await supabase.from("profiles").select("is_admin").eq("id", data.session.user.id).maybeSingle();
      if (!active) return;
      if (profileError) setAccess("error");
      else setAccess(profile?.is_admin ? "allowed" : "forbidden");
    });
    return () => { active = false; };
  }, []);

  if (access === "checking") return <main className="admin-dashboard-state">管理者権限を確認しています…</main>;
  if (access === "signed-out") return <MagicLinkLogin next="/admin" title="管理者ログイン" />;
  if (access === "forbidden") return <main className="member-login"><div><p className="member-kicker">ADMIN ONLY</p><h1>管理画面</h1><p>このアカウントには管理者権限がありません。</p>{email && <p className="admin-login-email">ログイン中: {email}</p>}</div></main>;
  if (access === "error") return <main className="member-login"><div><p className="member-kicker">ADMIN</p><h1>管理画面</h1><p>管理者権限を確認できませんでした。時間をおいて、もう一度お試しください。</p></div></main>;

  return <main className="admin-dashboard">
    <AdminNavigation current="home" />
    <header className="admin-dashboard-hero"><div><p>ADMIN CONSOLE</p><h1>すべての管理を、<br />ここから。</h1><span>会員・旅ビンゴ・クーポンをひとつの管理トップから開けます。</span></div><div className="admin-dashboard-mark" aria-hidden><span>3</span><small>MANAGEMENT<br />TOOLS</small></div></header>
    <section className="admin-dashboard-tools" aria-label="管理機能">
      {adminTools.map((tool, index) => <Link href={tool.href} key={tool.href} className="admin-tool-card"><div className="admin-tool-number">0{index + 1}</div><div className="admin-tool-icon" aria-hidden>{tool.icon}</div><p>{tool.eyebrow}</p><h2>{tool.title}</h2><span>{tool.description}</span><strong>{tool.action}<i aria-hidden>→</i></strong></Link>)}
    </section>
    <footer className="admin-dashboard-footer"><span>管理者としてログイン中</span><strong>{email}</strong><Link href="/explore">ユーザー画面へ ↗</Link></footer>
  </main>;
}
