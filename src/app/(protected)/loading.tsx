// src/app/(protected)/loading.tsx
export default function Loading() {
  return (
    <div
      style={{
        minHeight: "100svh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "radial-gradient(1200px 600px at 20% 10%, rgba(59,130,246,.18), transparent 60%), linear-gradient(135deg, #05070c, #0b1220, #060a12)",
        color: "#f8fafc",
      }}
    >
      <div
        style={{
          width: "min(520px, 92vw)",
          display: "grid",
          gap: 16,
          justifyItems: "center",
          textAlign: "center",
        }}
      >
        {/* Logo / Title */}
        <div style={{ display: "grid", gap: 6 }}>
          <div
            style={{
              fontSize: 28,
              fontWeight: 900,
              letterSpacing: -0.6,
              lineHeight: 1.1,
            }}
          >
            PhotoMapper
          </div>
          <div style={{ fontSize: 13, color: "rgba(226,232,240,0.65)" }}>
            大切な写真を、地図にしまう
          </div>
        </div>

        {/* Demo card */}
        <div
          style={{
            width: "100%",
            borderRadius: 18,
            border: "1px solid rgba(148,163,184,0.18)",
            background: "rgba(15,23,42,0.55)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
            overflow: "hidden",
          }}
        >
          {/* Fake map header */}
          <div
            style={{
              padding: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              borderBottom: "1px solid rgba(148,163,184,0.14)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: "#22c55e",
                  boxShadow: "0 0 0 4px rgba(34,197,94,0.15)",
                }}
              />
              <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(226,232,240,0.85)" }}>
                Mapping your photos...
              </div>
            </div>

            {/* Dots */}
            <div style={{ display: "flex", gap: 6, opacity: 0.7 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "rgba(226,232,240,0.45)" }} />
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "rgba(226,232,240,0.35)" }} />
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "rgba(226,232,240,0.25)" }} />
            </div>
          </div>

          {/* Fake map area */}
          <div style={{ position: "relative", height: 220, background: "rgba(2,6,23,0.55)" }}>
            {/* grid */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage:
                  "linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)",
                backgroundSize: "28px 28px",
                filter: "blur(0px)",
              }}
            />

            {/* pins */}
            <div style={{ position: "absolute", left: 70, top: 70 }}>
              <Pin />
            </div>
            <div style={{ position: "absolute", left: 280, top: 120 }}>
              <Pin delayMs={250} />
            </div>

            {/* photo card */}
            <div
              style={{
                position: "absolute",
                right: 14,
                bottom: 14,
                width: 160,
                borderRadius: 14,
                border: "1px solid rgba(148,163,184,0.18)",
                background: "rgba(15,23,42,0.65)",
                overflow: "hidden",
                boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
              }}
            >
              <div
                style={{
                  height: 90,
                  background:
                    "linear-gradient(135deg, rgba(59,130,246,0.35), rgba(16,185,129,0.25))",
                }}
              />
              <div style={{ padding: 10, display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(226,232,240,0.9)" }}>
                  New photo saved
                </div>
                <div style={{ fontSize: 11, color: "rgba(226,232,240,0.65)" }}>
                  Pin → Map → Memory
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Spinner */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
          <Spinner />
          <div style={{ fontSize: 12, color: "rgba(226,232,240,0.7)" }}>
            読み込み中…
          </div>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div
      style={{
        width: 18,
        height: 18,
        borderRadius: 999,
        border: "2px solid rgba(226,232,240,0.25)",
        borderTopColor: "rgba(226,232,240,0.85)",
        animation: "pm_spin 0.8s linear infinite",
      }}
    />
  );
}

function Pin({ delayMs = 0 }: { delayMs?: number }) {
  return (
    <div
      style={{
        width: 14,
        height: 14,
        borderRadius: 999,
        background: "#60a5fa",
        boxShadow: "0 0 0 10px rgba(96,165,250,0.14), 0 12px 28px rgba(0,0,0,0.35)",
        transformOrigin: "center",
        animation: `pm_pop 1.2s ease-in-out infinite`,
        animationDelay: `${delayMs}ms`,
      }}
    />
  );
}

/**
 * App Router の loading.tsx は CSS ファイル無しでも動くけど、
 * keyframes は必要。ここは style タグで埋め込み。
 */
const styleTag = (
  <style>{`
  @keyframes pm_spin { to { transform: rotate(360deg); } }
  @keyframes pm_pop {
    0%, 100% { transform: translateY(0) scale(1); opacity: 0.95; }
    50% { transform: translateY(-6px) scale(1.08); opacity: 1; }
  }
`}</style>
);

// Next.js はコンポーネント返り値に styleTag を入れられるように、上で定義して最後に追加したい。
// ただし JSX 直足しが分かりやすいので、Loading に差し込みたい人は下の行を Loading の一番下に入れて。
// （今のままでも動くが、アニメが効かない場合がある）
