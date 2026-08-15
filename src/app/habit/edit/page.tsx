"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppMenu from "@/components/AppMenu";
import MagicLinkLogin from "@/components/MagicLinkLogin";
import { loadGuestHabitData, saveGuestHabitData } from "@/lib/habit/guest";
import { supabase } from "@/lib/supabaseClient";

type EditableHabit = { id: string; position: number; title: string; if_condition: string; then_action: string };
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
  const [access, setAccess] = useState<"checking" | "login" | "denied" | "allowed">("checking");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAccess("login"); setLoading(false); return;
      }
      const { data: entitled } = await supabase.rpc("has_entitlement", { kind: "if_then_bingo" });
      if (!entitled) { setAccess("denied"); setLoading(false); return; }
      setAccess("allowed");
      const { data: board, error: boardError } = await supabase.from("habit_bingos").select("id").eq("user_id", user.id).eq("is_active", true).maybeSingle();
      if (boardError) {
        setMessage("If Then Bingoを読み込めませんでした。");
        setLoading(false);
        return;
      }
      if (!board) {
        setMessage("先にIf Then Bingoを作成してください。");
        setLoading(false);
        return;
      }

      setBoardId(board.id);
      const [{ data: habitRows, error: habitsError }, { data: rewardRows, error: rewardsError }] = await Promise.all([
        supabase.from("habits").select("id,position,title,if_condition,then_action").eq("habit_bingo_id", board.id).order("position"),
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
    if (habits.some((habit) => habit.title.trim().length > 10)) {
      setMessage("タイトルが長すぎます。10文字以内で入力してください。");
      return;
    }
    if (habits.some((habit) => !habit.if_condition.trim() || !habit.then_action.trim())) {
      setMessage("9個すべてのIfとThenを入力してください。");
      return;
    }
    if (habits.some((habit) => habit.if_condition.trim().length > 30 || habit.then_action.trim().length > 30)) {
      setMessage("IfとThenはそれぞれ30文字以内で入力してください。");
      return;
    }

    setSaving(true);
    setMessage("");
    if (isGuest) {
      const guest = loadGuestHabitData();
      guest.habits = habits.map((habit) => ({ ...habit, title: habit.title.trim(), description: habit.then_action.trim(), if_condition: habit.if_condition.trim(), then_action: habit.then_action.trim() }));
      saveGuestHabitData(guest); setHabits(guest.habits); setSaving(false); setMessage("習慣を保存しました。"); return;
    }
    const results = await Promise.all([
      ...habits.map((habit) => supabase.from("habits").update({ name: habit.title.trim(), title: habit.title.trim(), description: habit.then_action.trim(), if_condition: habit.if_condition.trim(), then_action: habit.then_action.trim() }).eq("id", habit.id).eq("habit_bingo_id", boardId)),
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

  if (access === "login") return <MagicLinkLogin next="/habit/edit"/>;
  if (access === "denied") return <main className="member-login"><div><h1>if then bingo</h1><p>このアカウントではif then bingoを利用できません。</p></div></main>;
  return <main className="bingo-shell"><AppMenu current="habit-bingo"/><div className="bingo-wrap">
    <Link className="bingo-back-link" href="/habit">← If Then Bingoに戻る</Link>
    <div className="bingo-brand">IF THEN BINGO EDIT</div>
    <h1 className="bingo-title">ルールとごほうびを<br/>編集する。</h1>
    {isGuest && <p className="habit-guest-note">ログインなしでお試し中です。設定はこの端末に保存されます。</p>}
    {loading ? <div className="bingo-card">読み込み中…</div> : boardId ? <><div className="bingo-card">
      <h2>9個のIf / Thenルール</h2><p className="bingo-note">ビンゴにはIfとThenが表示され、記録の実績表にはこれまで通りタイトルが表示されます。</p>
      {habits.map((habit, index) => <div className="habit-edit-row" key={habit.id}>
        <label className="habit-title-field"><span>{index + 1}. 記録用タイトル（必須・10文字以内）</span><input className="bingo-field" placeholder="例：昼の運動" required maxLength={10} value={habit.title} onChange={(event) => setHabits((current) => current.map((item) => item.id === habit.id ? { ...item, title: event.target.value } : item))}/></label>
        <label className="habit-description-field"><span>If：もし（必須・30文字以内）</span><input className="bingo-field" placeholder="例：お昼休みになったら" required maxLength={30} value={habit.if_condition} onChange={(event) => setHabits((current) => current.map((item) => item.id === habit.id ? { ...item, if_condition: event.target.value } : item))}/></label>
        <label className="habit-description-field"><span>Then：そのとき（必須・30文字以内）</span><input className="bingo-field" placeholder="例：10分散歩する" required maxLength={30} value={habit.then_action} onChange={(event) => setHabits((current) => current.map((item) => item.id === habit.id ? { ...item, then_action: event.target.value } : item))}/></label>
      </div>)}
      <div className="habit-edit-actions"><button className="bingo-action" disabled={saving} onClick={() => void save()}>{saving ? "保存中…" : "変更を保存"}</button><Link className="bingo-action bingo-secondary" href="/habit">キャンセル</Link></div>
    </div><div className="bingo-card habit-reward-editor" id="rewards"><h2>ごほうび</h2><p className="bingo-note">ごほうび名と交換に必要なポイントを設定します。</p><div className="reward-list">{rewards.map((reward) => <article key={reward.id}><div><strong>⭐ {reward.required_points}pt</strong><b>{reward.description}</b></div><div className="reward-tools"><button onClick={() => { setEditingReward(reward.id); setRewardName(reward.description); setRewardPoints(reward.required_points); }}>編集</button><button onClick={() => void removeReward(reward)}>削除</button></div></article>)}</div><div className="reward-form"><h3>{editingReward ? "ごほうびを編集" : "ごほうびを追加"}</h3><input className="bingo-field" placeholder="例：コンビニスイーツ" maxLength={100} value={rewardName} onChange={(event) => setRewardName(event.target.value)}/><label><input className="bingo-field" type="number" min="1" value={rewardPoints} onChange={(event) => setRewardPoints(Number(event.target.value))}/><span>pt</span></label><button className="bingo-action" disabled={saving} onClick={() => void saveReward()}>{editingReward ? "変更を保存" : "追加する"}</button>{editingReward && <button className="reward-cancel" onClick={() => { setEditingReward(null); setRewardName(""); setRewardPoints(3); }}>キャンセル</button>}</div></div></> : <div className="bingo-card"><p>{message}</p><Link className="bingo-action" href="/habit">If Then Bingoへ</Link></div>}
    {boardId && message && <p className={message.includes("保存しました") ? "bingo-success" : "bingo-error"} role="status">{message}</p>}
  </div></main>;
}
