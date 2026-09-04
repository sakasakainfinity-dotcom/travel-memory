"use client";

import { useEffect, useMemo, useState } from "react";
import AdminNavigation from "@/components/admin/AdminNavigation";
import PlaceGeocodeSearch from "@/components/PlaceGeocodeSearch";
import StaySpotMapEditor, { type AdminMapSpot } from "@/components/admin/StaySpotMapEditor";
import { supabase } from "@/lib/supabaseClient";

type Recommendation = { stay_id: string; host_comment: string; local_comment: string | null; is_featured: boolean; sort_order: number; is_published: boolean };
type Stay = { id: string; name: string; slug: string; subtitle: string | null; description: string | null; image_url: string | null; address: string | null; latitude: number | null; longitude: number | null; is_published: boolean; recommendations?: { count: number }[] };
type Category = { id: string; name: string; slug: string };
type SpotRow = AdminMapSpot & { address: string | null; google_maps_url: string | null; image_url: string | null; description: string | null; distance_label: string | null; walking_time: string | null; driving_time: string | null; business_hours: string | null; closed_days: string | null; website_url: string | null; instagram_url: string | null; recommendations?: Recommendation[] };
const emptyStay = { name: "", slug: "", subtitle: "宿主おすすめMAP", description: "", image_url: "", address: "", latitude: "", longitude: "", is_published: false };
const emptySpot = { id: "", name: "", latitude: "", longitude: "", google_maps_url: "", image_url: "", description: "", distance_label: "", walking_time: "", driving_time: "", business_hours: "", closed_days: "", website_url: "", instagram_url: "", host_comment: "", local_comment: "", stay_id: "", category_ids: [] as string[], sort_order: 0, is_featured: false, is_published: true };
const CATEGORY_SLUGS = ["restaurant", "souvenir", "general-goods", "sightseeing", "onsen", "experience"] as const;

