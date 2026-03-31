import { NextResponse } from "next/server";
import { generateTripPlan } from "@/lib/ai/tripPlan";
import { TripPlanInput } from "@/lib/tripPlanTypes";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const input = (await req.json()) as TripPlanInput;
    if (!input?.tripLengthType || !input?.visibility) {
      return NextResponse.json({ error: "tripLengthType and visibility are required" }, { status: 400 });
    }

    const generated = await generateTripPlan(input);
    if (!generated.result.plans.length) {
      return NextResponse.json({ error: "AI result was empty" }, { status: 422 });
    }

    return NextResponse.json(generated);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "failed to generate plans" }, { status: 500 });
  }
}
