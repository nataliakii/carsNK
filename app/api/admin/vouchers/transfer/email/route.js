import { NextResponse } from "next/server";
import { requireAdmin } from "@lib/adminAuth";
import { sendEmailDirect } from "@/lib/email/sendDirect";
import { MAIL_TYPE } from "@/domain/mail/mailTypes";
import {
  normalizeTransferVoucherData,
  resolveVoucherLocaleForMarket,
  voucherEmailPlainMessage,
} from "@/domain/vouchers/transferVoucher";
import { buildTransferVoucherEmailHtml } from "@/domain/vouchers/transferVoucherEmailHtml";
import { buildTransferVoucherPdf } from "@/domain/vouchers/transferVoucherPdf";
import { getRequestOrigin } from "@/domain/auth/passwordReset";
import { resolveAdminVoucherCompany } from "@/domain/vouchers/resolveAdminVoucherCompany";

export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

/**
 * POST /api/admin/vouchers/transfer/email
 * Body: { voucher, email, companyId? }
 */
export async function POST(request) {
  const { session, errorResponse } = await requireAdmin(request);
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

  const { company, stampSrc, defaults } = await resolveAdminVoucherCompany(
    session,
    body?.companyId
  );

  const raw = body?.voucher || {};
  const voucher = normalizeTransferVoucherData({
    ...raw,
    locale: resolveVoucherLocaleForMarket(raw.locale, company?.country),
    stampSrc,
    companyHeaderTitle:
      body?.voucher?.companyHeaderTitle || defaults.companyHeaderTitle,
    companyInfo: body?.voucher?.companyInfo || defaults.companyInfo,
  });

  const origin = getRequestOrigin(request);
  const stampAbsoluteUrl = stampSrc
    ? stampSrc.startsWith("http")
      ? stampSrc
      : `${origin}${stampSrc.startsWith("/") ? "" : "/"}${stampSrc}`
    : "";

  const html = buildTransferVoucherEmailHtml(voucher, { stampAbsoluteUrl });
  const companyName = company?.name || voucher.companyHeaderTitle || "Transfer";
  const title = `Transfer voucher — ${voucher.clientName || voucher.lessee || companyName}`;

  try {
    const { bytes, fileName } = await buildTransferVoucherPdf(voucher, {
      stampSrc: stampSrc || undefined,
    });
    await sendEmailDirect({
      title,
      message: voucherEmailPlainMessage(company?.country),
      html,
      to: [email],
      attachments: [
        {
          filename: fileName,
          content: Buffer.from(bytes),
          contentType: "application/pdf",
        },
      ],
      meta: { type: MAIL_TYPE.VOUCHER, companyId: company?._id },
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
