import { NextResponse } from "next/server";

const TELEGRAM_BOT_URL = process.env.TELEGRAM_BOT_URL;

/**
 * Server-side API route for Telegram bot requests
 * This keeps TELEGRAM_BOT_URL secret (not exposed to client)
 */
export async function POST(req) {
  try {
    const {
      endpoint,
      chat_id,
      chat_id1,
      message,
      disablePreview = true,
    } = await req.json();

    // endpoint can be empty string for AWS API Gateway URLs that are already complete
    if (endpoint === undefined || endpoint === null) {
      return NextResponse.json(
        { error: "Missing endpoint" },
        { status: 400 }
      );
    }

    if (!TELEGRAM_BOT_URL) {
      console.error("TELEGRAM_BOT_URL is not configured");
      return NextResponse.json(
        { error: "Telegram bot not configured" },
        { status: 500 }
      );
    }

    const data = {
      chat_id: chat_id,
      message: message,
    };

    if (disablePreview) {
      data.disable_web_page_preview = true;
      data.link_preview_options = { is_disabled: true };
    }

    // Add chat_id1 for shisha endpoint
    if (chat_id1) {
      data.chat_id1 = chat_id1;
    }

    const response = await fetch(`${TELEGRAM_BOT_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Telegram bot error: ${response.status}`, errorText);
      return NextResponse.json(
        { error: "Telegram bot request failed", details: errorText },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Error sending to Telegram bot:", error);
    return NextResponse.json(
      { error: "Failed to send request", message: error.message },
      { status: 500 }
    );
  }
}
