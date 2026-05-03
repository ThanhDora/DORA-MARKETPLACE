import { NextRequest, NextResponse } from "next/server";

type NekosBestResult = {
  anime_name?: string;
  dimensions?: {
    width?: number;
    height?: number;
  };
  url?: string;
};

type NekosBestResponse = {
  results?: NekosBestResult[];
};

type AdminGifPayload = {
  gifUrl: string | null;
  title: string;
  category: string;
  source: "nekos.best" | "fallback";
  fetchedAt: number;
  width?: number | null;
  height?: number | null;
};

export const dynamic = "force-dynamic";

const NEKOS_BEST_BASE_URL = "https://nekos.best/api/v2";
const GIF_TIMEOUT_MS = 5000;
const GIF_CACHE_TTL_MS = 7 * 60 * 1000;
const USER_AGENT = "DORA-MARKETPLACE/1.0 (https://dora-marketplace.local)";

const GIF_CATEGORIES = [
  "angry",
  "baka",
  "bite",
  "blush",
  "bonk",
  "carry",
  "clap",
  "confused",
  "cry",
  "cuddle",
  "happy",
  "wave",
  "wink",
  "dance",
  "facepalm",
  "feed",
  "handshake",
  "highfive",
  "hug",
  "kick",
  "kiss",
  "laugh",
  "nod",
  "pat",
  "poke",
  "punch",
  "run",
  "salute",
  "shake",
  "shoot",
  "shrug",
  "sip",
  "sleep",
  "thumbsup",
  "smile",
  "stare",
  "think",
  "tickle",
  "yawn",
  "yeet",
] as const;

const cache = new Map<string, AdminGifPayload>();

function pickCategory(input: string | null) {
  if (input && GIF_CATEGORIES.includes(input.toLowerCase() as (typeof GIF_CATEGORIES)[number])) {
    return input.toLowerCase();
  }

  return GIF_CATEGORIES[Math.floor(Math.random() * GIF_CATEGORIES.length)];
}

function fallbackPayload(category: string): AdminGifPayload {
  return {
    gifUrl: null,
    title: "Admin companion",
    category,
    source: "fallback",
    fetchedAt: Date.now(),
    width: null,
    height: null,
  };
}

function isHttpsGif(url: unknown) {
  if (typeof url !== "string") return false;

  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.pathname.endsWith(".gif");
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const category = pickCategory(request.nextUrl.searchParams.get("category"));
  const shouldRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  const now = Date.now();
  const cached = cache.get(category);

  if (!shouldRefresh && cached && now - cached.fetchedAt < GIF_CACHE_TTL_MS) {
    return NextResponse.json({ ...cached, cached: true });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GIF_TIMEOUT_MS);

  try {
    const url = new URL(`${NEKOS_BEST_BASE_URL}/${category}`);
    url.searchParams.set("amount", "1");

    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const fallback = fallbackPayload(category);
      return NextResponse.json({ ...fallback, cached: false }, { status: 200 });
    }

    const payload = (await response.json()) as NekosBestResponse;
    const first = Array.isArray(payload.results) ? payload.results.find((item) => isHttpsGif(item.url)) : null;
    const result: AdminGifPayload = first?.url
      ? {
          gifUrl: first.url,
          title: first.anime_name?.trim() || `${category} anime GIF`,
          category,
          source: "nekos.best",
          fetchedAt: now,
          width: first.dimensions?.width ?? null,
          height: first.dimensions?.height ?? null,
        }
      : fallbackPayload(category);

    if (result.gifUrl) {
      cache.set(category, result);
    }

    return NextResponse.json({ ...result, cached: false });
  } catch {
    const fallback = fallbackPayload(category);
    return NextResponse.json({ ...fallback, cached: false }, { status: 200 });
  } finally {
    clearTimeout(timeout);
  }
}
