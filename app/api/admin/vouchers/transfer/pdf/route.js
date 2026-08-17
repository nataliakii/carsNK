import { NextResponse } from "next/server";
import { requireAdmin } from "@lib/adminAuth";
import { normalizeTransferVoucherData } from "@/domain/vouchers/transferVoucher";
import { buildTransferVoucherPdf } from "@/domain/vouchers/transferVoucherPdf";

export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

/**
 * POST /api/admin/vouchers/transfer/pdf
 * Body: { voucher } → PDF download
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

  const voucher = normalizeTransferVoucherData(body?.voucher || {});
  const stampPath = String(voucher.stampSrc || "/vouchers/natali-cars-stamp.png");

  try {
    const { bytes, fileName } = await buildTransferVoucherPdf(voucher, {
      stampSrc: stampPath,
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
    console.error("[transfer-voucher-pdf]", err?.message || err);
    return json(
      { success: false, message: err?.message || "Failed to build PDF" },
      500
    );
  }
}
