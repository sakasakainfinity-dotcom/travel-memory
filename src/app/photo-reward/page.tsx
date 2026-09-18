import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import styles from "./photo-reward.module.css";

export const metadata: Metadata = {
  title: "写真を投稿して、特典GET！",
  description: "大子町で撮った旅の写真を投稿して、宿で特典を受け取ろう。",
};

const steps = [
  {
    number: "01",
    title: "大子町を楽しむ",
    description: "街歩き・グルメ・自然・体験など、大子町で旅の写真を撮影。",
  },
  {
    number: "02",
    title: "写真を3枚以上投稿",
    description: "このページのフォームから、旅の写真を3枚以上投稿。",
  },
  {
    number: "03",
    title: "特典GET！",
    description: "投稿完了後、宿で特典を受け取れます。",
  },
] as const;

// 投稿条件を変更するときは、この配列の文言のみを編集してください。
const photoGuidelines = [
  "大子町で撮影した写真",
  "街歩き、グルメ、自然、体験など",
  "3枚以上投稿してください",
  "旅を楽しんでいる様子が伝わる写真、大歓迎",
] as const;

const tallyEmbedUrl =
  "https://tally.so/embed/kdLAGd?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1";

export default function PhotoRewardPage() {
  return (
    <main className={styles.page}>
      <div className={styles.bookPage}>
        <nav aria-label="ガイドマップへ戻る">
          <Link className={styles.backLink} href="/stay/motomachi">
            <span aria-hidden="true">←</span> ガイドMAPに戻る
          </Link>
        </nav>

        <header className={styles.hero}>
          <p className={styles.eyebrow}>DAIGO TRAVEL PHOTO</p>
          <h1>写真を投稿して、特典GET！</h1>
          <p>
            大子町で撮った旅の写真を
            <br />
            <strong>3枚以上</strong>投稿すると、特典をプレゼント！
          </p>
        </header>

        <section className={styles.stepsSection} aria-labelledby="steps-title">
          <h2 id="steps-title">参加方法</h2>
          <ol className={styles.steps}>
            {steps.map((step) => (
              <li key={step.number}>
                <span className={styles.stepNumber}>{step.number}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.guidelines} aria-labelledby="guidelines-title">
          <p className={styles.sectionLabel}>PHOTO GUIDE</p>
          <h2 id="guidelines-title">こんな写真を待っています</h2>
          <ul>
            {photoGuidelines.map((guideline) => (
              <li key={guideline}>{guideline}</li>
            ))}
          </ul>
        </section>

        <section className={styles.formSection} aria-labelledby="form-title">
          <p className={styles.sectionLabel}>POST YOUR PHOTOS</p>
          <h2 id="form-title">ここから写真を投稿</h2>
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
      </div>
      <Script src="https://tally.so/widgets/embed.js" strategy="afterInteractive" />
    </main>
  );
}
