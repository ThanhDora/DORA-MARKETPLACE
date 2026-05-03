export type AuthGifPayload = {
  gifUrl: string | null;
  title: string;
  category: string;
  source: "nekos.best" | "fallback";
  fetchedAt: number;
  width?: number | null;
  height?: number | null;
};

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

const NEKOS_BEST_BASE_URL = "https://nekos.best/api/v2";
const GIF_TIMEOUT_MS = 3500;
const USER_AGENT = "DORA-MARKETPLACE/1.0 (https://dora-marketplace.local)";
export const AUTH_GIF_FALLBACK_IMAGE = "/logo.jpg";
export const AUTH_GIF_CACHE_KEY = "dora-auth-gif-cache";

const AUTH_GIF_CATEGORIES = [
  "bleh",
  "blowkiss",
  "blush",
  "bonk",
  "bored",
  "carry",
  "clap",
  "confused",
  "cry",
  "cuddle",
  "dance",
  "facepalm",
  "feed",
  "handhold",
  "handshake",
  "happy",
  "highfive",
  "hug",
  "kabedon",
  "kiss",
  "lappillow",
  "laugh",
  "lurk",
  "nod",
  "nom",
  "nope",
  "nya",
  "pat",
  "peck",
  "poke",
  "pout",
  "run",
  "salute",
  "shake",
  "shocked",
  "shrug",
  "sip",
  "sleep",
  "smile",
  "smug",
  "spin",
  "stare",
  "teehee",
  "think",
  "thumbsup",
  "tickle",
  "wag",
  "wave",
  "wink",
  "yawn",
  "yeet",
] as const;

function readCategory(input: string | null) {
  if (input && AUTH_GIF_CATEGORIES.includes(input.toLowerCase() as (typeof AUTH_GIF_CATEGORIES)[number])) {
    return input.toLowerCase();
  }

  return null;
}

function pickCategory(input: string | null) {
  const explicitCategory = readCategory(input);
  if (explicitCategory) {
    return explicitCategory;
  }

  return AUTH_GIF_CATEGORIES[Math.floor(Math.random() * AUTH_GIF_CATEGORIES.length)];
}

export function fallbackAuthGif(category = "fallback"): AuthGifPayload {
  return {
    gifUrl: AUTH_GIF_FALLBACK_IMAGE,
    title: "DORA MARKETPLACE",
    category,
    source: "fallback",
    fetchedAt: Date.now(),
    width: 498,
    height: 280,
  };
}

export function isValidAuthGifPayload(value: unknown): value is AuthGifPayload {
  return Boolean(
    value &&
      typeof value === "object" &&
      "gifUrl" in value &&
      typeof value.gifUrl === "string" &&
      "title" in value &&
      typeof value.title === "string" &&
      "category" in value &&
      typeof value.category === "string" &&
      "source" in value &&
      (value.source === "nekos.best" || value.source === "fallback") &&
      "fetchedAt" in value &&
      typeof value.fetchedAt === "number",
  );
}

export function serializeAuthGifPayload(payload: AuthGifPayload) {
  return encodeURIComponent(JSON.stringify(payload));
}

export function parseAuthGifPayload(raw: string | null | undefined) {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    return isValidAuthGifPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
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

export async function getRandomAuthGif(categoryInput?: string | null) {
  const category = pickCategory(categoryInput ?? null);
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
      return fallbackAuthGif(category);
    }

    const payload = (await response.json()) as NekosBestResponse;
    const first = Array.isArray(payload.results) ? payload.results.find((item) => isHttpsGif(item.url)) : null;

    return first?.url
      ? {
          gifUrl: first.url,
          title: first.anime_name?.trim() || `${category} anime GIF`,
          category,
          source: "nekos.best" as const,
          fetchedAt: Date.now(),
          width: first.dimensions?.width ?? 498,
          height: first.dimensions?.height ?? 280,
        }
      : fallbackAuthGif(category);
  } catch {
    return fallbackAuthGif(category);
  } finally {
    clearTimeout(timeout);
  }
}
