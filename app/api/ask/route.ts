import { NextResponse } from "next/server";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { question } = await req.json();

    const response = await fetch(
      `${process.env.PMC_BACKEND_URL}/ask`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question }),
      }
    );

    const data = await response.json();

    return NextResponse.json({
      intent: data.intent,
      answer: data.answer,
    });

  } catch (err) {
    return NextResponse.json(
      {
        intent: "ERROR",
        answer: "Failed to get response from backend",
      },
      { status: 500 }
    );
  }
}
