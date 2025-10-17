import BackToMapButton from "@/components/BackToMapButton";

export default function PlansPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "16px 12px 80px" }}>
      <h1 style={{ fontWeight: 900, fontSize: 20, marginBottom: 12 }}>有料プラン</h1>
      <p style={{ color: "#4b5563" }}>
        現在は <strong>全て無料</strong> でお使いいただけます。課金機能は後日リリース予定です。
      </p>
      <BackToMapButton />
    </main>
  );
}
