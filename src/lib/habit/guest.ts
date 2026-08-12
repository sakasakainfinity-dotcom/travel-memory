export const guestHabitDefaults = ["筋トレ", "読書10分", "水を2L飲む", "散歩", "英語学習", "早起き", "日記", "ストレッチ", "SNS投稿"];

export type GuestHabit = { id: string; position: number; title: string; description: string };
export type GuestLog = { habit_id: string; date: string; completed: boolean };
export type GuestReward = { id: string; description: string; required_points: number };
export type GuestRedemption = { points_used: number; redeemed_at: string };
export type GuestHabitData = { habits: GuestHabit[]; logs: GuestLog[]; rewards: GuestReward[]; redemptions: GuestRedemption[] };

const storageKey = "photomapper-habit-bingo-guest-v1";

export function defaultGuestHabitData(): GuestHabitData {
  return {
    habits: guestHabitDefaults.map((title, position) => ({ id: `guest-habit-${position}`, position, title, description: "" })),
    logs: [],
    rewards: [],
    redemptions: [],
  };
}

export function loadGuestHabitData(): GuestHabitData {
  if (typeof window === "undefined") return defaultGuestHabitData();
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null") as Partial<GuestHabitData> | null;
    const fallback = defaultGuestHabitData();
    return {
      habits: saved?.habits?.length === 9
        ? saved.habits.map((habit) => {
            const legacyHabit = habit as GuestHabit & { name?: string };
            return { ...habit, title: legacyHabit.title ?? legacyHabit.name ?? "", description: legacyHabit.description ?? "" };
          })
        : fallback.habits,
      logs: Array.isArray(saved?.logs) ? saved.logs : [],
      rewards: Array.isArray(saved?.rewards) ? saved.rewards : [],
      redemptions: Array.isArray(saved?.redemptions)
        ? saved.redemptions
        // Preserve a legacy guest deduction in the current month during migration.
        : typeof (saved as { spent?: unknown } | null)?.spent === "number"
          ? [{ points_used: (saved as { spent: number }).spent, redeemed_at: new Date().toISOString() }]
          : [],
    };
  } catch {
    return defaultGuestHabitData();
  }
}

export function saveGuestHabitData(data: GuestHabitData): void {
  localStorage.setItem(storageKey, JSON.stringify(data));
}
