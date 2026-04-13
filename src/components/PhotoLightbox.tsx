"use client";

type Props = {
  src: string;
  title: string;
  memo: string;
  createdBy?: string;
  onClose: () => void;
};

export default function PhotoLightbox({ src, title, memo, createdBy, onClose }: Props) {
  return (
    <section
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(2, 6, 23, 0.88)",
        display: "grid",
        placeItems: "center",
      }}
    >
      <button
        type="button"
        onClick={onClose}
        style={{
          position: "absolute",
          top: "max(16px, env(safe-area-inset-top, 0px) + 8px)",
          right: "max(16px, env(safe-area-inset-right, 0px) + 8px)",
          width: 40,
          height: 40,
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.42)",
          background: "rgba(15,23,42,0.48)",
          color: "#fff",
          fontSize: 20,
          cursor: "pointer",
        }}
        aria-label="閉じる"
      >
        ×
      </button>

      <article
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100vw", height: "100vh", position: "relative", display: "grid", placeItems: "center" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={title}
          loading="eager"
          decoding="async"
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />

        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "24px 16px calc(20px + env(safe-area-inset-bottom, 0px))",
            background: "linear-gradient(to top, rgba(2,6,23,0.86), rgba(2,6,23,0.56) 52%, rgba(2,6,23,0))",
            color: "#fff",
            display: "grid",
            gap: 6,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 18 }}>{title}</div>
          {memo ? <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{memo}</div> : null}
          {createdBy ? <div style={{ fontSize: 12, opacity: 0.85 }}>by {createdBy}</div> : null}
        </div>
      </article>
    </section>
  );
}
