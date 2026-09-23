import { connectToDB } from "@lib/database";
import { requireSuperAdmin } from "@/lib/adminAuth";
import { resendMailLog } from "@/domain/mail/resendOutboundMail";

/**
 * POST /api/admin/mail-log/:id/resend
 * Re-sends with current templates when a render key exists.
 */
export async function POST(request, { params }) {
  try {
    await connectToDB();
    const { errorResponse } = await requireSuperAdmin(request);
    if (errorResponse) return errorResponse;

    const result = await resendMailLog(params?.id);
    if (!result.ok) {
      return Response.json(
        { success: false, message: result.message || "Resend failed" },
        { status: result.status || 400 }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("[mail-log resend]", error);
    return Response.json(
      { success: false, message: error.message || "Failed to resend email" },
      { status: 500 }
    );
  }
}
