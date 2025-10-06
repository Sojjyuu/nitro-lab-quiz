import { NextRequest, NextResponse } from "next/server";
import { buildApiUrl } from "@/app/lib/api/config";

interface LikePayload {
  statusId?: string;
  action?: "like" | "unlike";
}

// ฟังก์ชัน parse JSON ปลอดภัย
function parseJsonSafely<T>(text: string): T | string | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text;
  }
}

// ฟังก์ชันส่ง request ไปยัง API จริง
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
  body?: string; // ทำให้ body เป็น optional สำหรับ DELETE ที่มี ID ใน path
}) {
  const fetchOptions: RequestInit = {
    method,
    headers: {
      Accept: "application/json",
      Authorization: authorization,
      "x-api-key": apiKey,
    },
    cache: "no-store",
  };

  // สำหรับ DELETE ที่มี ID ใน path ไม่ส่ง body และ Content-Type
  if (body) {
    fetchOptions.headers = {
      ...fetchOptions.headers,
      "Content-Type": "application/json",
    };
    fetchOptions.body = body;
  }

  return fetch(buildApiUrl(endpoint), fetchOptions);
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
  const encodedId = encodeURIComponent(statusId);

  // 🔁 fallback endpoint หลายแบบ
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
          // ปรับ endpoints สำหรับ unlike ให้ครอบคลุมมากขึ้น โดยใช้ DELETE สำหรับ remove like
          // และ POST สำหรับบาง API ที่ใช้ action=unlike
          `/status/${encodedId}/like`, // DELETE to remove like
          `/status/${encodedId}/likes`, // DELETE to remove like
          `/status/unlike`,
          `/unlike`,
          `/status/${encodedId}/unlike`,
          `/status/unlike/${encodedId}`,
          // เพิ่มตัวเลือก POST สำหรับ unlike ถ้า API ใช้ POST แทน DELETE
          `/status/${encodedId}/toggle`, // บาง API ใช้ toggle กับ action ใน body
        ];

  for (const endpoint of candidateEndpoints) {
    // ถ้าเป็น POST หรือ endpoint ไม่มี ID ใน path ให้ส่ง body
    // สำหรับ DELETE ที่มี ID ใน path ไม่ส่ง body เพื่อความเข้ากันได้
    const useBody = method === "POST" || !endpoint.includes(encodedId);
    let forwardedBody: string | undefined;
    if (useBody) {
      if (action === "unlike" && endpoint.includes("/toggle")) {
        // สำหรับ toggle endpoint ส่ง action ใน body
        forwardedBody = JSON.stringify({ statusId, action: "unlike" });
      } else {
        forwardedBody = JSON.stringify({ statusId });
      }
    }

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

      // ถ้า endpoint ที่ไม่ใช่ 404,405,501 ให้ return ทันที
      if (![404, 405, 501].includes(upstream.status)) {
        return NextResponse.json(
          typeof parsed === "string" ? { message: parsed } : parsed,
          { status: upstream.status }
        );
      }
    } catch (error) {
      console.error("[classroom/like] network error", error);
      // ไม่ return error ทันที แต่ลอง endpoint ถัดไป
    }
  }

  return NextResponse.json(
    { message: `All ${action} endpoints failed` },
    { status: 502 }
  );
}