import Image from "next/image";
import Link from "next/link";
import { daigoStayBenefits, type DaigoStayBenefit } from "./stay-benefits";

function BenefitCard({ benefit }: { benefit: DaigoStayBenefit }) {
  if (benefit.recruiting) return <article className="daigo-benefit-recruiting">
    <small>COMING SOON</small><span aria-hidden>＋</span><h3>{benefit.name}</h3>
    <p>宿泊者と町をつなぐ<br />特典パートナーを<br />募集しています</p>
  </article>;

  const content = <><div className="daigo-benefit-image"><Image src={benefit.image ?? "/motomachi.jpg"} alt={`${benefit.name}の写真`} fill sizes="(max-width: 699px) 50vw, 240px" /></div>
    <div className="daigo-benefit-body"><span>宿泊者限定</span><h3>{benefit.name}</h3><strong>{benefit.benefit}</strong>
      {benefit.condition && <p><b>利用条件</b>{benefit.condition}</p>}{benefit.address && <address>{benefit.address}</address>}{benefit.hours && <p><b>営業時間</b>{benefit.hours}</p>}<i aria-hidden>詳しく見る →</i></div></>;
  return benefit.link?.startsWith("http")
    ? <a className="daigo-benefit-card" href={benefit.link} target="_blank" rel="noreferrer">{content}</a>
    : <Link className="daigo-benefit-card" href={benefit.link ?? "#"}>{content}</Link>;
}

export default function StayBenefitsSection() {
  return <section className="daigo-benefits" aria-labelledby="daigo-benefits-title">
    <div className="daigo-benefits-heading"><small>DAIGO STAY BENEFIT</small><h2 id="daigo-benefits-title">まちやど宿泊者限定特典</h2>
      <p>大子町の対象まちやどに宿泊すると、町のお店や施設で使える限定特典をご利用いただけます。</p>
      <p className="daigo-benefits-note">特典の利用にはPhotoMapperへの会員登録と対象宿泊施設の予約が必要です。特典の内容はログインなしでご覧いただけます。</p></div>
    <div className="daigo-benefits-grid">{daigoStayBenefits.map((benefit) => <BenefitCard key={benefit.id} benefit={benefit} />)}</div>
    <div className="daigo-benefits-cta"><small>STAY &amp; ENJOY DAIGO</small><h3>この特典を使って大子町を楽しむ</h3>
      <p>PhotoMapperに会員登録し、対象のまちやどを予約すると宿泊者限定特典をご利用いただけます。</p>
      <a className="daigo-primary" href="https://daigo-machiyado.jp/" target="_blank" rel="noreferrer">大子町のまちやどを見る<span aria-hidden>→</span></a>
      <Link className="daigo-benefits-use" href="/coupons/stay">対象者の方はこちらからクーポンを使う</Link></div>
  </section>;
}
