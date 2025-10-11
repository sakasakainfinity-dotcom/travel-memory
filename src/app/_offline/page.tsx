export default function OfflinePage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>オフラインです</h1>
      <p>ネットに繋がったら自動で再読込するけぇ、ちょい待ってね。</p>
      <button onClick={() => location.reload()}>再読み込み</button>
    </main>
  );
}
