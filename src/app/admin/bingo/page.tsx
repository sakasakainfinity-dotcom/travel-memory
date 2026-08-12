"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Bingo = { id: string; title: string; slug: string; municipality_name: string; description: string | null; is_published: boolean };
type Item = { id: string; bingo_id: string; position: number; type: "photo" | "quiz" | "user_mission"; title: string; description: string | null; image_url: string | null; active: boolean };

export default function AdminBingo() {
  const [rows, setRows] = useState<Bingo[]>([]);
  const [items, setItems] = useState<Record<string, Item[]>>({});
  const [editing, setEditing] = useState<Item | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  function openItems(boardId: string) {
    const target = document.getElementById(`bingo-items-${boardId}`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `#bingo-items-${boardId}`);
    target?.querySelector<HTMLButtonElement>("button[data-editable-cell]")?.focus({ preventScroll: true });
  }

  async function load() {
    const { data, error } = await supabase.from("bingos")
      .select("id,title,slug,municipality_name,description,is_published,items:bingo_items(id,bingo_id,position,type,title,description,image_url,active)")
      .order("created_at");
    if (error) { setMessage("管理者権限が必要です"); return; }
    const boards = (data ?? []) as unknown as (Bingo & { items: Item[] })[];
    setRows(boards.map(({ items: _items, ...board }) => board));
    setItems(Object.fromEntries(boards.map((board) => [board.id, [...board.items].sort((a, b) => a.position - b.position)])));
  }

  useEffect(() => { void load(); }, []);

  async function create() {
    if (!title.trim() || !slug.trim() || !municipality.trim()) { setMessage("タイトル・slug・市町村を入力してください"); return; }
    setSaving(true);
    const { data, error } = await supabase.from("bingos").insert({ title: title.trim(), slug: slug.trim(), municipality_name: municipality.trim(), is_published: false }).select("id").single();
    if (error || !data) { setMessage("作成できませんでした"); setSaving(false); return; }
    const { error: itemError } = await supabase.from("bingo_items").insert(Array.from({ length: 25 }, (_, position) => ({
      bingo_id: data.id, position, sort_order: position, type: position === 12 ? "user_mission" : "photo",
      title: position === 12 ? "YOUR MISSION" : `マス ${position + 1}`,
      description: position === 12 ? "今回の旅でやりたいことを自分で決めよう！" : null,
      photo_required: false, active: true,
    })));
    setMessage(itemError ? "盤面を作成できませんでした" : "旅ビンゴを作成しました");
    if (!itemError) { setTitle(""); setSlug(""); setMunicipality(""); }
    setSaving(false); await load();
  }

  async function saveBoard(row: Bingo) {
    setSaving(true);
    const { error } = await supabase.from("bingos").update({ title: row.title, description: row.description, is_published: row.is_published }).eq("id", row.id);
    setMessage(error ? "保存できませんでした" : "公開設定を保存しました"); setSaving(false); await load();
  }

  async function saveItem() {
    if (!editing || !editing.title.trim()) return;
    setSaving(true);
    const { error } = await supabase.rpc("update_bingo_item", {
      target_id: editing.id, next_position: editing.position, next_title: editing.title.trim(),
      next_description: editing.description ?? "", next_image_url: editing.image_url ?? "",
      next_active: editing.active, next_type: editing.type,
    });
    setMessage(error ? `マスを保存できませんでした: ${error.message}` : "マスを保存しました。ユーザー画面へ反映されます");
    if (!error) setEditing(null);
    setSaving(false); await load();
  }

  return <main className="bingo-shell"><div className="bingo-wrap admin-bingo-wrap">
    <div className="bingo-brand">ADMIN</div><h1>旅ビンゴ設定</h1>
    {rows.length > 0 && <nav className="admin-bingo-nav" aria-label="旅ビンゴのクイックメニュー">
      <strong>ビンゴアイテムを編集</strong>
      <div>{rows.map((row) => <button type="button" key={row.id} onClick={() => openItems(row.id)}>{row.title}<span>25マスへ →</span></button>)}</div>
    </nav>}
    <div className="bingo-card admin-create"><h2>新規作成（25マス）</h2>
      <input className="bingo-field" placeholder="タイトル" value={title} onChange={(e) => setTitle(e.target.value)}/>
      <input className="bingo-field" placeholder="slug" value={slug} onChange={(e) => setSlug(e.target.value)}/>
      <input className="bingo-field" placeholder="市町村" value={municipality} onChange={(e) => setMunicipality(e.target.value)}/>
      <button className="bingo-action" disabled={saving} onClick={() => void create()}>非公開で作成</button>
    </div>
    {rows.map((row, rowIndex) => <section className="bingo-card admin-board" id={`bingo-items-${row.id}`} key={row.id}>
      <div className="admin-board-settings"><div><div className="bingo-brand">{row.municipality_name}</div><input aria-label="ビンゴタイトル" className="bingo-field" value={row.title} onChange={(e) => setRows((current) => current.map((value, index) => index === rowIndex ? { ...value, title: e.target.value } : value))}/></div>
        <label><input type="checkbox" checked={row.is_published} onChange={(e) => setRows((current) => current.map((value, index) => index === rowIndex ? { ...value, is_published: e.target.checked } : value))}/> 公開中</label>
        <button className="bingo-action" disabled={saving} onClick={() => void saveBoard(row)}>公開設定を保存</button></div>
      <div className="admin-items-heading"><div><h2>ビンゴアイテム（25マス）</h2><p className="bingo-note">編集するマスを選んでください。移動先にマスがある場合は位置を入れ替えます。</p></div><Link href={`/bingo/${row.slug}`} target="_blank">ユーザー画面を確認 ↗</Link></div>
      <div className="bingo-grid bingo-grid-5 admin-bingo-grid">{Array.from({ length: 25 }, (_, position) => {
        const item = items[row.id]?.find((candidate) => candidate.position === position);
        const centre = position === 12;
        return <button key={position} type="button" data-editable-cell={!centre && item ? "true" : undefined} className={`bingo-cell ${centre ? "is-user-mission" : ""} ${item && !item.active ? "is-inactive" : ""}`} disabled={centre || !item} onClick={() => item && setEditing({ ...item })}>
          <small>{position + 1}</small>{centre ? <><b>👤</b><span>ユーザー<br/>設定マス</span></> : <span>{item?.title ?? "未設定"}</span>}
        </button>;
      })}</div>
    </section>)}
    {message && <p className={message.includes("保存しました") || message.includes("作成しました") ? "bingo-success" : "bingo-error"} role="status">{message}</p>}
    {editing && <div className="bingo-modal" onClick={() => setEditing(null)}><form onSubmit={(event) => { event.preventDefault(); void saveItem(); }} onClick={(event) => event.stopPropagation()}>
      <div className="bingo-brand">CELL {editing.position + 1}</div><h2>マスを編集</h2>
      <label className="admin-field-label">タイトル<input required maxLength={60} className="bingo-field" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })}/></label>
      <label className="admin-field-label">説明文<textarea maxLength={300} rows={4} className="bingo-field" value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })}/></label>
      <label className="admin-field-label">画像URL<input type="url" className="bingo-field" placeholder="https://…" value={editing.image_url ?? ""} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })}/></label>
      <label className="admin-field-label">種類<select className="bingo-field" value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value as "photo" | "quiz" })}><option value="photo">写真ミッション</option><option value="quiz">クイズ</option></select></label>
      <label className="admin-field-label">並び順（1〜25、13は予約済み）<input type="number" min={1} max={25} required className="bingo-field" value={editing.position + 1} onChange={(e) => setEditing({ ...editing, position: Number(e.target.value) - 1 })}/></label>
      <label className="admin-active"><input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })}/> ユーザー画面に表示する</label>
      <div className="admin-modal-actions"><button className="bingo-action" disabled={saving}>{saving ? "保存中…" : "変更を保存"}</button><button type="button" className="bingo-action bingo-secondary" onClick={() => setEditing(null)}>キャンセル</button></div>
    </form></div>}
  </div></main>;
}
