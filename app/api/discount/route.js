import { connectToDB } from "@lib/database";
import DiscountSetting from "@models/DiscountSetting";

export const POST = async (req) => {
  try {
    await connectToDB();
    const body = await req.json();
    const discount = Number(body?.discount);
    const startDate = body?.startDate ? new Date(body.startDate) : null;
    const endDate = body?.endDate ? new Date(body.endDate) : null;

    if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
      return new Response(
        JSON.stringify({
          error: "Discount must be a number between 0 and 100",
        }),
        { status: 400 }
      );
    }

    if (!startDate || !endDate || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return new Response(
        JSON.stringify({ error: "Both start and end dates are required" }),
        { status: 400 }
      );
    }

    if (endDate < startDate) {
      return new Response(
        JSON.stringify({ error: "endDate must be greater than or equal to startDate" }),
        { status: 400 }
      );
    }

    // Append-only versioning: deactivate old active and create new active record.
    await DiscountSetting.updateMany({ active: true }, { $set: { active: false } });

    const result = await DiscountSetting.create({
      discount,
      startDate,
      endDate,
      active: true,
      appliedOrderIds: [],
    });

    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || "Server error occurred" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

// GET — returns current active discount (legacy-compatible shape).
export const GET = async (req) => {
  try {
    await connectToDB();
    const url = new URL(req.url);
    const includeHistory = url.searchParams.get("history") === "1";
    let activeDiscount = await DiscountSetting.findOne({ active: true })
      .sort({ createdAt: -1 })
      .lean();
    // Backward compatibility: old records may not have active=true yet.
    if (!activeDiscount) {
      activeDiscount = await DiscountSetting.findOne({})
        .sort({ createdAt: -1 })
        .lean();
    }

    if (includeHistory) {
      const history = await DiscountSetting.find({})
        .sort({ createdAt: -1 })
        .lean();
      return new Response(
        JSON.stringify({
          active: activeDiscount || null,
          history,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify(activeDiscount || null), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("🔴 GET discount error:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch discount" }), {
      status: 500,
    });
  }
};
