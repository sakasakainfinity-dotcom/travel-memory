import Link from "next/link";

export type AdminSection = "home" | "members" | "bingo" | "stay-maps";

const sections = [
  { key: "home", href: "/admin", label: "管理トップ" },
  { key: "members", href: "/admin/members", label: "会員管理" },
  { key: "bingo", href: "/admin/bingo", label: "旅ビンゴ" },
  { key: "stay-maps", href: "/admin/stay-maps", label: "宿専用MAP" },
] as const;

export default function AdminNavigation({ current }: { current: AdminSection }) {
  return <nav className="admin-global-nav" aria-label="管理メニュー">
    <Link className="admin-global-brand" href="/admin"><span>PHOTO MAPPER</span><strong>管理画面</strong></Link>
    <div>{sections.map(section => <Link key={section.key} href={section.href} aria-current={current === section.key ? "page" : undefined}>{section.label}</Link>)}</div>
  </nav>;
}
