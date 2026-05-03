import { NextRequest, NextResponse } from "next/server";

type GiphyImage = {
  url?: string;
};

type GiphyItem = {
  title?: string;
  images?: {
    original?: GiphyImage;
    fixed_height?: GiphyImage;
    downsized_medium?: GiphyImage;
  };
};

type GiphyResponse = {
  data?: GiphyItem[];
};

type OrderGifPayload = {
  gifUrl: string | null;
  stillUrl: string | null;
  title: string;
  source: "giphy" | "fallback";
  fetchedAt: number;
};

export const dynamic = "force-dynamic";

const GIPHY_SEARCH_URL = "https://api.giphy.com/v1/gifs/search";
const GIF_TIMEOUT_MS = 5000;
const GIF_CACHE_TTL_MS = 10 * 60 * 1000;

const searchByStatus: Record<string, string> = {
  DELIVERED: "digital delivery success package",
  DELIVERING: "secure digital download",
  PAID: "online payment success",
  PENDING: "order processing",
};

const cache = new Map<string, OrderGifPayload>();

function fallbackPayload(status: string): OrderGifPayload {
  return {
    gifUrl: null,
    stillUrl: null,
    title: status === "DELIVERED" ? "Delivery complete" : "Order delivery",
    source: "fallback",
    fetchedAt: Date.now(),
  };
}

function pickGif(items: GiphyItem[]) {
  return items.find((item) => {
    const url = item.images?.fixed_height?.url || item.images?.downsized_medium?.url || item.images?.original?.url;
    return typeof url === "string" && url.startsWith("https://");
  });
}

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status")?.toUpperCase() || "PAID";
  const query = searchByStatus[status] ?? "digital product delivery";
  const cacheKey = status;
  const cached = cache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.fetchedAt < GIF_CACHE_TTL_MS) {
    return NextResponse.json({ ...cached, cached: true });
  }

  const apiKey = process.env.GIPHY_API_KEY || process.env.NEXT_PUBLIC_GIPHY_API_KEY;
  if (!apiKey) {
    const fallback = fallbackPayload(status);
    cache.set(cacheKey, fallback);
    return NextResponse.json({ ...fallback, cached: false });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GIF_TIMEOUT_MS);

  try {
    const url = new URL(GIPHY_SEARCH_URL);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "8");
    url.searchParams.set("rating", "g");
    url.searchParams.set("lang", "vi");

    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "DORA-MARKETPLACE/1.0",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const fallback = fallbackPayload(status);
      cache.set(cacheKey, fallback);
      return NextResponse.json({ ...fallback, cached: false }, { status: 200 });
    }

    const payload = (await response.json()) as GiphyResponse;
    const picked = pickGif(Array.isArray(payload.data) ? payload.data : []);
    const gifUrl = picked?.images?.fixed_height?.url || picked?.images?.downsized_medium?.url || picked?.images?.original?.url || null;

    const result: OrderGifPayload = gifUrl
      ? {
          gifUrl,
          stillUrl: picked?.images?.downsized_medium?.url || gifUrl,
          title: picked?.title?.trim() || "Order delivery animation",
          source: "giphy",
          fetchedAt: now,
        }
      : fallbackPayload(status);

    cache.set(cacheKey, result);
    return NextResponse.json({ ...result, cached: false });
  } catch {
    const fallback = fallbackPayload(status);
    cache.set(cacheKey, fallback);
    return NextResponse.json({ ...fallback, cached: false }, { status: 200 });
  } finally {
    clearTimeout(timeout);
  }
}
