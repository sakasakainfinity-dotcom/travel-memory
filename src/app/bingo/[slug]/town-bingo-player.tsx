"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BingoGrid from "@/components/bingo/BingoGrid";
import { convertToUploadableImage } from "@/lib/convertToUploadableImage";
import { bingoLines, formatElapsed, normalizeAnswer } from "@/lib/bingo/lines";
import { supabase } from "@/lib/supabaseClient";

type Item = {
  id: string;
  position: number;
  type: "photo" | "quiz" | "user_mission";
  title: string;
  description: string | null;
  question: string | null;
  hint: string | null;
  correct_answers: string[] | null;
  spot_id: string | null;
  photo_required: boolean;
  image_url: string | null;
  active: boolean;
  places?: { lat: number; lng: number; title: string } | null;
};
type Game = { id: string; title: string; description: string | null; items: Item[] };
type GuestProgress = {
  startTime: string;
  completedAt: string | null;
  clearedIds: string[];
  customTitle?: string;
  clearedAtById?: Record<string, string>;
  photoById?: Record<string, string>;
};

const storageKey = (slug: string) => `town-bingo-progress:${slug}`;

export default function TownBingoPlayer({ slug }: { slug: string }) {
  const [game, setGame] = useState<Game | null>(null);
  const [progress, setProgress] = useState<GuestProgress | null>(null);
  const [selected, setSelected] = useState<Item | null>(null);
  const [answer, setAnswer] = useState("");
  const [missionDraft, setMissionDraft] = useState("");
  const [message, setMessage] = useState("");
  const [photoSaving, setPhotoSaving] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey(slug));
    if (saved) {
      try {
        setProgress(JSON.parse(saved) as GuestProgress);
      } catch {
        localStorage.removeItem(storageKey(slug));
      }
    }

    void (async () => {
      const { data } = await supabase
        .from("bingos")
        .select("id,title,description,items:bingo_items(id,position,type,title,description,question,hint,correct_answers,spot_id,photo_required,image_url,active,places(lat,lng,title))")
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle();
      if (!data) return;
      setGame({
        ...data,
        items: [...(data.items ?? [])]
          .sort((a: any, b: any) => a.position - b.position)
          .map((item: any) => ({
            ...item,
            places: Array.isArray(item.places) ? item.places[0] ?? null : item.places,
          })),
      } as Game);
    })();
  }, [slug]);

  const done = useMemo(() => {
    const missionId = game?.items.find((item) => item.type === "user_mission" || item.position === 12)?.id;
    return new Set((progress?.clearedIds ?? []).filter((id) => id !== missionId || Boolean(progress?.customTitle)));
  }, [game, progress]);
  const clearedIndexes = useMemo(
    () => new Set(game?.items.map((item) => done.has(item.id) ? item.position : -1).filter((position) => position >= 0) ?? []),
    [game, done],
  );
  const lines = bingoLines(5, clearedIndexes);

  function save(next: GuestProgress) {
    setProgress(next);
    localStorage.setItem(storageKey(slug), JSON.stringify(next));
  }

  function start() {
    save({ startTime: new Date().toISOString(), completedAt: null, clearedIds: [] });
    setMessage("");
  }

  function clear(item: Item, photo?: string) {
    if (!progress) return;
    const clearedIds = Array.from(new Set([...progress.clearedIds, item.id]));
    const clearedAt = progress.clearedAtById?.[item.id] ?? new Date().toISOString();
    const completedAt = clearedIds.length === game?.items.filter((candidate) => candidate.active).length ? clearedAt : progress.completedAt;
    save({
      ...progress,
      clearedIds,
      completedAt,
      clearedAtById: { ...progress.clearedAtById, [item.id]: clearedAt },
      photoById: photo ? { ...progress.photoById, [item.id]: photo } : progress.photoById,
    });
    setSelected(null);
    setAnswer("");
    setMessage("");
  }

  async function savePhoto(item: Item, file: File) {
    setPhotoSaving(true);
    setMessage("");
    try {
      const uploadable = await convertToUploadableImage(file);
      const photo = await resizePhoto(uploadable);
      clear(item, photo);
    } catch {
      setMessage("写真を読み込めませんでした。別の写真を選んでください。");
    } finally {
      setPhotoSaving(false);
    }
  }

  function selectItem(item: Item | undefined) {
    if (!progress || !item?.active) return;
    setSelected(item);
    setMissionDraft(item.type === "user_mission" ? progress.customTitle ?? "" : "");
    setMessage("");
  }

  function saveMission() {
    if (!progress || !missionDraft.trim() || missionDraft.trim().length > 50) return;
    const missionId = game?.items.find((item) => item.type === "user_mission" || item.position === 12)?.id;
    save({ ...progress, customTitle: missionDraft.trim(), clearedIds: progress.customTitle ? progress.clearedIds : progress.clearedIds.filter((id) => id !== missionId) });
    setSelected(null);
  }

  function undoMission(item: Item) {
    if (!progress) return;
    const clearedAtById = { ...progress.clearedAtById };
    delete clearedAtById[item.id];
    save({ ...progress, completedAt: null, clearedIds: progress.clearedIds.filter((id) => id !== item.id), clearedAtById });
    setMessage("達成を取り消しました。ミッションを変更できます");
  }

  function checkQuiz() {
    if (!selected) return;
    if ((selected.correct_answers ?? []).some((value) => normalizeAnswer(value) === normalizeAnswer(answer))) {
      clear(selected);
    } else {
      setMessage("もう一度、街をよく観察してみよう！");
    }
  }

  if (!game) return <main className="bingo-shell"><div className="bingo-wrap">BINGOを読み込み中…</div></main>;

  return (
    <main className="bingo-shell">
      <div className="bingo-wrap">
        <Link href="/bingo">← 街を選ぶ</Link>
        <div className="bingo-brand">TOWN BINGO</div>
        <h1 className="bingo-title">{game.title}</h1>
        <div className="bingo-stats">
          <span>CLEAR {done.size} / 25</span><span>BINGO {lines.length}</span>
          <span>TIME {formatElapsed(progress?.startTime ?? null, progress?.completedAt ?? null, now)}</span>
        </div>
        {!progress && <div className="bingo-card" style={{ marginTop: 16 }}>
          <p>{game.description}</p>
          <button className="bingo-action" onClick={start}>BINGOをスタート</button>
          <p className="bingo-note">ログイン不要。進捗はこの端末に保存されます。</p>
        </div>}
        <BingoGrid size={5} cleared={clearedIndexes} onSelect={(position) => selectItem(game.items.find((item) => item.position === position))}>
          {Array.from({ length: 25 }, (_, position) => {
            const item = game.items.find((candidate) => candidate.position === position);
            if (!item?.active) return <span className="bingo-empty" key={position}>—</span>;
            const isMission = item.type === "user_mission" || position === 12;
            const clearedAt = progress?.clearedAtById?.[item.id];
            const photo = progress?.photoById?.[item.id];
            return <span className={`${isMission ? "user-mission-cell" : ""} ${photo ? "bingo-photo-cell" : ""}`} key={position}>
              {photo && <img src={photo} alt={`${item.title}の投稿写真`}/>}
              {done.has(item.id) ? <span className="bingo-clear-details"><b>✓ 達成！</b><small>{isMission ? progress?.customTitle : item.title}</small>{clearedAt && <time dateTime={clearedAt}>{formatClearedTime(clearedAt)}</time>}</span> : isMission ? <><b>YOUR MISSION</b><small>{progress?.customTitle || "今回の旅でやりたいことを決めよう！"}</small>{!progress?.customTitle && <em>＋ 設定する</em>}</> : item.title}
            </span>;
          })}
        </BingoGrid>
        {lines.length > 0 && <div className="bingo-card"><b>🎉 {lines.length} BINGO 達成！</b></div>}
        {message && <p className="bingo-error">{message}</p>}
        {selected && <div className="bingo-modal" onClick={() => setSelected(null)}><div onClick={(event) => event.stopPropagation()}>
          {(selected.type === "user_mission" || selected.position === 12) ? <>
            <div className="bingo-brand">YOUR MISSION</div><h2>{progress?.customTitle ? "今回の旅でやりたいこと" : "自分だけの中央マス"}</h2>
            {done.has(selected.id) ? <><p className="mission-completed">✓ 達成！</p><p><b>{progress?.customTitle}</b></p><p className="bingo-note">達成後は内容を変更できません。変更するには、先に達成を取り消してください。</p><button className="bingo-action bingo-secondary" onClick={() => undoMission(selected)}>達成を取り消す</button></> : <>
              <p>今回の旅でやりたいことを決めよう！</p><label className="admin-field-label">今回の旅でやりたいこと<input autoFocus className="bingo-field" maxLength={50} placeholder="例：家族みんなで写真を撮る" value={missionDraft} onChange={(event) => setMissionDraft(event.target.value)}/><small>{missionDraft.length} / 50文字</small></label>
              <p><button className="bingo-action" disabled={!missionDraft.trim()} onClick={saveMission}>{progress?.customTitle ? "ミッションを変更する" : "このミッションに決定"}</button></p>
              {progress?.customTitle && <button className="bingo-action bingo-secondary" onClick={() => clear(selected)}>✓ このミッションを達成</button>}
            </>}
          </> : <><div className="bingo-brand">{selected.type === "photo" ? "PHOTO MISSION" : "QUIZ"}</div>
          <h2>{selected.title}</h2>{selected.image_url && <img className="bingo-mission-image" src={selected.image_url} alt=""/>}<p>{selected.description}</p>
          {selected.question && <p><b>{selected.question}</b></p>}
          {selected.hint && <details><summary>ヒントを見る</summary><p>{selected.hint}</p></details>}
          {selected.places && <p><a className="bingo-action bingo-secondary" href={`/map?lat=${selected.places.lat}&lng=${selected.places.lng}&zoom=16`}>地図で場所を見る</a></p>}
          {selected.type === "quiz" ? <><input className="bingo-field" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="答えを入力"/><p><button className="bingo-action" onClick={checkQuiz}>回答する</button></p></> : <><label className="bingo-action">{photoSaving ? "写真を保存中…" : "写真を撮る／選ぶ"}<input disabled={photoSaving} hidden type="file" accept="image/*" capture="environment" onChange={(event) => event.target.files?.[0] && void savePhoto(selected, event.target.files[0])}/></label>{!selected.photo_required && <button className="bingo-action bingo-secondary" disabled={photoSaving} onClick={() => clear(selected)}>撮影せずCLEAR</button>}</>}</>}
          <p><button onClick={() => setSelected(null)}>閉じる</button></p>
        </div></div>}
      </div>
    </main>
  );
}

function formatClearedTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function resizePhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const maxSide = 640;
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) return reject(new Error("Canvas is unavailable"));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image could not be decoded"));
    };
    image.src = objectUrl;
  });
}
