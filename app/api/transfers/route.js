import { NextResponse } from "next/server";
import { connectToDB } from "@lib/database";
import Transfer from "@models/Transfer";
import { sendTelegramDirect } from "@/lib/telegram/sendDirect";
import { getTransferDistance } from "@/domain/transfers/getTransferDistance";
import { notifyTransferEmails } from "@/domain/transfers/notifyTransferEmails";

export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

function formatTransferTelegram(doc) {
  const when = doc.datetime
    ? new Date(doc.datetime).toISOString().replace("T", " ").slice(0, 16)
    : "";
  const distanceLine =
    doc.distanceKm != null
      ? `Расстояние: ${doc.distanceKm} km${
          doc.durationMinutes != null ? ` (~${doc.durationMinutes} min)` : ""
        }`
      : null;
  return [
    "🚕 CarsNK — новая заявка на трансфер",
    `Откуда: ${doc.from}`,
    `Куда: ${doc.to}`,
    distanceLine,
    `Когда: ${when}`,
    `Пассажиры: ${doc.passengers}`,
    doc.customerName ? `Имя: ${doc.customerName}` : null,
    doc.phone ? `Телефон: ${doc.phone}` : null,
    doc.email ? `Email: ${doc.email}` : null,
    doc.notes ? `Заметки: ${doc.notes}` : null,
    "https://carsnk.gr",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ success: false, message: "Invalid JSON" }, 400);
  }

  const from = String(payload?.from || "").trim();
  const to = String(payload?.to || "").trim();
  const notes = String(payload?.notes || "").trim();
  const customerName = String(payload?.customerName || "").trim();
  const phone = String(payload?.phone || "").trim();
  const email = String(payload?.email || "").trim();
  const locale = String(payload?.locale || "").trim();
  const passengers = Number(payload?.passengers);
  const datetimeRaw = payload?.datetime;

  if (!from || !to) {
    return json({ success: false, message: "from and to are required" }, 400);
  }
  if (!email || !email.includes("@")) {
    return json({ success: false, message: "email is required" }, 400);
  }
  if (!Number.isFinite(passengers) || passengers < 1) {
    return json({ success: false, message: "passengers must be >= 1" }, 400);
  }
  const datetime = datetimeRaw ? new Date(datetimeRaw) : null;
  if (!datetime || Number.isNaN(datetime.getTime())) {
    return json({ success: false, message: "datetime is required" }, 400);
  }

  let distanceKm =
    payload?.distanceKm != null && Number.isFinite(Number(payload.distanceKm))
      ? Number(payload.distanceKm)
      : null;
  let durationMinutes =
    payload?.durationMinutes != null &&
    Number.isFinite(Number(payload.durationMinutes))
      ? Number(payload.durationMinutes)
      : null;

  if (distanceKm == null) {
    const computed = await getTransferDistance({ from, to });
    if (computed.ok) {
      distanceKm = computed.distanceKm;
      durationMinutes = computed.durationMinutes ?? null;
    }
  }

  try {
    await connectToDB();
    const doc = await Transfer.create({
      from,
      to,
      distanceKm,
      durationMinutes,
      passengers: Math.min(50, Math.floor(passengers)),
      datetime,
      notes,
      customerName,
      phone,
      email,
      locale,
    });

    try {
      await sendTelegramDirect(formatTransferTelegram(doc));
    } catch (err) {
      console.error("[transfer] telegram failed", err?.message || err);
    }

    try {
      await notifyTransferEmails(doc);
    } catch (err) {
      console.error("[transfer] email failed", err?.message || err);
    }

    return json(
      {
        success: true,
        id: doc._id.toString(),
        distanceKm: doc.distanceKm,
        durationMinutes: doc.durationMinutes,
      },
      201
    );
  } catch (error) {
    console.error("[transfer] create failed", error);
    return json(
      { success: false, message: error.message || "Failed to create transfer" },
      500
    );
  }
}
