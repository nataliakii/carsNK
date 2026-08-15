import { NextResponse } from "next/server";
import Company from "@models/company";
import { connectToDB } from "@lib/database";
import { ACCESS_SCOPE } from "@/domain/auth/accessScopes";
import { resolveScopedAccessToken } from "@/domain/auth/scopedAccessToken";
import { sendEmailDirect } from "@/lib/email/sendDirect";
import { normalizeTransferVoucherData } from "@/domain/vouchers/transferVoucher";
import { buildTransferVoucherEmailHtml } from "@/domain/vouchers/transferVoucherEmailHtml";
import { getRequestOrigin } from "@/domain/auth/passwordReset";
import { getCompanyVoucherStampSrc } from "@/domain/vouchers/companyStamp";

export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

/**
 * POST /api/access/[token]/vouchers/email
 * Passwordless send — only if token has vouchers.transfer scope.
 */
export async function POST(request, { params }) {
  const rawToken = decodeURIComponent(String(params?.token || "").trim());
  const access = await resolveScopedAccessToken(
    rawToken,
    ACCESS_SCOPE.VOUCHERS_TRANSFER
  );
  if (!access) {
    return json({ success: false, message: "Invalid or expired link" }, 401);
  }

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

  await connectToDB();
  const company = await Company.findById(access.ownerId).lean();
  if (!company) {
    return json({ success: false, message: "Company not found" }, 404);
  }

  const voucher = normalizeTransferVoucherData({
    ...(body?.voucher || {}),
    stampSrc: getCompanyVoucherStampSrc(company),
  });

  const origin = getRequestOrigin(request);
  const stampPath = String(voucher.stampSrc || "");
  const stampAbsoluteUrl = stampPath.startsWith("http")
    ? stampPath
    : `${origin}${stampPath.startsWith("/") ? "" : "/"}${stampPath}`;

  const html = buildTransferVoucherEmailHtml(voucher, { stampAbsoluteUrl });
  const title = `Κουπόνι μεταφοράς — ${company.name}`;

  try {
    await sendEmailDirect({
      title,
      message: "Transfer voucher / Κουπόνι μεταφοράς — see HTML version.",
      html,
      to: [email],
    });
    return json({ success: true, message: `Sent to ${email}` });
  } catch (err) {
    console.error("[access-voucher-email]", err?.message || err);
    return json(
      { success: false, message: err?.message || "Failed to send email" },
      500
    );
  }
}
