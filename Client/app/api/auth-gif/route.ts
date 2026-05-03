import { NextRequest, NextResponse } from "next/server";
import { getRandomAuthGif } from "@/lib/auth-gif";

export const dynamic = "force-dynamic";

function jsonResponse(payload: Awaited<ReturnType<typeof getRandomAuthGif>>) {
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export async function GET(request: NextRequest) {
  const payload = await getRandomAuthGif(request.nextUrl.searchParams.get("category"));
  return jsonResponse(payload);
}
