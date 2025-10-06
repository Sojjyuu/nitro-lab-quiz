import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://cis.kku.ac.th/api/classroom";
const API_KEY = process.env.CLASSROOM_API_KEY;

type SignInBody = {
  email: string;
  password: string;
};

type SignInSuccess = {
  data: unknown;
};

type SignInError = {
  error?: string;
  message?: string;
};

export async function POST(request: Request) {
  if (!API_KEY) {
    return NextResponse.json(
      { error: "Server missing CLASSROOM_API_KEY environment variable" },
      { status: 500 }
    );
  }

  let payload: SignInBody;

  try {
    payload = (await request.json()) as SignInBody;
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const response = await fetch(`${API_BASE}/signin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const text = await response.text();
    const data = text ? (JSON.parse(text) as SignInSuccess | SignInError) : null;

    if (!response.ok) {
      return NextResponse.json(
        data ?? { error: "Sign in failed" },
        { status: response.status || 500 }
      );
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: "Unable to reach sign-in service" }, { status: 502 });
  }
}