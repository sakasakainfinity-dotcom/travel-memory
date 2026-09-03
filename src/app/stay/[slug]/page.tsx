import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublishedStayMap } from "@/lib/server/stayMaps";
import StayMapClient from "./stay-map-client";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  try { return await getPublishedStayMap(slug); }
  catch (error) { console.error("[stay-map] load failed", error); return null; }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const stay = await load(params.slug);
  return { title: stay ? `${stay.name} おすすめMAP` : "宿専用おすすめMAP", description: stay?.description };
}

export default async function StayPage({ params }: { params: { slug: string } }) {
  const stay = await load(params.slug);
  if (!stay) notFound();
  return <StayMapClient stay={stay}/>;
}
