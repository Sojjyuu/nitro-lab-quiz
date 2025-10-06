import { NextRequest, NextResponse } from "next/server";
import { buildApiUrl } from "@/app/lib/api/config";

interface LikePayload {
  statusId?: string;
  action?: "like" | "unlike";
}

// à¸Ÿà¸±à¸‡à¸à¹Œà¸Šà¸±à¸™ parse JSON à¸›à¸¥à¸­à¸”à¸ à¸±à¸¢
function parseJsonSafely<T>(text: string): T | string | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text;
  }
}

// à¸Ÿà¸±à¸‡à¸à¹Œà¸Šà¸±à¸™à¸¢à¸´à¸‡ request à¹„à¸›à¸¢à¸±à¸‡ API à¸ˆà¸£à¸´à¸‡
async function forwardLike({
  endpoint,
  method,
  authorization,
  apiKey,
  body,
}: {
  endpoint: string;
  method: "POST" | "DELETE";
  authorization: string;
  apiKey: string;
  body: string;
}) {
  return fetch(buildApiUrl(endpoint), {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: authorization,
      "x-api-key": apiKey,
    },
    body,
    cache: "no-store",
  });
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.CIS_API_KEY;
  if (!apiKey) {
    console.error("Missing CIS_API_KEY");
    return NextResponse.json({ message: "Server missing API key" }, { status: 500 });
  }

  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return NextResponse.json({ message: "Missing authorization header" }, { status: 401 });
  }

  let payload: LikePayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const statusId = payload.statusId?.trim();
  if (!statusId) {
    return NextResponse.json({ message: "statusId is required" }, { status: 400 });
  }

  const action = payload.action === "unlike" ? "unlike" : "like";
  const method: "POST" | "DELETE" = action === "unlike" ? "DELETE" : "POST";
  const forwardedBody = JSON.stringify({ statusId });
  const encodedId = encodeURIComponent(statusId);

  // ðŸ” fallback endpoint à¸«à¸¥à¸²à¸¢à¹à¸šà¸š
  const candidateEndpoints =
    action === "like"
      ? [
          `/status/like`,
          `/like`,
          `/status/${encodedId}/like`,
          `/status/like/${encodedId}`,
          `/status/${encodedId}/likes`,
        ]
      : [
          `/status/unlike`,
          `/unlike`,
          `/status/${encodedId}/unlike`,
          `/status/unlike/${encodedId}`,
          `/status/${encodedId}/likes/delete`,
        ];

  for (const endpoint of candidateEndpoints) {
    try {
      const upstream = await forwardLike({
        endpoint,
        method,
        authorization,
        apiKey,
        body: forwardedBody,
      });

      const raw = await upstream.text();
      const parsed = parseJsonSafely(raw);

      if (upstream.ok) {
        return NextResponse.json(
          typeof parsed === "string" ? { message: parsed } : parsed,
          { status: upstream.status }
        );
      }

      // à¸–à¹‰à¸²à¹€à¸ˆà¸­ endpoint à¸—à¸µà¹ˆà¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆ 404,405 à¹ƒà¸«à¹‰à¸«à¸¢à¸¸à¸”à¹€à¸¥à¸¢
      if (![404, 405, 501].includes(upstream.status)) {
        return NextResponse.json(
          typeof parsed === "string" ? { message: parsed } : parsed,
          { status: upstream.status }
        );
      }
    } catch (error) {
      console.error("[classroom/like] network error", error);
      return NextResponse.json({ message: "Network error" }, { status: 502 });
    }
  }

  return NextResponse.json(
    { message: `All ${action} endpoints failed` },
    { status: 502 }
  );
}
