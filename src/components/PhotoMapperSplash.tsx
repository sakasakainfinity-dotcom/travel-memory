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
          "radial-gradient(900px 500px at 20% 10%, rgba(59,130,246,.18), transparent 60%), linear-gradient(135deg, #05070c, #0b1220, #060a12)",
        color: "#f8fafc",
        overflow: "hidden",
      }}
    >
      {/* Mosaic Japan (stylized) */}
      <JapanMosaic />

      {/* Center text */}
      <div style={{ position: "relative", textAlign: "center", display: "grid", gap: 10 }}>
        <div
          style={{
            fontSize: 42,
            fontWeight: 950,
            letterSpacing: -1.0,
            lineHeight: 1.0,
            textShadow: "0 14px 60px rgba(0,0,0,0.55)",
          }}
        >
          PhotoMapper
        </div>

        <div style={{ fontSize: 13, color: "rgba(226,232,240,0.7)" }}>
          大切な写真を、地図にしまう
        </div>

        <div style={{ marginTop: 14, display: "flex", justifyContent: "center", gap: 10 }}>
          <Spinner />
          <div style={{ fontSize: 12, color: "rgba(226,232,240,0.65)" }}>読み込み中…</div>
        </div>
      </div>

      <style>{`
        @keyframes pm_spin { to { transform: rotate(360deg); } }
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
        border: "2px solid rgba(226,232,240,0.22)",
        borderTopColor: "rgba(226,232,240,0.9)",
        animation: "pm_spin 0.8s linear infinite",
      }}
    />
  );
}

/**
 * “モザイクタイル状の日本地図っぽい雰囲気”を
 * 画像なしで作る簡易版（軽い）
 *
 * ほんとの日本地図シルエットにしたい場合は、次ステップでSVG差し込みが最強。
 */
function JapanMosaic() {
  // タイルの「島っぽい」配置（超ラフ）。雰囲気用。
  // ※本物の地図精度は狙わない。あくまでスタイリッシュな背景。
  const tiles: Array<[number, number, number]> = [
    // x, y, opacity(%)
    // 北海道っぽい
    [74, 20, 14],[78, 22, 12],[70, 24, 10],[76, 26, 12],[82, 26, 9],
    // 本州（上）
    [58, 34, 10],[62, 36, 12],[66, 38, 10],[70, 40, 12],[74, 42, 10],[78, 44, 9],
    [54, 40, 9],[58, 42, 11],[62, 44, 10],[66, 46, 11],[70, 48, 10],[74, 50, 10],
    // 本州（中）
    [50, 48, 9],[54, 50, 10],[58, 52, 12],[62, 54, 11],[66, 56, 12],[70, 58, 10],[74, 60, 9],
    [46, 54, 8],[50, 56, 9],[54, 58, 11],[58, 60, 10],[62, 62, 12],[66, 64, 11],
    // 近畿〜中国
    [42, 60, 8],[46, 62, 9],[50, 64, 10],[54, 66, 11],[58, 68, 10],[62, 70, 9],
    // 四国
    [50, 74, 9],[54, 76, 10],[58, 78, 9],
    // 九州
    [42, 74, 9],[46, 76, 10],[40, 78, 8],[44, 80, 9],[48, 82, 8],
    // 沖縄っぽい
    [24, 86, 6],[20, 88, 6],
  ];

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        placeItems: "center",
        pointerEvents: "none",
        opacity: 1,
      }}
    >
      <div
        style={{
          width: "min(780px, 110vw)",
          height: "min(520px, 80vh)",
          position: "relative",
          transform: "rotate(-8deg) translateY(8px)",
          filter: "blur(0.2px)",
        }}
      >
        {tiles.map(([x, y, o], i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: 18,
              height: 18,
              borderRadius: 6,
              background: "rgba(59,130,246,1)",
              opacity: o / 100,
              boxShadow: "0 0 0 1px rgba(148,163,184,0.12) inset, 0 18px 60px rgba(0,0,0,0.22)",
            }}
          />
        ))}

        {/* うっすいビネット */}
        <div
          style={{
            position: "absolute",
            inset: -40,
            background:
              "radial-gradient(closest-side at 50% 50%, rgba(255,255,255,0.06), transparent 60%)",
            opacity: 0.55,
          }}
        />
      </div>
    </div>
  );
}
