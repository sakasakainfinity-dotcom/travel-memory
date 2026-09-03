import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublishedStayMap } from "@/lib/server/stayMaps";
import type { StayMap } from "@/lib/stayMaps";
import StayMapClient from "./stay-map-client";

export const dynamic = "force-dynamic";

const motomachiGuidebook: StayMap = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "まちやど Motomachi",
  slug: "motomachi",
  subtitle: "宿主おすすめ 大子町MAP",
  description: "ごはん、観光、買い物など、まちやど宿主がおすすめする場所をまとめました。",
  image_url: "/motomachi.jpg",
  address: "茨城県久慈郡大子町",
  latitude: 36.7681,
  longitude: 140.3507,
  spots: [],
};

async function load(slug: string) {
  try {
    const stay = await getPublishedStayMap(slug);
    return stay ?? (slug === motomachiGuidebook.slug ? motomachiGuidebook : null);
  } catch (error) {
    console.error("[stay-map] load failed", error);
    return slug === motomachiGuidebook.slug ? motomachiGuidebook : null;
  }
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
