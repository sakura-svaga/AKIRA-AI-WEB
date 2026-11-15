
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const effortLevels = [
  "minimal",
  "low",
  "low",
  "medium",
  "medium",
  "high",
  "high",
  "high",
];

export async function POST(req: NextRequest) {
  const authorization = req.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "API-ключ отсутствует" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();

    if (!body.model || !Array.isArray(body.messages)) {
      return NextResponse.json(
        { error: "Неверный формат запроса" },
        { status: 400 }
      );
    }

    const level = Math.max(0, Math.min(7, Number(body.level) || 0));

    const response = await fetch(
      "https://tokenwave.ru/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: body.model,
          messages: body.messages,
          stream: true,
          reasoning_effort: effortLevels[level],
        }),
        signal: AbortSignal.timeout(55000),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: error.slice(0, 1500) || "Ошибка модели" },
        { status: response.status }
      );
    }

    if (!response.body) {
      return NextResponse.json(
        { error: "Модель не вернула поток" },
        { status: 502 }
      );
    }

    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Ошибка обработки запроса" },
      { status: 500 }
    );
  }
}
