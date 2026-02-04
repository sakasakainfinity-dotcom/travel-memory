"use client";

export default function PhotoMapperSplash() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "radial-gradient(1200px 600px at 20% 10%, rgba(59,130,246,.18), transparent 60%), linear-gradient(135deg, #05070c, #0b1220, #060a12)",
        color: "#f8fafc",
      }}
    >
      <div style={{ width: "min(520px, 92vw)", textAlign: "center", display: "grid", gap: 10 }}>
        <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: -0.6, lineHeight: 1.1 }}>
          PhotoMapper
        </div>

        <div style={{ fontSize: 13, color: "rgba(226,232,240,0.7)" }}>
          大切な写真を、地図にしまう
        </div>

        <div
          style={{
            marginTop: 12,
            width: 220,
            height: 10,
            borderRadius: 999,
            background: "rgba(226,232,240,0.12)",
            overflow: "hidden",
            border: "1px solid rgba(148,163,184,0.18)",
          }}
        >
          <div
            style={{
              height: "100%",
              width: "55%",
              borderRadius: 999,
              background: "linear-gradient(90deg, rgba(59,130,246,0.9), rgba(16,185,129,0.8))",
              animation: "pm_bar 1.1s ease-in-out infinite",
            }}
          />
        </div>

        <div style={{ marginTop: 6, fontSize: 12, color: "rgba(226,232,240,0.7)" }}>
          読み込み中…
        </div>
      </div>

      <style>{`
        @keyframes pm_bar {
          0% { transform: translateX(-60%); opacity: 0.6; }
          50% { transform: translateX(40%); opacity: 1; }
          100% { transform: translateX(160%); opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
