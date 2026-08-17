import { NextResponse } from "next/server";
import Company from "@models/company";
import { connectToDB } from "@lib/database";
import { ACCESS_SCOPE } from "@/domain/auth/accessScopes";
import { resolveScopedAccessToken } from "@/domain/auth/scopedAccessToken";
import { normalizeTransferVoucherData } from "@/domain/vouchers/transferVoucher";
import { buildTransferVoucherPdf } from "@/domain/vouchers/transferVoucherPdf";
import { getCompanyVoucherStampSrc } from "@/domain/vouchers/companyStamp";

export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

/**
 * POST /api/access/[token]/vouchers/pdf
 * Passwordless PDF download — vouchers.transfer scope only.
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

  await connectToDB();
  const company = await Company.findById(access.ownerId).lean();
  if (!company) {
    return json({ success: false, message: "Company not found" }, 404);
  }

  const stampSrc = getCompanyVoucherStampSrc(company);
  const voucher = normalizeTransferVoucherData({
    ...(body?.voucher || {}),
    stampSrc,
  });

  try {
    const { bytes, fileName } = await buildTransferVoucherPdf(voucher, {
      stampSrc: stampSrc || undefined,
    });
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[access-voucher-pdf]", err?.message || err);
    return json(
      { success: false, message: err?.message || "Failed to build PDF" },
      500
    );
  }
}
