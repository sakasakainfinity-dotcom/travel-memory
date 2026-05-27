import "server-only";

import { getOptionalEnv, getRequiredEnv } from "@/lib/server/env";

type Input = {
  lat: number;
  lng: number;
  title?: string;
  memo?: string;
  address?: string;
};

export async function enrichWishlist(input: Input): Promise<{ ai_summary: string; ai_tips: string }> {
  const apiKey = getRequiredEnv("OPENAI_API_KEY");
  const model = getOptionalEnv("WISHLIST_AI_MODEL") || "gpt-4o-mini";

  const prompt = `次の場所情報から、断定を避けた提案文を作ってください。\n${JSON.stringify(input, null, 2)}\n\nJSONのみで返答してください。\n{"ai_summary":"2-4行","ai_tips":"おすすめの楽しみ方"}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "あなたは旅行先提案の補助アシスタントです。推測ベースで柔らかい文体を使い、断定しない。日本語。",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) throw new Error(`OpenAI request failed: ${response.status}`);
  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") throw new Error("AI response missing");
  const parsed = JSON.parse(content);

  return {
    ai_summary: String(parsed?.ai_summary || "").trim(),
    ai_tips: String(parsed?.ai_tips || "").trim(),
  };
}
