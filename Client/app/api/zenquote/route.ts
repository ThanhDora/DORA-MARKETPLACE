import { NextResponse } from "next/server";

type ZenQuoteItem = {
  q?: string;
  a?: string;
};

export const dynamic = "force-dynamic";

const ZENQUOTE_URL = "https://zenquotes.io/api/random";
const ZENQUOTE_TIMEOUT_MS = 6000;

function isUsableQuote(quote: string) {
  const normalized = quote.toLowerCase();
  return (
    quote.length > 0 &&
    !normalized.includes("too many requests") &&
    !normalized.includes("auth key") &&
    !normalized.includes("zenquotes.io")
  );
}

export async function GET() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ZENQUOTE_TIMEOUT_MS);

  try {
    const response = await fetch(ZENQUOTE_URL, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "DORA-MARKETPLACE/1.0",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      return NextResponse.json(
        { quote: null, author: null, cached: false },
        { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } },
      );
    }

    const payload = (await response.json()) as ZenQuoteItem[];
    const first = Array.isArray(payload) ? payload[0] : null;
    const quote = first?.q?.trim();
    const author = first?.a?.trim();

    if (!quote || !isUsableQuote(quote)) {
      return NextResponse.json(
        { quote: null, author: null, cached: false },
        { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } },
      );
    }

    return NextResponse.json(
      { quote, author: author || null, cached: false },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } },
    );
  } catch {
    return NextResponse.json(
      { quote: null, author: null, cached: false },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } },
    );
  } finally {
    clearTimeout(timeout);
  }
}
