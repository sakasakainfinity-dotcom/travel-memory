export default function BackToMapButton() {
  return (
    <a
      href="/"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        marginTop: 16,
        fontWeight: 800,
        textDecoration: "none",
        padding: "10px 14px",
        borderRadius: 999,
        border: "1px solid rgba(0,0,0,.08)",
        background: "rgba(255,255,255,0.85)",
        boxShadow: "0 6px 20px rgba(0,0,0,.08)",
        backdropFilter: "saturate(120%) blur(6px)",
      }}
      aria-label="地図に戻る"
    >
      地図に戻る →
    </a>
  );
}
