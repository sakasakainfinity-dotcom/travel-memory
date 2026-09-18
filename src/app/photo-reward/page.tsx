import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import type { ReactNode } from "react";
import styles from "./photo-reward.module.css";

export const metadata: Metadata = {
  title: "PHOTO REWARD｜旅の写真を投稿して特典GET！",
  description: "大子町で撮った写真を3枚以上投稿して、宿で使える特典を受け取ろう。",
};

const steps: Array<{
  number: string;
  title: string;
  description: ReactNode;
  note?: string;
  icon: ReactNode;
}> = [
  {
    number: "01",
    title: "写真を撮る",
    description: <>街歩き・グルメ・自然・体験など、<br />大子町での旅の思い出を撮影。</>,
    icon: <CameraIcon />,
  },
  {
    number: "02",
    title: "3枚以上投稿",
    description: <>このページのフォームから<br />写真を3枚以上まとめて投稿。</>,
    note: "1枚以上は顔が写っている写真",
    icon: <PhotosIcon />,
  },
  {
    number: "03",
    title: "特典GET！",
    description: <>投稿が完了したら、<br />受付スタッフにお声がけください。</>,
    icon: <GiftIcon />,
  },
];

const conditions = [
  { icon: "3+", title: "3枚以上", text: "写真を3枚以上投稿" },
  { icon: "☺", title: "顔写真 1枚以上", text: "投稿写真のうち、1枚以上は顔が写っている写真" },
  { icon: "⌖", title: "複数スポットOK", text: "別々でなくてもOK。複数スポット・店舗の写真も1回にまとめられます" },
] as const;

const tallyEmbedUrl =
  "https://tally.so/embed/44Zkr5?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1";

export default function PhotoRewardPage() {
  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <nav aria-label="ガイドマップへ戻る">
          <Link className={styles.backLink} href="/stay/motomachi">
            <span aria-hidden="true">←</span> ガイドMAPに戻る
          </Link>
        </nav>

        <header className={styles.hero}>
          <p className={styles.eyebrow}>PHOTO REWARD</p>
          <h1>旅の写真を投稿して、<br /><em>特典GET！</em></h1>
          <p className={styles.lead}>大子町で撮った写真を3枚以上投稿すると、<br className={styles.desktopBreak} />宿で使える特典をプレゼント。</p>
          <a className={styles.heroJump} href="#post-form">写真を投稿する <span aria-hidden="true">↓</span></a>
        </header>

        <section className={styles.stepsSection} aria-labelledby="steps-title">
          <div className={styles.sectionHeading}>
            <p>HOW IT WORKS</p>
            <h2 id="steps-title"><span>3</span> STEPS</h2>
          </div>
          <ol className={styles.steps}>
            {steps.map((step) => (
              <li key={step.number}>
                <div className={styles.stepNumber}>{step.number}</div>
                <div className={styles.stepCard}>
                  <div className={styles.stepIcon} aria-hidden="true">{step.icon}</div>
                  <div className={styles.stepCopy}>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                    {step.note && <strong>{step.note}</strong>}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.conditionsSection} aria-labelledby="conditions-title">
          <div className={styles.sectionHeading}>
            <p>BEFORE YOU POST</p>
            <h2 id="conditions-title">投稿について</h2>
          </div>
          <div className={styles.conditions}>
            {conditions.map((condition) => (
              <article key={condition.title}>
                <span aria-hidden="true">{condition.icon}</span>
                <div><h3>{condition.title}</h3><p>{condition.text}</p></div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.formSection} id="post-form" aria-labelledby="form-title">
          <div className={styles.sectionHeading}>
            <p>POST YOUR PHOTOS</p>
            <h2 id="form-title">写真を投稿する</h2>
          </div>
          <div className={styles.formFrame}>
            <iframe
              data-tally-src={tallyEmbedUrl}
              src={tallyEmbedUrl}
              loading="lazy"
              width="100%"
              height="720"
              frameBorder="0"
              marginHeight={0}
              marginWidth={0}
              title="大子町 旅の写真投稿フォーム"
            />
          </div>
        </section>

        <section className={styles.afterPost} aria-labelledby="after-post-title">
          <div className={styles.sectionHeading}>
            <p>AFTER POSTING</p>
            <h2 id="after-post-title">投稿したら…</h2>
          </div>
          <div className={styles.afterCards}>
            <article>
              <span className={styles.afterIcon} aria-hidden="true"><BellIcon /></span>
              <p className={styles.cardLabel}>滞在中</p>
              <h3>受付スタッフに<br />「写真を投稿しました」<br />とお声がけください。</h3>
              <p className={styles.rewardLine}>特典をお渡しします <span aria-hidden="true">→</span></p>
            </article>
            <article>
              <span className={styles.afterIcon} aria-hidden="true"><MailIcon /></span>
              <p className={styles.cardLabel}>スタッフ不在・受け取れなかった場合</p>
              <h3>メールでご連絡ください</h3>
              <a href="mailto:sakazu8798@gmail.com">sakazu8798@gmail.com</a>
              <p>チェックアウトまでに受け取れなかった場合は、後日利用できる「特典クーポン画像」をお送りします。</p>
            </article>
          </div>
        </section>

        <footer className={styles.closing}>
          <span aria-hidden="true">✦</span>
          <p>大子町で見つけた、<br />あなたの旅の一枚をお待ちしています。</p>
        </footer>
      </div>
      <Script src="https://tally.so/widgets/embed.js" strategy="afterInteractive" />
    </main>
  );
}

function CameraIcon() {
  return <svg viewBox="0 0 64 64"><path d="M9 20h11l4-7h16l4 7h11v31H9z"/><circle cx="32" cy="35" r="10"/><path d="M48 26h1"/></svg>;
}

function PhotosIcon() {
  return <svg viewBox="0 0 64 64"><rect x="17" y="11" width="37" height="42" rx="2"/><path d="m18 44 11-12 8 8 5-6 12 13M25 25h.1"/><path d="M11 18v38h36"/></svg>;
}

function GiftIcon() {
  return <svg viewBox="0 0 64 64"><path d="M10 27h44v27H10zM7 19h50v10H7zM32 19v35"/><path d="M32 19c-5-12-17-9-14-2 2 4 8 3 14 2Zm0 0c5-12 17-9 14-2-2 4-8 3-14 2Z"/></svg>;
}

function BellIcon() {
  return <svg viewBox="0 0 32 32"><path d="M7 23h18l-3-4v-6a6 6 0 0 0-12 0v6l-3 4Zm6 3h6"/></svg>;
}

function MailIcon() {
  return <svg viewBox="0 0 32 32"><rect x="4" y="7" width="24" height="18" rx="2"/><path d="m5 9 11 9L27 9"/></svg>;
}
