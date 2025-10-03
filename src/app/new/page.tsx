"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import PlaceForm from "@/components/PlaceForm";
import MemoryForm from "@/components/MemoryForm";
import { ensureMySpace } from "@/lib/ensureMySpace";

export default function NewPage() {
  const sp = useSearchParams();
  const [spaceId, setSpaceId] = useState<string | null>(null);

  const initLat = sp.get("lat");
  const initLng = sp.get("lng");
  const initTitle = sp.get("title") ?? "";

  useEffect(() => {
    (async () => {
      const me = await ensureMySpace();
      if (me) setSpaceId(me.id);
    })();
  }, []);

  if (!spaceId) {
    return (
      <main style={{ display: "grid", placeItems: "center", height: "100vh" }}>
        <div>Loading…</div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
      <h1 style={{ margin: "8px 0 16px 0" }}>新しい場所とメモ</h1>

      <PlaceForm
        spaceId={spaceId}
        defaultLat={initLat ? Number(initLat) : undefined}
        defaultLng={initLng ? Number(initLng) : undefined}
        defaultTitle={initTitle || undefined}
      />

      <div style={{ height: 16 }} />

      <MemoryForm spaceId={spaceId} />
    </main>
  );
}

