import { NextResponse } from "next/server";
import { requireAdmin } from "@lib/adminAuth";
import { sendEmailDirect } from "@/lib/email/sendDirect";
import { normalizeTransferVoucherData } from "@/domain/vouchers/transferVoucher";
import { buildTransferVoucherEmailHtml } from "@/domain/vouchers/transferVoucherEmailHtml";
import { buildTransferVoucherPdf } from "@/domain/vouchers/transferVoucherPdf";
import { getRequestOrigin } from "@/domain/auth/passwordReset";

export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

/**
 * POST /api/admin/vouchers/transfer/email
 * Body: { voucher, email }
 */
export async function POST(request) {
  const { errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "Invalid JSON" }, 400);
  }

  const email = String(body?.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return json({ success: false, message: "Valid email is required" }, 400);
  }

  const voucher = normalizeTransferVoucherData(body?.voucher || {});
  const origin = getRequestOrigin(request);
  const stampPath = String(voucher.stampSrc || "/vouchers/natali-cars-stamp.png");
  const stampAbsoluteUrl = stampPath.startsWith("http")
    ? stampPath
    : `${origin}${stampPath.startsWith("/") ? "" : "/"}${stampPath}`;

  const html = buildTransferVoucherEmailHtml(voucher, { stampAbsoluteUrl });
  const title = `Κουπόνι μεταφοράς — ${voucher.clientName || voucher.lessee || "Natali Cars"}`;

  try {
    const { bytes, fileName } = await buildTransferVoucherPdf(voucher, {
      stampSrc: stampPath,
    });
    await sendEmailDirect({
      title,
      message:
        "Transfer voucher / Κουπόνι μεταφοράς — PDF attached. See also HTML version.",
      html,
      to: [email],
      attachments: [
        {
          filename: fileName,
          content: Buffer.from(bytes),
          contentType: "application/pdf",
        },
      ],
    });
    return json({ success: true, message: `Sent to ${email}` });
  } catch (err) {
    console.error("[transfer-voucher-email]", err?.message || err);
    return json(
      { success: false, message: err?.message || "Failed to send email" },
      500
    );
  }
}
