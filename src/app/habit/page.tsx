"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppMenu from "@/components/AppMenu";
import { addDays, formatJapaneseDate, tokyoDate } from "@/lib/habit/date";
import { guestHabitDefaults, loadGuestHabitData, saveGuestHabitData } from "@/lib/habit/guest";
import { supabase } from "@/lib/supabaseClient";
import styles from "./habit.module.css";

type Habit = { id: string; position: number; title: string; description: string | null };
type Log = { habit_id: string; date: string; completed: boolean };
type Reward = { id: string; description: string; required_points: number };
type Period = 7 | 14 | 30;
const defaults = guestHabitDefaults;
const pointsFor = (count: number) => count === 9 ? 2 : count >= 6 ? 1 : 0;
const shortDate = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

export default function HabitPage() {
  const today = useMemo(() => tokyoDate(), []);
  const [userId, setUserId] = useState("");
  const [boardId, setBoardId] = useState<string | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [spent, setSpent] = useState(0);
  const [period, setPeriod] = useState<Period>(7);
  const [periodEnd, setPeriodEnd] = useState(today);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const guest = loadGuestHabitData();
      setUserId("guest"); setBoardId("guest"); setHabits(guest.habits); setLogs(guest.logs); setRewards(guest.rewards); setSpent(guest.spent); setLoading(false); return;
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
    const { error: seedError } = await supabase.from("habits").upsert(defaults.map((title, position) => ({ habit_bingo_id: activeBoard.id, position, name: title, title, description: "", target_count: 1 })), { onConflict: "habit_bingo_id,position", ignoreDuplicates: true });
    if (seedError) { setMessage("9マスを準備できませんでした。"); setLoading(false); return; }
    const { data: habitRows, error: habitError } = await supabase.from("habits").select("id,position,title,description").eq("habit_bingo_id", activeBoard.id).order("position");
    if (habitError) { setMessage("習慣を読み込めませんでした。"); setLoading(false); return; }
    const ids = (habitRows ?? []).map((habit) => habit.id);
    const [logResult, rewardResult, redemptionResult] = await Promise.all([
      ids.length ? supabase.from("habit_logs").select("habit_id,date,completed").in("habit_id", ids).eq("user_id", user.id).eq("completed", true) : Promise.resolve({ data: [], error: null }),
      supabase.from("reward_definitions").select("id,description,required_points").eq("habit_bingo_id", activeBoard.id).order("required_points"),
      supabase.from("reward_redemptions").select("points_used").eq("habit_bingo_id", activeBoard.id).eq("user_id", user.id),
    ]);
    if (logResult.error || rewardResult.error || redemptionResult.error) setMessage("一部の記録を読み込めませんでした。DB更新を確認してください。");
    setHabits(habitRows ?? []); setLogs(logResult.data ?? []); setRewards(rewardResult.data ?? []);
    setSpent((redemptionResult.data ?? []).reduce((sum, row) => sum + row.points_used, 0)); setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  const completedIds = useCallback((date: string) => new Set(logs.filter((log) => log.date === date && log.completed).map((log) => log.habit_id)), [logs]);
  const todayDone = completedIds(today);
  const earned = useMemo(() => {
    const counts = new Map<string, Set<string>>();
    logs.forEach((log) => { if (!counts.has(log.date)) counts.set(log.date, new Set()); counts.get(log.date)!.add(log.habit_id); });
    return [...counts.values()].reduce((sum, ids) => sum + pointsFor(ids.size), 0);
  }, [logs]);
  const balance = earned - spent;
  const dates = useMemo(() => Array.from({ length: period }, (_, index) => addDays(periodEnd, index - period + 1)), [period, periodEnd]);
  const nextReward = rewards.find((reward) => reward.required_points > balance) ?? rewards[0];
  const todayPoints = pointsFor(todayDone.size);
  const helper = todayDone.size === 9 ? "ALL CLEAR！ +2pt 獲得" : todayDone.size >= 6 ? `あと${9 - todayDone.size}つで ALL CLEAR！` : `あと${6 - todayDone.size}つで +1pt`;

  async function toggle(habit: Habit) {
    if (busy || !userId) return;
    setBusy(true); setMessage(""); const done = todayDone.has(habit.id);
    if (userId === "guest") {
      if (done && earned - pointsFor(todayDone.size) + pointsFor(todayDone.size - 1) - spent < 0) { setMessage("交換済みポイントがあるため、この記録を取り消せません。"); setBusy(false); return; }
      const guest = loadGuestHabitData();
      guest.logs = done ? guest.logs.filter((log) => !(log.habit_id === habit.id && log.date === today)) : [...guest.logs, { habit_id: habit.id, date: today, completed: true }];
      saveGuestHabitData(guest); setLogs(guest.logs); setBusy(false); return;
    }
    const result = done ? await supabase.from("habit_logs").delete().eq("habit_id", habit.id).eq("user_id", userId).eq("date", today) : await supabase.from("habit_logs").upsert({ habit_id: habit.id, user_id: userId, date: today, completed: true }, { onConflict: "habit_id,date" });
    if (result.error) setMessage("記録を保存できませんでした。"); await load(); setBusy(false);
  }

  async function redeem(reward: Reward) {
    if (!confirm(`「${reward.description}」に ${reward.required_points}pt を使いますか？`)) return;
    setBusy(true);
    if (userId === "guest") {
      const guest = loadGuestHabitData();
      if (balance < reward.required_points) setMessage("ポイントが不足しています。");
      else { guest.spent += reward.required_points; saveGuestHabitData(guest); setSpent(guest.spent); setMessage(`「${reward.description}」を交換しました！`); }
      setBusy(false); return;
    }
    const { error } = await supabase.rpc("redeem_habit_reward", { p_reward_id: reward.id });
    setMessage(error ? "ポイントが不足しているか、交換できませんでした。" : `「${reward.description}」を交換しました！`); await load(); setBusy(false);
  }

  if (loading) return <main className={styles.shell}><AppMenu current="habit-bingo"/><div className={styles.page}><p className={styles.eyebrow}>HABIT BINGO</p><div className={styles.loading}>今日の9マスを準備しています…</div></div></main>;
  return <main className={styles.shell}><AppMenu current="habit-bingo"/><div className={styles.page}>
    <header className={styles.header}><div><p className={styles.eyebrow}>HABIT BINGO</p><h1>{formatJapaneseDate(today, true)}</h1><div className={styles.chips}><span>✓ 今日 {todayDone.size}/9 達成</span><span>★ 保有 {balance}pt</span></div></div><Link href="/habit/edit"><span aria-hidden>✎</span> 習慣を編集</Link></header>
    {userId === "guest" && <p className={styles.guest}>ログインなしでお試し中です。記録はこの端末に保存されます。</p>}

    <section className={`${styles.card} ${styles.today} ${todayDone.size === 9 ? styles.allClear : ""}`}><h2><span>❧</span> 今日のビンゴ <span>✦</span></h2>
      <div className={styles.grid}>{habits.map((habit) => { const done = todayDone.has(habit.id); return <button className={done ? styles.done : ""} aria-label={habit.description ? `${habit.title}：${habit.description}` : habit.title} title={habit.description || undefined} aria-pressed={done} disabled={busy} key={habit.id} onClick={() => void toggle(habit)}><span className={styles.check}>{done ? "✓" : "○"}</span><b>{habit.title}</b>{done && habit.position % 4 === 0 && <i aria-hidden>✦</i>}</button>; })}</div>
      <div className={styles.helper}><span>❧</span> {helper}</div>
      <div className={styles.pointProgress}><div className={styles.current} style={{ left: `${Math.max(2, todayDone.size / 9 * 100)}%` }}>現在 +{todayPoints}pt</div><div className={styles.track}><i style={{ width: `${todayDone.size / 9 * 100}%` }}/><span className={styles.markSix}>★</span><span className={styles.markNine}>★</span></div><div className={styles.milestones}><span/><b>6個達成で<br/><strong>+1pt</strong></b><b>9個達成で<br/><strong>+2pt</strong></b></div></div>
    </section>

    <section className={`${styles.card} ${styles.rewards}`}><h2><span>✦</span> ごほうび <span>✦</span></h2>
      <div className={styles.rewardHero}><div><small>保有ポイント</small><strong>★ <em>{balance}</em>pt</strong></div>{nextReward ? <div className={styles.next}><small>次のごほうび</small><b>{nextReward.description}</b><div><i style={{ width: `${Math.min(100, balance / nextReward.required_points * 100)}%` }}/></div><span>{balance >= nextReward.required_points ? "交換できます" : `あと ${nextReward.required_points - balance}pt`}</span></div> : <div className={styles.next}><small>次のごほうび</small><b>ごほうびを登録しよう</b><Link href="/habit/edit#rewards">設定する →</Link></div>}</div>
      <div className={styles.rewardList}>{rewards.map((reward) => { const shortage = reward.required_points - balance; return <article key={reward.id}><strong>★ {reward.required_points}pt</strong><b>{reward.description}</b><button disabled={busy || shortage > 0} onClick={() => void redeem(reward)}>{shortage > 0 ? `あと${shortage}pt` : "つかう"}</button></article>; })}</div>
      <Link className={styles.editRewards} href="/habit/edit#rewards">ごほうびを編集</Link>
    </section>

    <section className={`${styles.card} ${styles.results}`}><h2><span>✦</span> 実績 <span>✦</span></h2>
      <div className={styles.periodControls}><label>表示期間：<select value={period} onChange={(event) => { setPeriod(Number(event.target.value) as Period); setPeriodEnd(today); }}><option value={7}>直近1週間</option><option value={14}>直近2週間</option><option value={30}>直近1か月</option></select></label><div><button aria-label="前の期間" onClick={() => setPeriodEnd(addDays(periodEnd, -period))}>‹</button><b>{shortDate(dates[0])} – {shortDate(periodEnd)}</b><button aria-label="次の期間" disabled={periodEnd === today} onClick={() => setPeriodEnd(addDays(periodEnd, period) > today ? today : addDays(periodEnd, period))}>›</button></div></div>
      <div className={`${styles.tableWrap} ${period === 7 ? styles.oneWeek : ""}`}><table><thead><tr><th>習慣</th>{dates.map((date) => <th key={date}>{new Intl.DateTimeFormat("ja-JP", { weekday: "short" }).format(new Date(`${date}T12:00:00+09:00`))}<small>{shortDate(date)}</small></th>)}</tr></thead><tbody>{habits.map((habit) => <tr key={habit.id}><th>{habit.title}</th>{dates.map((date) => <td className={completedIds(date).has(habit.id) ? styles.yes : styles.no} key={date}>{completedIds(date).has(habit.id) ? "○" : "×"}</td>)}</tr>)}<tr className={styles.total}><th>達成数</th>{dates.map((date) => <td key={date}>{completedIds(date).size}/9</td>)}</tr><tr className={styles.total}><th>獲得pt</th>{dates.map((date) => <td key={date}>+{pointsFor(completedIds(date).size)}pt</td>)}</tr></tbody></table></div>
      <p className={styles.rule}>6個達成で +1pt ／ 9個達成で +2pt</p>
    </section>
    {message && <p className={styles.message} role="status">{message}</p>}
  </div></main>;
}
