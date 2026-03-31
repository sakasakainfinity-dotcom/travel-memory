import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";

export default async function SharePlanPage({ params }: { params: { token: string } }) {
  const supabase = getSupabaseAdmin();
  const token = (params.token ?? "").trim();
  if (!token) notFound();

  const { data: plan } = await supabase
    .from("trip_plans")
    .select("id,title,description,estimated_cost_min,estimated_cost_max,visibility")
    .eq("share_token", token)
    .eq("visibility", "public")
    .single();

  if (!plan) notFound();

  const { data: stops } = await supabase
    .from("trip_plan_stops")
    .select("day_number,start_time,category,title,memo,candidate_options,photo_url")
    .eq("plan_id", plan.id)
    .order("day_number")
    .order("sort_order");

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "16px 12px 100px" }}>
      <h1 style={{ fontWeight: 900, fontSize: 24 }}>{plan.title}</h1>
      <p style={{ color: "#475569", whiteSpace: "pre-wrap" }}>{plan.description}</p>
      <p style={{ fontSize: 13 }}>予算目安: {plan.estimated_cost_min ?? "-"}〜{plan.estimated_cost_max ?? "-"}円</p>
      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
        {(stops ?? []).map((stop: any, i: number) => (
          <article key={i} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 10 }}>
            <div style={{ fontSize: 12, color: "#64748b" }}>Day{stop.day_number} {stop.start_time ?? "--:--"} / {stop.category ?? "spot"}</div>
            <div style={{ fontWeight: 800 }}>{stop.title}</div>
            {stop.memo ? <div style={{ fontSize: 13 }}>{stop.memo}</div> : null}
            {stop.candidate_options?.length ? (
              <ul style={{ fontSize: 12 }}>
                {stop.candidate_options.slice(0, 2).map((opt: any, idx: number) => <li key={idx}>{opt.name}</li>)}
              </ul>
            ) : null}
            {stop.photo_url ? <img src={stop.photo_url} alt="旅写真" style={{ width: "100%", maxWidth: 240, borderRadius: 10 }} /> : null}
          </article>
        ))}
      </div>
    </main>
  );
}
