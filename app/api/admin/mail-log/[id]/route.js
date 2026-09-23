import { connectToDB } from "@lib/database";
import { requireSuperAdmin } from "@/lib/adminAuth";
import { getMailLogById, serializeMailLogDetail } from "@/domain/mail/queryMailLog";

/**
 * GET /api/admin/mail-log/:id — full body for superadmin preview.
 */
export async function GET(request, { params }) {
  try {
    await connectToDB();
    const { errorResponse } = await requireSuperAdmin(request);
    if (errorResponse) return errorResponse;

    const id = params?.id;
    const doc = await getMailLogById(id);
    if (!doc) {
      return Response.json(
        { success: false, message: "Mail log not found" },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      data: serializeMailLogDetail(doc),
    });
  } catch (error) {
    console.error("[mail-log GET id]", error);
    return Response.json(
      { success: false, message: error.message || "Failed to load mail" },
      { status: 500 }
    );
  }
}
