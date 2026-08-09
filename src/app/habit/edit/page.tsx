"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppMenu from "@/components/AppMenu";
import { supabase } from "@/lib/supabaseClient";

type EditableHabit = { id: string; position: number; name: string };

export default function HabitEditPage() {
  const [boardId, setBoardId] = useState<string | null>(null);
  const [habits, setHabits] = useState<EditableHabit[]>([]);
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
      const { data: habitRows, error: habitsError } = await supabase.from("habits").select("id,position,name").eq("habit_bingo_id", board.id).order("position");
      if (habitsError) {
        setMessage("編集内容を読み込めませんでした。");
      } else {
        setHabits(habitRows ?? []);
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

  return <main className="bingo-shell"><AppMenu current="habit-bingo"/><div className="bingo-wrap">
    <Link className="bingo-back-link" href="/habit">← HabitBingoに戻る</Link>
    <div className="bingo-brand">HABIT BINGO EDIT</div>
    <h1 className="bingo-title">9つの習慣を<br/>編集する。</h1>
    {loading ? <div className="bingo-card">読み込み中…</div> : boardId ? <div className="bingo-card">
      <h2>9個の習慣</h2><p className="bingo-note">変更した名前は過去の記録にも表示されます。</p>
      {habits.map((habit, index) => <div className="habit-edit-row" key={habit.id}>
        <label><span>{index + 1}. 習慣</span><input className="bingo-field" maxLength={40} value={habit.name} onChange={(event) => setHabits((current) => current.map((item) => item.id === habit.id ? { ...item, name: event.target.value } : item))}/></label>
      </div>)}
      <div className="habit-edit-actions"><button className="bingo-action" disabled={saving} onClick={() => void save()}>{saving ? "保存中…" : "変更を保存"}</button><Link className="bingo-action bingo-secondary" href="/habit">キャンセル</Link></div>
    </div> : <div className="bingo-card"><p>{message}</p><Link className="bingo-action" href="/habit">HabitBingoへ</Link></div>}
    {boardId && message && <p className={message.includes("保存しました") ? "bingo-success" : "bingo-error"} role="status">{message}</p>}
  </div></main>;
}
