export const guestHabitDefaults = ["筋トレ", "読書10分", "水を2L飲む", "散歩", "英語学習", "早起き", "日記", "ストレッチ", "SNS投稿"];

export type GuestHabit = { id: string; position: number; name: string };
export type GuestLog = { habit_id: string; date: string; completed: boolean };
export type GuestReward = { id: string; description: string; required_points: number };
export type GuestHabitData = { habits: GuestHabit[]; logs: GuestLog[]; rewards: GuestReward[]; spent: number };

const storageKey = "photomapper-habit-bingo-guest-v1";

export function defaultGuestHabitData(): GuestHabitData {
  return {
    habits: guestHabitDefaults.map((name, position) => ({ id: `guest-habit-${position}`, position, name })),
    logs: [],
    rewards: [],
    spent: 0,
  };
}

export function loadGuestHabitData(): GuestHabitData {
  if (typeof window === "undefined") return defaultGuestHabitData();
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null") as Partial<GuestHabitData> | null;
    const fallback = defaultGuestHabitData();
    return {
      habits: saved?.habits?.length === 9 ? saved.habits : fallback.habits,
      logs: Array.isArray(saved?.logs) ? saved.logs : [],
      rewards: Array.isArray(saved?.rewards) ? saved.rewards : [],
      spent: typeof saved?.spent === "number" ? saved.spent : 0,
    };
  } catch {
    return defaultGuestHabitData();
  }
}

export function saveGuestHabitData(data: GuestHabitData): void {
  localStorage.setItem(storageKey, JSON.stringify(data));
}
