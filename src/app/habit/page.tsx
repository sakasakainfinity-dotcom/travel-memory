"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppMenu from "@/components/AppMenu";
import { addDays, formatJapaneseDate, tokyoDate } from "@/lib/habit/date";
import { guestHabitDefaults, loadGuestHabitData, saveGuestHabitData } from "@/lib/habit/guest";
import { supabase } from "@/lib/supabaseClient";

type Habit = { id: string; position: number; name: string };
type Log = { habit_id: string; date: string; completed: boolean };
type Reward = { id: string; description: string; required_points: number };
const defaults = guestHabitDefaults;

export default function HabitPage() {
  const today = useMemo(() => tokyoDate(), []);
  const yesterday = useMemo(() => addDays(today, -1), [today]);
  const [userId, setUserId] = useState("");
  const [boardId, setBoardId] = useState<string | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [spent, setSpent] = useState(0);
  const [selectedDate, setSelectedDate] = useState(yesterday);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const guest = loadGuestHabitData();
      setUserId("guest"); setBoardId("guest"); setHabits(guest.habits); setLogs(guest.logs); setRewards(guest.rewards); setSpent(guest.spent);
      setLoading(false); return;
    }
    setUserId(user.id);
    const { data: board, error: boardError } = await supabase.from("habit_bingos").select("id").eq("user_id", user.id).eq("is_active", true).maybeSingle();
    if (boardError) { setMessage("HabitBingoを読み込めませんでした。"); setLoading(false); return; }
    let activeBoard = board;
    if (!activeBoard) {
      const { data: createdBoard, error: createError } = await supabase.from("habit_bingos").insert({ user_id: user.id, title: "わたしのHabitBingo", is_active: true }).select("id").single();
      if (createError || !createdBoard) {
        const { data: concurrentBoard } = await supabase.from("habit_bingos").select("id").eq("user_id", user.id).eq("is_active", true).maybeSingle();
        if (!concurrentBoard) { setMessage("HabitBingoを準備できませんでした。"); setLoading(false); return; }
        activeBoard = concurrentBoard;
      } else activeBoard = createdBoard;
    }
    setBoardId(activeBoard.id);
    const { error: seedError } = await supabase.from("habits").upsert(defaults.map((name, position) => ({ habit_bingo_id: activeBoard.id, position, name, target_count: 1 })), { onConflict: "habit_bingo_id,position", ignoreDuplicates: true });
    if (seedError) { setMessage("9マスを準備できませんでした。"); setLoading(false); return; }
    const { data: habitRows, error: habitError } = await supabase.from("habits").select("id,position,name").eq("habit_bingo_id", activeBoard.id).order("position");
    if (habitError) { setMessage("習慣を読み込めませんでした。"); setLoading(false); return; }
    const ids = (habitRows ?? []).map((habit) => habit.id);
    const [logResult, rewardResult, redemptionResult] = await Promise.all([
      ids.length ? supabase.from("habit_logs").select("habit_id,date,completed").in("habit_id", ids).eq("user_id", user.id).eq("completed", true) : Promise.resolve({ data: [], error: null }),
      supabase.from("reward_definitions").select("id,description,required_points").eq("habit_bingo_id", activeBoard.id).order("required_points"),
      supabase.from("reward_redemptions").select("points_used").eq("habit_bingo_id", activeBoard.id).eq("user_id", user.id),
    ]);
    if (logResult.error || rewardResult.error || redemptionResult.error) setMessage("一部の記録を読み込めませんでした。DB更新を確認してください。");
    setHabits(habitRows ?? []); setLogs(logResult.data ?? []); setRewards(rewardResult.data ?? []);
    setSpent((redemptionResult.data ?? []).reduce((sum, row) => sum + row.points_used, 0));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  const completedIds = useCallback((date: string) => new Set(logs.filter((log) => log.date === date && log.completed).map((log) => log.habit_id)), [logs]);
  const todayDone = completedIds(today);
  const historyDone = completedIds(selectedDate);
  const earned = useMemo(() => {
    const counts = new Map<string, Set<string>>();
    logs.forEach((log) => { if (!counts.has(log.date)) counts.set(log.date, new Set()); counts.get(log.date)!.add(log.habit_id); });
    return [...counts.values()].filter((ids) => habits.length === 9 && ids.size === 9).length;
  }, [habits.length, logs]);
  const balance = earned - spent;

  async function toggle(habit: Habit) {
    if (busy || !userId) return;
    setBusy(true); setMessage("");
    const done = todayDone.has(habit.id);
    if (userId === "guest") {
      if (done && todayDone.size === 9 && balance <= 0) { setMessage("交換済みポイントがあるため、ALL CLEARを取り消せません。"); setBusy(false); return; }
      const guest = loadGuestHabitData();
      guest.logs = done
        ? guest.logs.filter((log) => !(log.habit_id === habit.id && log.date === today))
        : [...guest.logs, { habit_id: habit.id, date: today, completed: true }];
      saveGuestHabitData(guest); setLogs(guest.logs); setBusy(false); return;
    }
    const result = done
      ? await supabase.from("habit_logs").delete().eq("habit_id", habit.id).eq("user_id", userId).eq("date", today)
      : await supabase.from("habit_logs").upsert({ habit_id: habit.id, user_id: userId, date: today, completed: true }, { onConflict: "habit_id,date" });
    if (result.error) setMessage("記録を保存できませんでした。");
    await load(); setBusy(false);
  }

  async function redeem(reward: Reward) {
    if (!confirm(`「${reward.description}」に ${reward.required_points}pt を使いますか？`)) return;
    setBusy(true);
    if (userId === "guest") {
      const guest = loadGuestHabitData();
      const guestDays = new Map<string, Set<string>>();
      guest.logs.filter((log) => log.completed).forEach((log) => { if (!guestDays.has(log.date)) guestDays.set(log.date, new Set()); guestDays.get(log.date)!.add(log.habit_id); });
      const guestEarned = [...guestDays.values()].filter((ids) => ids.size === 9).length;
      if (guestEarned - guest.spent < reward.required_points) setMessage("ポイントが不足しています。");
      else { guest.spent += reward.required_points; saveGuestHabitData(guest); setSpent(guest.spent); setMessage(`「${reward.description}」を交換しました！`); }
      setBusy(false); return;
    }
    const { error } = await supabase.rpc("redeem_habit_reward", { p_reward_id: reward.id });
    setMessage(error ? "ポイントが不足しているか、交換できませんでした。" : `「${reward.description}」を交換しました！`);
    await load(); setBusy(false);
  }

  if (loading) return <main className="bingo-shell"><AppMenu current="habit-bingo"/><div className="habit-wrap"><div className="bingo-brand">HABIT BINGO</div><header className="habit-header"><div><span>今日のHabitBingo</span><h1>{formatJapaneseDate(today, true)}</h1></div></header><section className="habit-today" aria-busy="true" aria-label="HabitBingoを読み込み中"><div className="habit-grid habit-grid-loading">{defaults.map((name, position) => <div key={name}><span className="habit-check">{position + 1}</span><b>{name}</b></div>)}</div><p className="bingo-note">BINGOを準備しています…</p></section></div></main>;
  return <main className="bingo-shell"><AppMenu current="habit-bingo"/><div className="habit-wrap">
    <div className="bingo-brand">HABIT BINGO</div>
    {boardId && <>
      <header className="habit-header"><div><span>今日のHabitBingo</span><h1>{formatJapaneseDate(today, true)}</h1></div><Link href="/habit/edit">習慣を編集</Link></header>
      {userId === "guest" && <p className="habit-guest-note">ログインなしでお試し中です。記録はこの端末に保存されます。</p>}
      <section className={`habit-today ${todayDone.size === 9 ? "is-all-clear" : ""}`}>
        {todayDone.size === 9 && <div className="habit-clear-banner">🎉 ALL CLEAR! <small>⭐ ごほうびポイント +1</small></div>}
        <div className="habit-grid">{habits.map((habit) => { const done = todayDone.has(habit.id); return <button className={done ? "is-done" : ""} aria-pressed={done} disabled={busy} key={habit.id} onClick={() => void toggle(habit)}><span className="habit-check">{done ? "✓" : habit.position + 1}</span><b>{habit.name}</b></button>; })}</div>
        <div className="habit-count"><b>今日 {todayDone.size} / 9 達成</b><span>{Math.round(todayDone.size / 9 * 100)}%</span></div><div className="habit-progress"><i style={{ width: `${todayDone.size / 9 * 100}%` }}/></div>
      </section>
      <section className="bingo-card habit-history"><div className="habit-section-title"><div><span>過去の記録</span><h2>{selectedDate === yesterday ? "昨日の記録" : formatJapaneseDate(selectedDate)}</h2></div><label className="habit-date">📅<input aria-label="過去の日付を選択" type="date" value={selectedDate} max={yesterday} onChange={(event) => setSelectedDate(event.target.value || yesterday)}/></label></div><p><b>{formatJapaneseDate(selectedDate)}</b>　{historyDone.size} / 9 達成　<span className="habit-rate">達成率 {Math.round(historyDone.size / 9 * 100)}%</span></p><div className="habit-grid habit-grid-small">{habits.map((habit) => <div className={historyDone.has(habit.id) ? "is-done" : ""} key={habit.id}><span>{historyDone.has(habit.id) ? "✓" : "○"}</span><b>{habit.name}</b></div>)}</div></section>
      <section className="bingo-card habit-rewards"><div className="habit-section-title"><span className="habit-kicker">ごほうび</span><Link href="/habit/edit#rewards">ごほうびを編集</Link></div><div className="habit-points"><div>現在のごほうびポイント<strong>⭐ {balance} pt</strong></div><small>ALL CLEAR {earned}pt − 使用 {spent}pt</small></div><h2>ごほうび一覧</h2>{rewards.length === 0 && <p className="bingo-note">編集画面からごほうびを登録できます。</p>}<div className="reward-list">{rewards.map((reward) => <article key={reward.id}><div><strong>⭐ {reward.required_points}pt</strong><b>{reward.description}</b></div><button disabled={busy || balance < reward.required_points} onClick={() => void redeem(reward)}>ごほうびを使う</button></article>)}</div></section>
    </>}
    {message && <p className="habit-message" role="status">{message}</p>}
  </div></main>;
}
