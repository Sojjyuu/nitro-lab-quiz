import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://cis.kku.ac.th/api/classroom";
const API_KEY = process.env.CLASSROOM_API_KEY;

type CommentSuccess = {
  data: unknown;
};

type CommentError = {
  error?: string;
  message?: string;
};

export async function POST(request: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json(
      { error: "Server missing CLASSROOM_API_KEY environment variable" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${API_BASE}/comment`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const text = await upstream.text();
    const data = text ? (JSON.parse(text) as CommentSuccess | CommentError) : null;

    if (!upstream.ok) {
      return NextResponse.json(
        data ?? { error: "Unable to create comment" },
        { status: upstream.status || 500 }
      );
    }

    return NextResponse.json(data, { status: upstream.status });
  } catch (error) {
    return NextResponse.json({ error: "Unable to reach comment service" }, { status: 502 });
  }
}