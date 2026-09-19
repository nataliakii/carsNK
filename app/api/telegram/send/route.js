import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { sendTelegramDirect } from "@/lib/telegram/sendDirect";

/**
 * Admin-only Telegram send. Public callers get 403.
 * Never forwards a client-chosen endpoint to TELEGRAM_BOT_URL.
 */
export async function POST(req) {
  const { errorResponse } = await requireAdmin(req);
  if (errorResponse) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const message = typeof body?.message === "string" ? body.message : "";
    if (!message.trim()) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    const sent = await sendTelegramDirect(message);
    if (!sent) {
      return NextResponse.json(
        { error: "Telegram send failed" },
        { status: 502 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending to Telegram bot:", error);
    return NextResponse.json(
      { error: "Failed to send request", message: error.message },
      { status: 500 }
    );
  }
}
