
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const key = req.headers.get("authorization");

  if (!key?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "API-ключ не указан" },
      { status: 401 }
    );
  }

  try {
    const response = await fetch("https://tokenwave.ru/v1/models", {
      headers: { Authorization: key },
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error?.message || "TokenWave отклонил запрос" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Не удалось подключиться к TokenWave" },
      { status: 502 }
    );
  }
}
