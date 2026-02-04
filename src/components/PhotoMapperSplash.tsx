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
          "radial-gradient(1200px 600px at 20% 10%, rgba(59,130,246,.22), transparent 60%), linear-gradient(135deg, #05070c, #0b1220, #060a12)",
        color: "#f8fafc",
      }}
    >
      <div
        style={{
          width: "min(560px, 94vw)",
          display: "grid",
          gap: 14,
          textAlign: "center",
        }}
      >
        {/* Title */}
        <div style={{ display: "grid", gap: 6 }}>
          <div
            style={{
              fontSize: 30,
              fontWeight: 900,
              letterSpacing: -0.6,
              lineHeight: 1.1,
            }}
          >
            PhotoMapper
          </div>
          <div style={{ fontSize: 13, color: "rgba(226,232,240,0.7)" }}>
            大切な写真を、地図にしまう
          </div>
        </div>

        {/* Demo Card */}
        <div
          style={{
            position: "relative",
            borderRadius: 18,
            border: "1px solid rgba(148,163,184,0.18)",
            background: "rgba(15,23,42,0.6)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "12px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid rgba(148,163,184,0.14)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: "#22c55e",
                  boxShadow: "0 0 0 4px rgba(34,197,94,0.15)",
                }}
              />
              <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.9 }}>
                Mapping your photos…
              </span>
            </div>
            <div style={{ display: "flex", gap: 6, opacity: 0.6 }}>
              <i className="dot" />
              <i className="dot" />
              <i className="dot" />
            </div>
          </div>

          {/* Map Area */}
          <div style={{ position: "relative", height: 240 }}>
            {/* Grid */}
            <div className="grid-bg" />

            {/* Pins */}
            <div style={{ position: "absolute", left: 80, top: 90 }}>
              <Pin />
            </div>
            <div style={{ position: "absolute", left: 260, top: 130 }}>
              <Pin delayMs={220} />
            </div>
            <div style={{ position: "absolute", left: 360, top: 80 }}>
              <Pin delayMs={420} />
            </div>

            {/* Photo Card */}
            <div
              style={{
                position: "absolute",
                right: 14,
                bottom: 14,
                width: 170,
                borderRadius: 14,
                border: "1px solid rgba(148,163,184,0.18)",
                background: "rgba(15,23,42,0.7)",
                overflow: "hidden",
                boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
                animation: "pm_float 3.6s ease-in-out infinite",
              }}
            >
              <div
                style={{
                  height: 96,
                  background:
                    "linear-gradient(135deg, rgba(59,130,246,0.45), rgba(16,185,129,0.35))",
                }}
              />
              <div style={{ padding: 10, display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.95 }}>
                  New photo saved
                </div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>
                  Pin → Map → Memory
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Loader */}
        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 6 }}>
          <Spinner />
          <div style={{ fontSize: 12, color: "rgba(226,232,240,0.7)" }}>
            読み込み中…
          </div>
        </div>
      </div>

      {/* styles */}
      <style>{`
        .grid-bg {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(rgba(148,163,184,0.10) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148,163,184,0.10) 1px, transparent 1px);
          background-size: 28px 28px;
          background-color: rgba(2,6,23,0.55);
        }
        .dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: rgba(226,232,240,0.5);
          display: inline-block;
        }
        @keyframes pm_spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pm_pop {
          0%, 100% { transform: translateY(0) scale(1); opacity: .95; }
          50% { transform: translateY(-6px) scale(1.08); opacity: 1; }
        }
        @keyframes pm_float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
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
        borderTopColor: "rgba(226,232,240,0.9)",
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
        boxShadow:
          "0 0 0 10px rgba(96,165,250,0.14), 0 12px 28px rgba(0,0,0,0.35)",
        transformOrigin: "center",
        animation: "pm_pop 1.2s ease-in-out infinite",
        animationDelay: `${delayMs}ms`,
      }}
    />
  );
}
