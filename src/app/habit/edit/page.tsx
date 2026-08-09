"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppMenu from "@/components/AppMenu";
import { supabase } from "@/lib/supabaseClient";

type EditableHabit = { id: string; position: number; name: string };
type EditableReward = { id: string; description: string; required_points: number };

export default function HabitEditPage() {
  const [boardId, setBoardId] = useState<string | null>(null);
  const [habits, setHabits] = useState<EditableHabit[]>([]);
  const [rewards, setRewards] = useState<EditableReward[]>([]);
  const [rewardName, setRewardName] = useState("");
  const [rewardPoints, setRewardPoints] = useState(3);
  const [editingReward, setEditingReward] = useState<string | null>(null);
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
        supabase.from("habits").select("id,position,name").eq("habit_bingo_id", board.id).order("position"),
        supabase.from("reward_definitions").select("id,description,required_points").eq("habit_bingo_id", board.id).order("required_points"),
      ]);
      if (habitsError || rewardsError) {
        setMessage("編集内容を読み込めませんでした。");
      } else {
        setHabits(habitRows ?? []);
        setRewards(rewardRows ?? []);
      }
      setLoading(false);
    }
    void load();
  }, []);

  async function save() {
    if (!boardId || habits.length !== 9 || habits.some((habit) => !habit.name.trim())) {
      setMessage("9個すべての習慣名を入力してください。");
      return;
    }

    setSaving(true);
    setMessage("");
    const results = await Promise.all([
      ...habits.map((habit) => supabase.from("habits").update({ name: habit.name.trim() }).eq("id", habit.id).eq("habit_bingo_id", boardId)),
    ]);
    setSaving(false);
    setMessage(results.some((result) => result.error) ? "保存できませんでした。もう一度お試しください。" : "習慣を保存しました。");
  }

  async function reloadRewards(id: string) {
    const { data, error } = await supabase.from("reward_definitions").select("id,description,required_points").eq("habit_bingo_id", id).order("required_points");
    if (!error) setRewards(data ?? []);
    return error;
  }

  async function saveReward() {
    if (!boardId || !rewardName.trim() || rewardPoints < 1) {
      setMessage("ごほうび名と1以上の必要ポイントを入力してください。");
      return;
    }
    setSaving(true);
    const payload = { habit_bingo_id: boardId, description: rewardName.trim(), required_points: rewardPoints };
    const result = editingReward
      ? await supabase.from("reward_definitions").update(payload).eq("id", editingReward).eq("habit_bingo_id", boardId)
      : await supabase.from("reward_definitions").insert(payload);
    if (!result.error) {
      setRewardName(""); setRewardPoints(3); setEditingReward(null);
      await reloadRewards(boardId);
    }
    setSaving(false);
    setMessage(result.error ? "ごほうびを保存できませんでした。" : "ごほうびを保存しました。");
  }

  async function removeReward(reward: EditableReward) {
    if (!boardId || !confirm(`「${reward.description}」を削除しますか？`)) return;
    setSaving(true);
    const { error } = await supabase.from("reward_definitions").delete().eq("id", reward.id).eq("habit_bingo_id", boardId);
    if (!error) await reloadRewards(boardId);
    setSaving(false);
    setMessage(error ? "交換履歴のあるごほうびは削除できません。" : "ごほうびを削除しました。");
  }

  return <main className="bingo-shell"><AppMenu current="habit-bingo"/><div className="bingo-wrap">
    <Link className="bingo-back-link" href="/habit">← HabitBingoに戻る</Link>
    <div className="bingo-brand">HABIT BINGO EDIT</div>
    <h1 className="bingo-title">習慣とごほうびを<br/>編集する。</h1>
    {loading ? <div className="bingo-card">読み込み中…</div> : boardId ? <><div className="bingo-card">
      <h2>9個の習慣</h2><p className="bingo-note">変更した名前は過去の記録にも表示されます。</p>
      {habits.map((habit, index) => <div className="habit-edit-row" key={habit.id}>
        <label><span>{index + 1}. 習慣</span><input className="bingo-field" maxLength={40} value={habit.name} onChange={(event) => setHabits((current) => current.map((item) => item.id === habit.id ? { ...item, name: event.target.value } : item))}/></label>
      </div>)}
      <div className="habit-edit-actions"><button className="bingo-action" disabled={saving} onClick={() => void save()}>{saving ? "保存中…" : "変更を保存"}</button><Link className="bingo-action bingo-secondary" href="/habit">キャンセル</Link></div>
    </div><div className="bingo-card habit-reward-editor" id="rewards"><h2>ごほうび</h2><p className="bingo-note">ごほうび名と交換に必要なポイントを設定します。</p><div className="reward-list">{rewards.map((reward) => <article key={reward.id}><div><strong>⭐ {reward.required_points}pt</strong><b>{reward.description}</b></div><div className="reward-tools"><button onClick={() => { setEditingReward(reward.id); setRewardName(reward.description); setRewardPoints(reward.required_points); }}>編集</button><button onClick={() => void removeReward(reward)}>削除</button></div></article>)}</div><div className="reward-form"><h3>{editingReward ? "ごほうびを編集" : "ごほうびを追加"}</h3><input className="bingo-field" placeholder="例：コンビニスイーツ" maxLength={100} value={rewardName} onChange={(event) => setRewardName(event.target.value)}/><label><input className="bingo-field" type="number" min="1" value={rewardPoints} onChange={(event) => setRewardPoints(Number(event.target.value))}/><span>pt</span></label><button className="bingo-action" disabled={saving} onClick={() => void saveReward()}>{editingReward ? "変更を保存" : "追加する"}</button>{editingReward && <button className="reward-cancel" onClick={() => { setEditingReward(null); setRewardName(""); setRewardPoints(3); }}>キャンセル</button>}</div></div></> : <div className="bingo-card"><p>{message}</p><Link className="bingo-action" href="/habit">HabitBingoへ</Link></div>}
    {boardId && message && <p className={message.includes("保存しました") ? "bingo-success" : "bingo-error"} role="status">{message}</p>}
  </div></main>;
}
