"use client";

import { useEffect, useState, type SyntheticEvent } from "react";

type NekoGifResponse = {
  results?: Array<{
    url?: string;
  }>;
};

const LOADING_GIF_ACTIONS = ["happy", "dance", "wave", "smile", "spin", "wink"] as const;
const DEFAULT_LOADING_IMAGE = "/logo.jpg";

function preloadImage(src: string) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(src);
    image.onerror = reject;
    image.src = src;
  });
}

export default function Loading() {
  const [gifUrl, setGifUrl] = useState<string | null>(null);

  function handleImageError(event: SyntheticEvent<HTMLImageElement>) {
    const image = event.currentTarget;
    if (image.src.endsWith(DEFAULT_LOADING_IMAGE)) return;
    image.src = DEFAULT_LOADING_IMAGE;
  }

  useEffect(() => {
    let isMounted = true;

    async function loadGif() {
      try {
        const action = LOADING_GIF_ACTIONS[Math.floor(Math.random() * LOADING_GIF_ACTIONS.length)];
        const response = await fetch(`https://nekos.best/api/v2/${action}?amount=12`, { cache: "no-store" });
        if (!response.ok) return;

        const payload = (await response.json()) as NekoGifResponse;
        const candidates = (payload.results ?? [])
          .map((item) => item.url)
          .filter((url): url is string => typeof url === "string" && url.toLowerCase().endsWith(".gif"));
        
        const selected = candidates[Math.floor(Math.random() * candidates.length)];
        if (!selected) return;

        const readyGif = await preloadImage(selected);
        if (isMounted) setGifUrl(readyGif);
      } catch {
        // Fallback to static branded logo
      }
    }

    loadGif();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="page-loading">
      <section className="page-loading__section page-loading__section--minimal" role="status" aria-live="polite">
        <span className="page-loading__mark" aria-hidden="true">
          {gifUrl ? (
            <img src={gifUrl} alt="Loading..." className="transition-opacity duration-medium" onError={handleImageError} />
          ) : (
            <img src={DEFAULT_LOADING_IMAGE} alt="DORA MARKETPLACE" className="animate-pulse" onError={handleImageError} />
          )}
        </span>
        <p className="page-loading__title">Đang tải marketplace</p>
        <span className="page-loading__bar" aria-hidden="true">
          <span />
        </span>
      </section>
    </main>
  );
}