export default function StayMapsAdmin() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [stays, setStays] = useState<Stay[]>([]);
  const [spots, setSpots] = useState<SpotRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stayForm, setStayForm] = useState<any>(emptyStay);
  const [spotForm, setSpotForm] = useState<any>(emptySpot);
  const [selectedStayId, setSelectedStayId] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [showStayEditor, setShowStayEditor] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  async function load() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setAllowed(false); return; }
    const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", auth.user.id).maybeSingle();
    if (!profile?.is_admin) { setAllowed(false); return; }
    setAllowed(true);
    const [stayResult, spotResult, categoryResult] = await Promise.all([
      supabase.from("stays").select("*,recommendations:stay_recommendations(count)").order("created_at"),
      supabase.from("stay_spots").select("*,recommendations:stay_recommendations(stay_id,host_comment,local_comment,is_featured,sort_order,is_published)").order("created_at", { ascending: false }),
      supabase.from("stay_spot_categories").select("id,name,slug").in("slug", CATEGORY_SLUGS).order("sort_order"),
    ]);
    if (stayResult.error || spotResult.error || categoryResult.error) setMessage(`読み込みに失敗しました: ${(stayResult.error || spotResult.error || categoryResult.error)?.message}`);
    const nextStays = (stayResult.data ?? []) as unknown as Stay[];
    setStays(nextStays);
    setSelectedStayId((current) => current || nextStays[0]?.id || "");
    setSpots((spotResult.data ?? []) as unknown as SpotRow[]);
    const categoryRows = (categoryResult.data ?? []) as Category[];
    setCategories(CATEGORY_SLUGS.flatMap((slug) => categoryRows.filter((category) => category.slug === slug)));
  }
  useEffect(() => { void load(); }, []);

  const selectedStay = stays.find((stay) => stay.id === selectedStayId);
  const staySpots = useMemo(() => spots.filter((spot) => spot.recommendations?.some((item) => item.stay_id === selectedStayId)), [selectedStayId, spots]);
  const shownSpots = useMemo(() => staySpots.filter((spot) => spot.name.toLowerCase().includes(search.toLowerCase())), [search, staySpots]);
  const mapValue = validCoordinates(spotForm.latitude, spotForm.longitude);

  function startNewSpot(coordinates?: { latitude: number; longitude: number }) {
    setSpotForm({ ...emptySpot, stay_id: selectedStayId, latitude: coordinates ? String(coordinates.latitude) : "", longitude: coordinates ? String(coordinates.longitude) : "" });
    setShowDetails(false);
  }
  function pickLocation(coordinates: { latitude: number; longitude: number }) {
    setSpotForm((current: any) => ({ ...current, stay_id: current.stay_id || selectedStayId, latitude: String(coordinates.latitude), longitude: String(coordinates.longitude) }));
  }
  async function saveStay(event: React.FormEvent) {
    event.preventDefault(); setSaving(true);
    const payload = { ...stayForm, latitude: numberOrNull(stayForm.latitude), longitude: numberOrNull(stayForm.longitude), description: nullOrText(stayForm.description), subtitle: nullOrText(stayForm.subtitle), image_url: nullOrText(stayForm.image_url), address: nullOrText(stayForm.address) };
    const id = payload.id; delete payload.id; delete payload.recommendations;
    const result = id ? await supabase.from("stays").update(payload).eq("id", id) : await supabase.from("stays").insert(payload);
    setMessage(result.error ? `保存できませんでした: ${result.error.message}` : "宿を保存しました");
    if (!result.error) { setStayForm(emptyStay); setShowStayEditor(false); }
    setSaving(false); await load();
  }
  async function editSpot(spot: SpotRow) {
    const recommendation = spot.recommendations?.find((item) => item.stay_id === selectedStayId);
    const { data: links } = await supabase.from("stay_spot_category_links").select("category_id").eq("spot_id", spot.id);
    setSpotForm({ ...emptySpot, ...spot, ...recommendation, stay_id: recommendation?.stay_id || selectedStayId, category_ids: (links ?? []).map((link) => link.category_id), latitude: String(spot.latitude), longitude: String(spot.longitude) });
    setShowDetails(true);
  }
  async function saveSpot(event: React.FormEvent) {
    event.preventDefault();
    if (!spotForm.stay_id || !spotForm.host_comment.trim()) { setMessage("宿と宿主からの一言を入力してください"); return; }
    setSaving(true);
    const fields = ["name","google_maps_url","image_url","description","distance_label","walking_time","driving_time","business_hours","closed_days","website_url","instagram_url"] as const;
    const payload: any = { latitude: Number(spotForm.latitude), longitude: Number(spotForm.longitude), is_published: spotForm.is_published };
    fields.forEach((key) => payload[key] = key === "name" ? spotForm[key].trim() : nullOrText(spotForm[key]));
    let spotId = spotForm.id;
    const result = spotId ? await supabase.from("stay_spots").update(payload).eq("id", spotId).select("id").single() : await supabase.from("stay_spots").insert(payload).select("id").single();
    if (result.error || !result.data) { setMessage(`保存できませんでした: ${result.error?.message}`); setSaving(false); return; }
    spotId = result.data.id;
    await supabase.from("stay_spot_category_links").delete().eq("spot_id", spotId);
    if (spotForm.category_ids.length) await supabase.from("stay_spot_category_links").insert(spotForm.category_ids.map((category_id: string) => ({ spot_id: spotId, category_id })));
    const recommendation = await supabase.from("stay_recommendations").upsert({ stay_id: spotForm.stay_id, spot_id: spotId, host_comment: spotForm.host_comment.trim(), local_comment: nullOrText(spotForm.local_comment), is_featured: spotForm.is_featured, is_published: spotForm.is_published, sort_order: Number(spotForm.sort_order) || 0 });
    setMessage(recommendation.error ? `おすすめを保存できませんでした: ${recommendation.error.message}` : "スポットを保存しました");
    if (!recommendation.error) startNewSpot();
    setSaving(false); await load();
  }
  async function removeSpot(id: string) {
    if (!window.confirm("このスポットを削除しますか？複数の宿で使われている場合も削除されます。")) return;
    const { error } = await supabase.from("stay_spots").delete().eq("id", id);
    setMessage(error ? `削除できませんでした: ${error.message}` : "削除しました");
    if (!error) startNewSpot();
    await load();
  }

  if (allowed === null) return <main className="admin-dashboard-state">管理者権限を確認しています…</main>;
  if (!allowed) return <main className="admin-dashboard-state">管理者としてログインしてください。</main>;
  return <main className="stay-admin">
    <AdminNavigation current="stay-maps" />
    <header><div><span>LOCAL GUIDE CMS</span><h1>地図からスポット登録</h1></div><p>検索するか、地図をクリックするだけで登録を始められます。</p></header>
    {message && <p className="stay-admin-message" role="status">{message}<button onClick={() => setMessage("")} aria-label="通知を閉じる">×</button></p>}

    <section className="stay-admin-toolbar">
      <label><span>編集する宿</span><select value={selectedStayId} onChange={(event) => { setSelectedStayId(event.target.value); setSpotForm({ ...emptySpot, stay_id: event.target.value }); }}>{stays.map((stay) => <option key={stay.id} value={stay.id}>{stay.name}</option>)}</select></label>
      <button type="button" className="secondary" onClick={() => { setStayForm(emptyStay); setShowStayEditor((value) => !value); }}>＋ 宿を追加</button>
      {selectedStay && <a href={`/stay/${selectedStay.slug}`} target="_blank">公開MAPを見る ↗</a>}
    </section>

    {showStayEditor && <section className="stay-admin-panel stay-admin-stay-editor"><form className="stay-admin-form" onSubmit={saveStay}><h3>{stayForm.id ? "宿を編集" : "新しい宿"}</h3><label>宿名<input required value={stayForm.name} onChange={(e) => setStayForm({ ...stayForm, name: e.target.value })}/></label><label>slug<input required pattern="[a-z0-9][a-z0-9-]*" value={stayForm.slug} onChange={(e) => setStayForm({ ...stayForm, slug: e.target.value })}/></label><label>サブタイトル<input value={stayForm.subtitle || ""} onChange={(e) => setStayForm({ ...stayForm, subtitle: e.target.value })}/></label><label className="wide">説明<textarea rows={3} value={stayForm.description || ""} onChange={(e) => setStayForm({ ...stayForm, description: e.target.value })}/></label><label className="wide">メイン写真URL<input type="url" value={stayForm.image_url || ""} onChange={(e) => setStayForm({ ...stayForm, image_url: e.target.value })}/></label><label className="wide">住所<input value={stayForm.address || ""} onChange={(e) => setStayForm({ ...stayForm, address: e.target.value })}/></label><label>緯度<input type="number" step="any" value={stayForm.latitude} onChange={(e) => setStayForm({ ...stayForm, latitude: e.target.value })}/></label><label>経度<input type="number" step="any" value={stayForm.longitude} onChange={(e) => setStayForm({ ...stayForm, longitude: e.target.value })}/></label><label className="check"><input type="checkbox" checked={stayForm.is_published} onChange={(e) => setStayForm({ ...stayForm, is_published: e.target.checked })}/>公開する</label><div className="wide"><button disabled={saving}>宿を保存</button><button type="button" className="secondary" onClick={() => setShowStayEditor(false)}>閉じる</button></div></form></section>}

    <section className="stay-admin-workspace">
      <div className="stay-admin-map-column">
        <div className="stay-admin-map-search"><div><b>場所を検索</b><small>店名・施設名・住所から探せます</small></div><PlaceGeocodeSearch onPick={(place) => { setSpotForm((current: any) => ({ ...current, stay_id: current.stay_id || selectedStayId, name: place.name, latitude: String(place.lat), longitude: String(place.lng) })); setShowDetails(false); }}/></div>
        <div className="stay-admin-map-help"><strong>① 検索 または 地図をクリック</strong><span>→</span><strong>② 右のフォームを入力</strong><span>→</span><strong>③ 保存</strong></div>
        <StaySpotMapEditor spots={staySpots} value={mapValue} stayCenter={selectedStay?.latitude != null && selectedStay.longitude != null ? { latitude: selectedStay.latitude, longitude: selectedStay.longitude } : null} onPick={pickLocation} onSelect={(spot) => void editSpot(spot as SpotRow)} />
        <p className="stay-admin-map-caption">既存のピンを選ぶと編集できます。新しい位置はオレンジ色のピンをドラッグして微調整できます。</p>
      </div>

      <aside className="stay-admin-spot-editor" id="spot-editor">
        <div className="stay-admin-editor-heading"><div><span>{spotForm.id ? "EDIT SPOT" : "NEW SPOT"}</span><h2>{spotForm.id ? "スポットを編集" : "ここにスポットを追加"}</h2></div>{spotForm.id && <button type="button" onClick={() => startNewSpot()}>＋ 新規登録</button>}</div>
        {!mapValue && <div className="stay-admin-empty-selection"><b>← 地図で場所を選んでください</b><p>場所を検索するか、登録したい地点をクリックするとフォームが使えます。</p></div>}
        {mapValue && <form className="stay-admin-form stay-admin-spot-form" onSubmit={saveSpot}>
          <label className="wide">店名・スポット名<input autoFocus required value={spotForm.name} onChange={(e) => setSpotForm({ ...spotForm, name: e.target.value })} placeholder="例：港町コーヒー"/></label>
          <label className="wide">宿主からの一言<textarea required maxLength={1000} rows={4} value={spotForm.host_comment} onChange={(e) => setSpotForm({ ...spotForm, host_comment: e.target.value })} placeholder="宿主ならではのおすすめポイントを伝えましょう"/></label>
          <label className="wide">地元民からの一言<textarea maxLength={1000} rows={4} value={spotForm.local_comment} onChange={(e) => setSpotForm({ ...spotForm, local_comment: e.target.value })} placeholder="地元の方から聞いたおすすめポイントを伝えましょう"/></label>
          <fieldset className="wide stay-admin-categories"><legend>カテゴリー（複数選択可）</legend>{categories.map((cat) => {
            const selected = spotForm.category_ids.includes(cat.id);
            return <button type="button" className={selected ? "is-selected" : ""} aria-pressed={selected} key={cat.id} onClick={() => setSpotForm((current: typeof emptySpot) => ({ ...current, category_ids: current.category_ids.includes(cat.id) ? current.category_ids.filter((id) => id !== cat.id) : [...current.category_ids, cat.id] }))}><span aria-hidden="true">{selected ? "✓" : "＋"}</span>{cat.name}</button>;
          })}{categories.length === 0 && <p>カテゴリーを読み込めませんでした。データベースのマイグレーションを確認してください。</p>}</fieldset>
          <button type="button" className="stay-admin-detail-toggle wide" aria-expanded={showDetails} onClick={() => setShowDetails((value) => !value)}>{showDetails ? "詳細項目を閉じる −" : "写真・営業時間などを追加 ＋"}</button>
          {showDetails && <>{([['image_url','写真URL'],['google_maps_url','Google Maps URL'],['description','簡単な説明'],['distance_label','距離'],['walking_time','徒歩時間'],['driving_time','車の時間'],['business_hours','営業時間'],['closed_days','定休日'],['website_url','WebサイトURL'],['instagram_url','Instagram URL']] as const).map(([key,label]) => <label key={key}>{label}<input value={spotForm[key] || ""} onChange={(e) => setSpotForm({ ...spotForm, [key]: e.target.value })}/></label>)}<label>緯度<input required type="number" min="-90" max="90" step="any" value={spotForm.latitude} onChange={(e) => setSpotForm({ ...spotForm, latitude: e.target.value })}/></label><label>経度<input required type="number" min="-180" max="180" step="any" value={spotForm.longitude} onChange={(e) => setSpotForm({ ...spotForm, longitude: e.target.value })}/></label><label>並び順<input type="number" value={spotForm.sort_order} onChange={(e) => setSpotForm({ ...spotForm, sort_order: e.target.value })}/></label></>}
          <label className="check"><input type="checkbox" checked={spotForm.is_featured} onChange={(e) => setSpotForm({ ...spotForm, is_featured: e.target.checked })}/>★ 宿主おすすめ</label><label className="check"><input type="checkbox" checked={spotForm.is_published} onChange={(e) => setSpotForm({ ...spotForm, is_published: e.target.checked })}/>公開する</label>
          <div className="stay-admin-savebar wide"><button disabled={saving}>{saving ? "保存中…" : spotForm.id ? "変更を保存" : "このスポットを登録"}</button>{spotForm.id && <button type="button" className="danger" onClick={() => void removeSpot(spotForm.id)}>削除</button>}</div>
        </form>}
      </aside>
    </section>

    <section className="stay-admin-panel stay-admin-list"><div className="stay-admin-title"><div><h2>登録済みスポット</h2><p>{selectedStay?.name} · {staySpots.length}件</p></div><input type="search" placeholder="店名で検索" value={search} onChange={(e) => setSearch(e.target.value)}/></div><div className="stay-admin-table">{shownSpots.map((spot) => <article key={spot.id}><div><span>{spot.is_published ? "● 公開" : "○ 非公開"}</span><h3>{spot.name}</h3><p>{spot.address || `${spot.latitude}, ${spot.longitude}`}</p></div><button onClick={() => void editSpot(spot)}>地図で編集 →</button></article>)}</div></section>
  </main>;
}
function nullOrText(value: unknown) { const text = String(value ?? "").trim(); return text || null; }
function numberOrNull(value: unknown) { return value === "" || value == null ? null : Number(value); }
function validCoordinates(latitude: unknown, longitude: unknown) { const lat = Number(latitude); const lng = Number(longitude); return latitude !== "" && longitude !== "" && Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : null; }
