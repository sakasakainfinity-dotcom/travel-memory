import type { Metadata } from "next";
import SpotPublicClient from "./spot-public-client";

export const metadata: Metadata = {
  title: "スポットまとめ",
  robots: { index: false, follow: false },
};

export default function SpotPublicPage({ params }: { params: { slug: string } }) {
  return <SpotPublicClient slug={params.slug} />;
}
