import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import styles from "./photo-reward.module.css";

export const metadata: Metadata = {
  title: "PHOTO REWARD｜旅の写真を投稿して特典GET！",
  description: "大子町で撮った写真を3枚以上投稿して、宿で使える特典を受け取ろう。",
};

const steps = [
  {
    number: "01",
    title: "写真を撮る",
    description: "大子町で旅の写真を撮影",
    note: "1枚以上は顔が写った写真",
    icon: <CameraIcon />,
  },
  {
    number: "02",
    title: "3枚以上投稿",
    description: "このページからまとめて投稿",
    note: "複数スポット・お店も1回でOK",
    icon: <PhotosIcon />,
  },
] as const;

const rewards = [
  { label: "特典 A", title: <>ドリンク1杯<br />プレゼント</>, note: "滞在中に使える", icon: <DrinkIcon /> },
  { label: "特典 B", title: <>次回宿泊<br /><strong>500円OFF</strong></>, note: "次回使えるクーポン", icon: <CouponIcon /> },
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
        </header>

        <section className={styles.stepsSection} aria-labelledby="steps-title">
          <div className={styles.sectionHeading}>
            <h2 id="steps-title">HOW TO JOIN</h2>
          </div>
          <ol className={styles.steps}>
            {steps.map((step) => (
              <li key={step.number}>
                <div className={styles.stepCard}>
                  <div className={styles.stepTop}>
                    <span className={styles.stepNumber}>{step.number}</span>
                    <span className={styles.stepIcon} aria-hidden="true">{step.icon}</span>
                  </div>
                  <div className={styles.stepCopy}>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                    <strong>{step.note}</strong>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.rewardsSection} aria-labelledby="rewards-title">
          <h2 id="rewards-title">選べる特典</h2>
          <div className={styles.rewards}>
            {rewards.map((reward) => (
              <article key={reward.label}>
                <div className={styles.rewardVisual} aria-hidden="true">{reward.icon}</div>
                <p className={styles.rewardLabel}>{reward.label}</p>
                <h3>{reward.title}</h3>
                <p className={styles.rewardNote}>{reward.note}</p>
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

function DrinkIcon() {
  return <svg viewBox="0 0 64 64"><path d="M17 14h29l-3 39H20zM45 23h4a8 8 0 0 1 0 16h-5M15 53h31M22 24h21"/><path d="m36 8 8 16"/></svg>;
}

function CouponIcon() {
  return <svg viewBox="0 0 64 64"><path d="M10 20h44v10a7 7 0 0 0 0 14v10H10V44a7 7 0 0 0 0-14zM34 20v5M34 31v5M34 42v5M34 53v1"/><circle cx="23" cy="32" r="3"/><circle cx="23" cy="44" r="3"/><path d="m27 29-8 18"/></svg>;
}

function BellIcon() {
  return <svg viewBox="0 0 32 32"><path d="M7 23h18l-3-4v-6a6 6 0 0 0-12 0v6l-3 4Zm6 3h6"/></svg>;
}

function MailIcon() {
  return <svg viewBox="0 0 32 32"><rect x="4" y="7" width="24" height="18" rx="2"/><path d="m5 9 11 9L27 9"/></svg>;
}
