import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://cis.kku.ac.th/api/classroom";
const API_KEY = process.env.CLASSROOM_API_KEY;

type ProfileSuccess = {
  data: unknown;
};

type ProfileError = {
  error?: string;
  message?: string;
};

export async function GET(request: NextRequest) {
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

  try {
    const upstream = await fetch(`${API_BASE}/profile`, {
      headers: {
        Authorization: authHeader,
        "x-api-key": API_KEY,
      },
      cache: "no-store",
    });

    const text = await upstream.text();
    const data = text ? (JSON.parse(text) as ProfileSuccess | ProfileError) : null;

    if (!upstream.ok) {
      return NextResponse.json(
        data ?? { error: "Unable to load profile" },
        { status: upstream.status || 500 }
      );
    }

    return NextResponse.json(data, { status: upstream.status });
  } catch (error) {
    return NextResponse.json({ error: "Unable to reach profile service" }, { status: 502 });
  }
}