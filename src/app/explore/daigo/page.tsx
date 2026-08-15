import Link from "next/link";
import AppMenu from "@/components/AppMenu";

const services = [
  { title: "町BINGO", description: "町を歩きながら、写真と謎解きを楽しもう。", href: "/bingo/daigo", action: "BINGOを開く" },
  { title: "滞在中クーポン", description: "対象の宿泊者が利用できる、大子町での特典です。", href: "/coupons/stay", action: "クーポンを確認" },
];

export default function DaigoExplorePage() {
  return <main className="bingo-shell"><AppMenu current="town-bingo"/><div className="bingo-wrap explore-page">
    <Link className="bingo-back-link" href="/explore">← 町探索</Link>
    <div className="bingo-brand">茨城県</div><h1 className="bingo-title">大子町</h1>
    <p className="explore-lead">歩いて、見つけて、大子町を楽しもう。</p>
    <div className="explore-services">{services.map(service => <article className="bingo-card" key={service.title}><h2>{service.title}</h2><p>{service.description}</p><Link className="explore-primary" href={service.href}>{service.action} <span aria-hidden>→</span></Link></article>)}</div>
    <article className="bingo-card explore-info"><h2>対象店舗・地域情報</h2><p>クーポン対象店や、町歩きにおすすめの情報は順次ご案内します。</p></article>
    <Link className="explore-member-link" href="/member">マイページへ</Link>
  </div></main>;
}
