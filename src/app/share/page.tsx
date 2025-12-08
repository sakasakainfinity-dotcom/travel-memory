"use client";

import { useEffect, useState } from "react";

export default function SharePage() {
  const [shareUrl, setShareUrl] = useState("");
  const [canWebShare, setCanWebShare] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(window.location.origin); // アプリURL
      setCanWebShare(typeof navigator !== "undefined" && !!navigator.share);
    }
  }, []);

  const title = "TripMemory - 旅の思い出を地図に残そう";
  const text = "TripMemoryで旅の軌跡を地図に残して、家族やパートナーと共有しよう📍";

  async function handleShare(target: "x" | "line" | "instagram" | "threads" | "copy") {
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(text);

    try {
      // Instagram / Threads はまず Web Share API を試す
      if (canWebShare && (target === "instagram" || target === "threads")) {
        await navigator.share({
          title,
          text,
          url: shareUrl,
        });
        return;
      }

      switch (target) {
        case "x": {
          const url = `https://twitter.com/intent/tweet?u

