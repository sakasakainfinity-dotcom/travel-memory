export type RankKey = "visitor" | "supporter" | "expert" | "master" | "legend" | "grand_master";

export type RankMeta = {
  key: RankKey;
  minPoints: number;
  label: string;
  icon: string;
  color: string;
};

export const RANKS: RankMeta[] = [
  { key: "visitor", minPoints: 0, label: "ビジター", icon: "🔰", color: "#6b7280" },
  { key: "supporter", minPoints: 50, label: "サポーター", icon: "⭐", color: "#2563eb" },
  { key: "expert", minPoints: 100, label: "エキスパート", icon: "🧭", color: "#16a34a" },
  { key: "master", minPoints: 300, label: "トラベルマスター", icon: "👑", color: "#7c3aed" },
  { key: "legend", minPoints: 500, label: "レジェンド", icon: "✨", color: "#ca8a04" },
  { key: "grand_master", minPoints: 1000, label: "グランド・マスター", icon: "🏆", color: "#db2777" },
];

export function resolveRank(points: number): RankMeta {
  const safe = Number.isFinite(points) ? points : 0;
  return [...RANKS].reverse().find((rank) => safe >= rank.minPoints) ?? RANKS[0];
}

export function pointsToNextRank(points: number): number {
  const safe = Number.isFinite(points) ? points : 0;
  const next = RANKS.find((rank) => rank.minPoints > safe);
  if (!next) return 0;
  return Math.max(0, next.minPoints - safe);
}
