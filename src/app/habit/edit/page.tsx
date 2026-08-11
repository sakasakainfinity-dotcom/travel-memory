"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppMenu from "@/components/AppMenu";
import { loadGuestHabitData, saveGuestHabitData } from "@/lib/habit/guest";
import { supabase } from "@/lib/supabaseClient";

type EditableHabit = { id: string; position: number; title: string; description: string | null };
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
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const guest = loadGuestHabitData();
        setIsGuest(true); setBoardId("guest"); setHabits(guest.habits); setRewards(guest.rewards);
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
        supabase.from("habits").select("id,position,title,description").eq("habit_bingo_id", board.id).order("position"),
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
    if (!boardId || habits.length !== 9 || habits.some((habit) => !habit.title.trim())) {
      setMessage("9個すべてのタイトルを入力してください。");
      return;
    }

    setSaving(true);
    setMessage("");
    if (isGuest) {
      const guest = loadGuestHabitData();
      guest.habits = habits.map((habit) => ({ ...habit, title: habit.title.trim(), description: habit.description?.trim() ?? "" }));
      saveGuestHabitData(guest); setHabits(guest.habits); setSaving(false); setMessage("習慣を保存しました。"); return;
    }
    const results = await Promise.all([
      ...habits.map((habit) => supabase.from("habits").update({ name: habit.title.trim(), title: habit.title.trim(), description: habit.description?.trim() || null }).eq("id", habit.id).eq("habit_bingo_id", boardId)),
    ]);
    setSaving(false);
    setMessage(results.some((result) => result.error) ? "保存できませんでした。もう一度お試しください。" : "習慣を保存しました。");
  }

  async function reloadRewards(id: string) {
    if (isGuest) { setRewards(loadGuestHabitData().rewards); return null; }
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
    if (isGuest) {
      const guest = loadGuestHabitData();
      if (editingReward) guest.rewards = guest.rewards.map((reward) => reward.id === editingReward ? { id: reward.id, description: rewardName.trim(), required_points: rewardPoints } : reward);
      else guest.rewards.push({ id: `guest-reward-${Date.now()}`, description: rewardName.trim(), required_points: rewardPoints });
      saveGuestHabitData(guest); setRewards(guest.rewards); setRewardName(""); setRewardPoints(3); setEditingReward(null); setSaving(false); setMessage("ごほうびを保存しました。"); return;
    }
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
    if (isGuest) {
      const guest = loadGuestHabitData(); guest.rewards = guest.rewards.filter((item) => item.id !== reward.id); saveGuestHabitData(guest); setRewards(guest.rewards); setSaving(false); setMessage("ごほうびを削除しました。"); return;
    }
    const { error } = await supabase.from("reward_definitions").delete().eq("id", reward.id).eq("habit_bingo_id", boardId);
    if (!error) await reloadRewards(boardId);
    setSaving(false);
    setMessage(error ? "交換履歴のあるごほうびは削除できません。" : "ごほうびを削除しました。");
  }

  return <main className="bingo-shell"><AppMenu current="habit-bingo"/><div className="bingo-wrap">
    <Link className="bingo-back-link" href="/habit">← HabitBingoに戻る</Link>
    <div className="bingo-brand">HABIT BINGO EDIT</div>
    <h1 className="bingo-title">習慣とごほうびを<br/>編集する。</h1>
    {isGuest && <p className="habit-guest-note">ログインなしでお試し中です。設定はこの端末に保存されます。</p>}
    {loading ? <div className="bingo-card">読み込み中…</div> : boardId ? <><div className="bingo-card">
      <h2>9個の習慣</h2><p className="bingo-note">タイトルはビンゴと実績表に表示されます。詳細は具体的な達成条件を記録できます。</p>
      {habits.map((habit, index) => <div className="habit-edit-row" key={habit.id}>
        <label><span>{index + 1}. タイトル（必須）</span><input className="bingo-field" placeholder="例：昼に運動" required maxLength={10} value={habit.title} onChange={(event) => setHabits((current) => current.map((item) => item.id === habit.id ? { ...item, title: event.target.value } : item))}/></label>
        <label><span>詳細（任意）</span><input className="bingo-field" placeholder="具体的な数字も入れてみよう" maxLength={30} value={habit.description ?? ""} onChange={(event) => setHabits((current) => current.map((item) => item.id === habit.id ? { ...item, description: event.target.value } : item))}/></label>
      </div>)}
      <div className="habit-edit-actions"><button className="bingo-action" disabled={saving} onClick={() => void save()}>{saving ? "保存中…" : "変更を保存"}</button><Link className="bingo-action bingo-secondary" href="/habit">キャンセル</Link></div>
    </div><div className="bingo-card habit-reward-editor" id="rewards"><h2>ごほうび</h2><p className="bingo-note">ごほうび名と交換に必要なポイントを設定します。</p><div className="reward-list">{rewards.map((reward) => <article key={reward.id}><div><strong>⭐ {reward.required_points}pt</strong><b>{reward.description}</b></div><div className="reward-tools"><button onClick={() => { setEditingReward(reward.id); setRewardName(reward.description); setRewardPoints(reward.required_points); }}>編集</button><button onClick={() => void removeReward(reward)}>削除</button></div></article>)}</div><div className="reward-form"><h3>{editingReward ? "ごほうびを編集" : "ごほうびを追加"}</h3><input className="bingo-field" placeholder="例：コンビニスイーツ" maxLength={100} value={rewardName} onChange={(event) => setRewardName(event.target.value)}/><label><input className="bingo-field" type="number" min="1" value={rewardPoints} onChange={(event) => setRewardPoints(Number(event.target.value))}/><span>pt</span></label><button className="bingo-action" disabled={saving} onClick={() => void saveReward()}>{editingReward ? "変更を保存" : "追加する"}</button>{editingReward && <button className="reward-cancel" onClick={() => { setEditingReward(null); setRewardName(""); setRewardPoints(3); }}>キャンセル</button>}</div></div></> : <div className="bingo-card"><p>{message}</p><Link className="bingo-action" href="/habit">HabitBingoへ</Link></div>}
    {boardId && message && <p className={message.includes("保存しました") ? "bingo-success" : "bingo-error"} role="status">{message}</p>}
  </div></main>;
}
