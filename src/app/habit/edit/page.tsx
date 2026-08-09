"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppMenu from "@/components/AppMenu";
import { supabase } from "@/lib/supabaseClient";

type EditableHabit = { id: string; position: number; name: string; target_count: number };

export default function HabitEditPage() {
  const [boardId, setBoardId] = useState<string | null>(null);
  const [habits, setHabits] = useState<EditableHabit[]>([]);
  const [oneReward, setOneReward] = useState("");
  const [allReward, setAllReward] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setMessage("編集するにはログインが必要です。");
        setLoading(false);
        return;
      }
      const { data: board, error: boardError } = await supabase.from("habit_bingos").select("id").eq("user_id", user.id).eq("is_active", true).maybeSingle();
      if (boardError) {
        setMessage("習慣ビンゴを読み込めませんでした。");
        setLoading(false);
        return;
      }
      if (!board) {
        setMessage("先にHabitBingoを作成してください。");
        setLoading(false);
        return;
      }

      setBoardId(board.id);
      const [{ data: habitRows, error: habitsError }, { data: rewardRows, error: rewardsError }] = await Promise.all([
        supabase.from("habits").select("id,position,name,target_count").eq("habit_bingo_id", board.id).order("position"),
        supabase.from("rewards").select("reward_type,description").eq("habit_bingo_id", board.id),
      ]);
      if (habitsError || rewardsError) {
        setMessage("編集内容を読み込めませんでした。");
      } else {
        setHabits(habitRows ?? []);
        setOneReward(rewardRows?.find((reward) => reward.reward_type === "lines")?.description ?? "");
        setAllReward(rewardRows?.find((reward) => reward.reward_type === "all_clear")?.description ?? "");
      }
      setLoading(false);
    }
    void load();
  }, []);

  async function save() {
    if (!boardId || habits.length !== 9 || habits.some((habit) => !habit.name.trim() || habit.target_count < 1)) {
      setMessage("9個すべての習慣名と、1以上の目標回数を入力してください。");
      return;
    }
    if (!oneReward.trim() || !allReward.trim()) {
      setMessage("ごほうびを2つとも入力してください。");
      return;
    }

    setSaving(true);
    setMessage("");
    const results = await Promise.all([
      ...habits.map((habit) => supabase.from("habits").update({ name: habit.name.trim(), target_count: habit.target_count }).eq("id", habit.id).eq("habit_bingo_id", boardId)),
      supabase.from("rewards").update({ description: oneReward.trim() }).eq("habit_bingo_id", boardId).eq("reward_type", "lines"),
      supabase.from("rewards").update({ description: allReward.trim() }).eq("habit_bingo_id", boardId).eq("reward_type", "all_clear"),
    ]);
    setSaving(false);
    setMessage(results.some((result) => result.error) ? "保存できませんでした。もう一度お試しください。" : "習慣とごほうびを保存しました。");
  }

  return <main className="bingo-shell"><AppMenu current="habit-bingo"/><div className="bingo-wrap">
    <Link className="bingo-back-link" href="/habit">← HabitBingoに戻る</Link>
    <div className="bingo-brand">HABIT BINGO EDIT</div>
    <h1 className="bingo-title">習慣とごほうびを<br/>修正する。</h1>
    {loading ? <div className="bingo-card">読み込み中…</div> : boardId ? <div className="bingo-card">
      <h2>9個の習慣</h2><p className="bingo-note">習慣名とCLEARに必要な回数を自由に変更できます。</p>
      {habits.map((habit, index) => <div className="habit-edit-row" key={habit.id}>
        <label><span>{index + 1}. 習慣</span><input className="bingo-field" value={habit.name} onChange={(event) => setHabits((current) => current.map((item) => item.id === habit.id ? { ...item, name: event.target.value } : item))}/></label>
        <label><span>目標回数</span><input className="bingo-field" type="number" min="1" value={habit.target_count} onChange={(event) => setHabits((current) => current.map((item) => item.id === habit.id ? { ...item, target_count: Number(event.target.value) } : item))}/></label>
      </div>)}
      <h2>ごほうび</h2>
      <label className="habit-edit-label"><span>1 BINGO</span><input className="bingo-field" value={oneReward} onChange={(event) => setOneReward(event.target.value)}/></label>
      <label className="habit-edit-label"><span>ALL CLEAR</span><input className="bingo-field" value={allReward} onChange={(event) => setAllReward(event.target.value)}/></label>
      <div className="habit-edit-actions"><button className="bingo-action" disabled={saving} onClick={() => void save()}>{saving ? "保存中…" : "変更を保存"}</button><Link className="bingo-action bingo-secondary" href="/habit">キャンセル</Link></div>
    </div> : <div className="bingo-card"><p>{message}</p><Link className="bingo-action" href="/habit">HabitBingoへ</Link></div>}
    {boardId && message && <p className={message.includes("保存しました") ? "bingo-success" : "bingo-error"} role="status">{message}</p>}
  </div></main>;
}
