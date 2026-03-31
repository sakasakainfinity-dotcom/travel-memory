import "server-only";

import { getOptionalEnv, getRequiredEnv } from "@/lib/server/env";
import { TripPlanAIResult, TripPlanInput } from "@/lib/tripPlanTypes";

const OUTPUT_FORMAT = {
  plans: [
    {
      title: "しおりタイトル",
      concept: "旅コンセプト",
      recommendedFor: "こんな人向けの一言",
      estimatedCostMin: 15000,
      estimatedCostMax: 30000,
      days: [
        {
          dayNumber: 1,
          items: [
            {
              startTime: "09:30",
              endTime: "10:30",
              category: "breakfast",
              title: "朝食タイム",
              memo: "地元らしい朝食を楽しむ",
              address: "主要エリア名",
              estimatedCostMin: 1000,
              estimatedCostMax: 1800,
              candidateOptions: [
                { name: "候補1", feature: "一言特徴", address: "住所1", costMin: 800, costMax: 1500 },
                { name: "候補2", feature: "一言特徴", address: "住所2", costMin: 1000, costMax: 1800 },
                { name: "候補3", feature: "一言特徴", address: "住所3", costMin: 900, costMax: 1700 }
              ]
            }
          ]
        }
      ]
    }
  ]
};

function buildPrompt(input: TripPlanInput) {
  return `あなたは日本旅行のしおり作成アシスタントです。\n\n入力:\n${JSON.stringify(input, null, 2)}\n\n要件:\n- 旅のしおり案を2案作成する\n- 主役は「旅のしおり」。移動や観光だけでなく、食事・宿泊候補の情報密度を重視する\n- breakfast / lunch / dinner / hotel カテゴリの item には candidateOptions を原則3件入れる\n- candidateOptions の各要素には name, feature(一言特徴), costMin, costMax を可能な限り入れる\n- 候補が弱く3件が難しい場合は無理に埋めず、2件以下でも可\n- days は日帰りなら1日、宿泊なら泊数+1日を目安に作る\n- title / concept / recommendedFor を必ず書く\n- JSONのみ返す。説明文は禁止\n- スキーマは次に厳密準拠: ${JSON.stringify(OUTPUT_FORMAT)}`;
}

function coerceResult(raw: unknown): TripPlanAIResult {
  const plans = Array.isArray((raw as any)?.plans) ? (raw as any).plans : [];
  return {
    plans: plans.slice(0, 2).map((plan: any, idx: number) => ({
      title: String(plan?.title || `AIしおり案 ${idx + 1}`),
      concept: String(plan?.concept || "AIが作成した旅コンセプト"),
      recommendedFor: plan?.recommendedFor ? String(plan.recommendedFor) : undefined,
      estimatedCostMin: typeof plan?.estimatedCostMin === "number" ? plan.estimatedCostMin : undefined,
      estimatedCostMax: typeof plan?.estimatedCostMax === "number" ? plan.estimatedCostMax : undefined,
      days: Array.isArray(plan?.days)
        ? plan.days.map((day: any, dayIndex: number) => ({
            dayNumber: typeof day?.dayNumber === "number" ? day.dayNumber : dayIndex + 1,
            items: Array.isArray(day?.items)
              ? day.items.map((item: any) => ({
                  startTime: item?.startTime ? String(item.startTime) : undefined,
                  endTime: item?.endTime ? String(item.endTime) : undefined,
                  category: item?.category ? String(item.category) : undefined,
                  title: String(item?.title || "立ち寄り候補"),
                  memo: item?.memo ? String(item.memo) : undefined,
                  address: item?.address ? String(item.address) : undefined,
                  estimatedCostMin: typeof item?.estimatedCostMin === "number" ? item.estimatedCostMin : undefined,
                  estimatedCostMax: typeof item?.estimatedCostMax === "number" ? item.estimatedCostMax : undefined,
                  candidateOptions: Array.isArray(item?.candidateOptions)
                    ? item.candidateOptions.slice(0, 6).map((c: any) => ({
                        name: String(c?.name || "候補"),
                        feature: c?.feature ? String(c.feature) : undefined,
                        address: c?.address ? String(c.address) : undefined,
                        costMin: typeof c?.costMin === "number" ? c.costMin : undefined,
                        costMax: typeof c?.costMax === "number" ? c.costMax : undefined,
                      }))
                    : undefined,
                }))
              : [],
          }))
        : [],
    })),
  };
}

async function generateWithOpenAI(input: TripPlanInput): Promise<TripPlanAIResult> {
  const apiKey = getRequiredEnv("OPENAI_API_KEY");
  const model = getOptionalEnv("TRIP_PLAN_AI_MODEL") || "gpt-4o-mini";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "旅行しおりをJSONで生成するアシスタント。必ずJSONのみ返答する。" },
        { role: "user", content: buildPrompt(input) },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status}`);
  }

  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("AI response content missing");
  }

  const parsed = JSON.parse(content);
  return coerceResult(parsed);
}

export async function generateTripPlan(input: TripPlanInput): Promise<{ provider: string; model: string; result: TripPlanAIResult }> {
  const provider = (getOptionalEnv("TRIP_PLAN_AI_PROVIDER") || "openai").toLowerCase();

  if (provider !== "openai") {
    throw new Error(`Unsupported provider: ${provider}. Set TRIP_PLAN_AI_PROVIDER=openai`);
  }

  const model = getOptionalEnv("TRIP_PLAN_AI_MODEL") || "gpt-4o-mini";
  const result = await generateWithOpenAI(input);
  return { provider, model, result };
}
