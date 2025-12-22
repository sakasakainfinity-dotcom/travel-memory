"use client";

import { useRouter } from "next/navigation";
import BackToMapButton from "@/components/BackToMapButton";
export default function PilgrimageHome() {
  const router = useRouter();

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">巡礼マップ</h1>

      <button
        className="w-full rounded-xl bg-black text-white py-3 font-semibold"
        onClick={() => router.push("/pilgrimage/jp-world-heritage")}
      >
        日本の世界遺産巡礼マップ
      </button>

      <p className="text-sm text-neutral-600">
        ピンを塗りつぶしていくやつ。ちゃんと埋めんさいよ。
      </p>
    </div>
  );
}
