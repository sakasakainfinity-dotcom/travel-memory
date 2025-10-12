// src/app/_offline/page.tsx
export default function OfflinePage() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>オフラインです</h1>
      <p style={{ color: "#555", marginBottom: 16 }}>
        ネットに繋がったら自動で再読込するけぇ、ちょっと待ってね。
      </p>

      <button
        onClick={() => location.reload()}
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid #ddd",
          cursor: "pointer",
        }}
      >
        再読み込み
      </button>

      <p style={{ marginTop: 24, fontSize: 12, color: "#888" }}>
        ヒント：よく使うページは一度開いておくと、次からオフラインでも見られるで。
      </p>
    </main>
  );
}
