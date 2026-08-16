import Link from "next/link";
import AppMenu from "@/components/AppMenu";

export default function ExplorePage() {
  return <main className="bingo-shell"><AppMenu current="town-bingo"/><div className="bingo-wrap explore-page">
    <Link className="explore-secret-link" href="/habit" aria-label="IF THEN BINGOを開く">
      IF THEN BINGO
    </Link>
    <div className="bingo-brand">PHOTO MAPPER</div>
    <h1 className="bingo-title">町探索</h1>
    <p className="explore-lead">気になる町を選んで探索しよう。</p>
    <section className="bingo-list" aria-label="探索できる町">
      <article className="bingo-card explore-town-card">
        <div className="bingo-brand">茨城県</div><h2>大子町</h2>
        <p>町BINGO・滞在中クーポン・お店や地域の情報を楽しめます。</p>
        <Link className="explore-primary" href="/explore/daigo">大子町を探索する <span aria-hidden>→</span></Link>
      </article>
    </section>
    <Link className="explore-member-link" href="/member">会員の方はこちら</Link>
  </div></main>;
}
