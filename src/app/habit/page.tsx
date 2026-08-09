"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppMenu from "@/components/AppMenu";
import { addDays, formatJapaneseDate, tokyoDate } from "@/lib/habit/date";
import { supabase } from "@/lib/supabaseClient";

type Habit = { id: string; position: number; name: string };
type Log = { habit_id: string; date: string; completed: boolean };
type Reward = { id: string; description: string; required_points: number };
const defaults = ["筋トレ", "読書10分", "水を2L飲む", "散歩", "英語学習", "早起き", "日記", "ストレッチ", "SNS投稿"];

export default function HabitPage() {
  const today = useMemo(() => tokyoDate(), []);
  const yesterday = useMemo(() => addDays(today, -1), [today]);
  const [userId, setUserId] = useState("");
  const [boardId, setBoardId] = useState<string | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [spent, setSpent] = useState(0);
  const [names, setNames] = useState(defaults);
  const [selectedDate, setSelectedDate] = useState(yesterday);
  const [rewardName, setRewardName] = useState("");
  const [rewardPoints, setRewardPoints] = useState(3);
  const [editingReward, setEditingReward] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); setMessage("HabitBingoを使うにはログインしてください。"); return; }
    setUserId(user.id);
    const { data: board, error: boardError } = await supabase.from("habit_bingos").select("id").eq("user_id", user.id).eq("is_active", true).maybeSingle();
    if (boardError) { setMessage("HabitBingoを読み込めませんでした。"); setLoading(false); return; }
    if (!board) { setBoardId(null); setLoading(false); return; }
    setBoardId(board.id);
    const { data: habitRows, error: habitError } = await supabase.from("habits").select("id,position,name").eq("habit_bingo_id", board.id).order("position");
    if (habitError) { setMessage("習慣を読み込めませんでした。"); setLoading(false); return; }
    const ids = (habitRows ?? []).map((habit) => habit.id);
    const [logResult, rewardResult, redemptionResult] = await Promise.all([
      ids.length ? supabase.from("habit_logs").select("habit_id,date,completed").in("habit_id", ids).eq("user_id", user.id).eq("completed", true) : Promise.resolve({ data: [], error: null }),
      supabase.from("reward_definitions").select("id,description,required_points").eq("habit_bingo_id", board.id).order("required_points"),
      supabase.from("reward_redemptions").select("points_used").eq("habit_bingo_id", board.id).eq("user_id", user.id),
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

  async function createBoard() {
    if (!userId) { location.href = "/"; return; }
    if (names.some((name) => !name.trim())) { setMessage("9個すべての習慣名を入力してください。"); return; }
    setBusy(true);
    const { data: board, error } = await supabase.from("habit_bingos").insert({ user_id: userId, title: "わたしのHabitBingo", is_active: true }).select("id").single();
    if (!error && board) {
      const result = await supabase.from("habits").insert(names.map((name, position) => ({ habit_bingo_id: board.id, position, name: name.trim(), target_count: 1 })));
      setMessage(result.error ? "習慣を登録できませんでした。" : "HabitBingoを作成しました！");
    } else setMessage("HabitBingoを作成できませんでした。");
    setBusy(false); await load();
  }

  async function toggle(habit: Habit) {
    if (busy || !userId) return;
    setBusy(true); setMessage("");
    const done = todayDone.has(habit.id);
    const result = done
      ? await supabase.from("habit_logs").delete().eq("habit_id", habit.id).eq("user_id", userId).eq("date", today)
      : await supabase.from("habit_logs").upsert({ habit_id: habit.id, user_id: userId, date: today, completed: true }, { onConflict: "habit_id,date" });
    if (result.error) setMessage("記録を保存できませんでした。");
    await load(); setBusy(false);
  }

  async function saveReward() {
    if (!boardId || !rewardName.trim() || rewardPoints < 1) { setMessage("ごほうび名と1以上のポイントを入力してください。"); return; }
    setBusy(true);
    const payload = { habit_bingo_id: boardId, description: rewardName.trim(), required_points: rewardPoints };
    const result = editingReward
      ? await supabase.from("reward_definitions").update(payload).eq("id", editingReward)
      : await supabase.from("reward_definitions").insert(payload);
    setMessage(result.error ? "ごほうびを保存できませんでした。" : "ごほうびを保存しました。");
    if (!result.error) { setRewardName(""); setRewardPoints(3); setEditingReward(null); }
    await load(); setBusy(false);
  }

  async function redeem(reward: Reward) {
    if (!confirm(`「${reward.description}」に ${reward.required_points}pt を使いますか？`)) return;
    setBusy(true);
    const { error } = await supabase.rpc("redeem_habit_reward", { p_reward_id: reward.id });
    setMessage(error ? "ポイントが不足しているか、交換できませんでした。" : `「${reward.description}」を交換しました！`);
    await load(); setBusy(false);
  }

  async function removeReward(id: string) {
    if (!confirm("このごほうびを削除しますか？")) return;
    const { error } = await supabase.from("reward_definitions").delete().eq("id", id);
    setMessage(error ? "交換履歴のあるごほうびは削除できません。" : "ごほうびを削除しました。"); await load();
  }

  if (loading) return <main className="bingo-shell"><div className="habit-wrap"><div className="bingo-card">読み込み中…</div></div></main>;
  return <main className="bingo-shell"><AppMenu current="habit-bingo"/><div className="habit-wrap">
    <div className="bingo-brand">HABIT BINGO</div>
    {!boardId ? <section className="bingo-card habit-setup"><h1>9つの習慣を決めよう</h1><p className="bingo-note">毎日続けたいことを9マスに登録します。</p>{names.map((name, index) => <label key={index}><span>{index + 1}</span><input className="bingo-field" value={name} maxLength={40} onChange={(event) => setNames((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value))}/></label>)}<button className="bingo-action" disabled={busy || !userId} onClick={() => void createBoard()}>HabitBingoをはじめる</button></section> : <>
      <header className="habit-header"><div><span>今日のHabitBingo</span><h1>{formatJapaneseDate(today, true)}</h1></div><Link href="/habit/edit">習慣を編集</Link></header>
      <section className={`habit-today ${todayDone.size === 9 ? "is-all-clear" : ""}`}>
        {todayDone.size === 9 && <div className="habit-clear-banner">🎉 ALL CLEAR! <small>⭐ ごほうびポイント +1</small></div>}
        <div className="habit-grid">{habits.map((habit) => { const done = todayDone.has(habit.id); return <button className={done ? "is-done" : ""} aria-pressed={done} disabled={busy} key={habit.id} onClick={() => void toggle(habit)}><span className="habit-check">{done ? "✓" : habit.position + 1}</span><b>{habit.name}</b></button>; })}</div>
        <div className="habit-count"><b>今日 {todayDone.size} / 9 達成</b><span>{Math.round(todayDone.size / 9 * 100)}%</span></div><div className="habit-progress"><i style={{ width: `${todayDone.size / 9 * 100}%` }}/></div>
      </section>
      <section className="bingo-card habit-history"><div className="habit-section-title"><div><span>過去の記録</span><h2>{selectedDate === yesterday ? "昨日の記録" : formatJapaneseDate(selectedDate)}</h2></div><label className="habit-date">📅<input aria-label="過去の日付を選択" type="date" value={selectedDate} max={yesterday} onChange={(event) => setSelectedDate(event.target.value || yesterday)}/></label></div><p><b>{formatJapaneseDate(selectedDate)}</b>　{historyDone.size} / 9 達成　<span className="habit-rate">達成率 {Math.round(historyDone.size / 9 * 100)}%</span></p><div className="habit-grid habit-grid-small">{habits.map((habit) => <div className={historyDone.has(habit.id) ? "is-done" : ""} key={habit.id}><span>{historyDone.has(habit.id) ? "✓" : "○"}</span><b>{habit.name}</b></div>)}</div></section>
      <section className="bingo-card habit-rewards"><span className="habit-kicker">ごほうび</span><div className="habit-points"><div>現在のごほうびポイント<strong>⭐ {balance} pt</strong></div><small>ALL CLEAR {earned}pt − 使用 {spent}pt</small></div><h2>ごほうび一覧</h2>{rewards.length === 0 && <p className="bingo-note">楽しみなごほうびを登録しましょう。</p>}<div className="reward-list">{rewards.map((reward) => <article key={reward.id}><div><strong>⭐ {reward.required_points}pt</strong><b>{reward.description}</b></div><button disabled={busy || balance < reward.required_points} onClick={() => void redeem(reward)}>ごほうびを使う</button><div className="reward-tools"><button onClick={() => { setEditingReward(reward.id); setRewardName(reward.description); setRewardPoints(reward.required_points); }}>編集</button><button onClick={() => void removeReward(reward.id)}>削除</button></div></article>)}</div><div className="reward-form"><h3>{editingReward ? "ごほうびを編集" : "ごほうびを追加"}</h3><input className="bingo-field" placeholder="ごほうび名" value={rewardName} onChange={(event) => setRewardName(event.target.value)}/><label><input className="bingo-field" type="number" min="1" value={rewardPoints} onChange={(event) => setRewardPoints(Number(event.target.value))}/><span>pt</span></label><button className="bingo-action" disabled={busy} onClick={() => void saveReward()}>{editingReward ? "変更を保存" : "追加する"}</button>{editingReward && <button className="reward-cancel" onClick={() => { setEditingReward(null); setRewardName(""); }}>キャンセル</button>}</div></section>
    </>}
    {message && <p className="habit-message" role="status">{message}</p>}
  </div></main>;
}
