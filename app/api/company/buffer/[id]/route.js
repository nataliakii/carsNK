import Company from "@models/company";
import { connectToDB } from "@lib/database";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

/**
 * PUT /api/company/buffer/[id]
 * 
 * Обновляет bufferTime компании
 * 
 * @param {Object} request - Request объект
 * @param {Object} params - Параметры маршрута { id: string }
 * @returns {NextResponse} - Обновлённая компания или ошибка
 */
export const PUT = async (request, { params }) => {
  try {
    await connectToDB();

    const { id: companyId } = params;

    if (!companyId) {
      return NextResponse.json(
        { error: "Company ID is required" },
        { status: 400 }
      );
    }

    // Получаем bufferTime из тела запроса
    const body = await request.json();
    const { bufferTime } = body;

    // Валидация
    if (bufferTime === undefined || bufferTime === null) {
      return NextResponse.json(
        { error: "bufferTime is required" },
        { status: 400 }
      );
    }

    const bufferTimeNumber = Number(bufferTime);
    if (isNaN(bufferTimeNumber) || bufferTimeNumber < 0 || bufferTimeNumber > 24) {
      return NextResponse.json(
        { error: "bufferTime must be a number between 0 and 24 hours" },
        { status: 400 }
      );
    }

    // Находим компанию
    const company = await Company.findById(companyId);

    if (!company) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    // Обновляем bufferTime
    company.bufferTime = bufferTimeNumber;
    const updatedCompany = await company.save();

    // Инвалидируем кэш GET /api/company/[id], чтобы в production сразу отдавался свежий bufferTime
    revalidatePath(`/api/company/${companyId}`);

    return NextResponse.json(
      {
        success: true,
        message: "Buffer time updated successfully",
        data: updatedCompany,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating company bufferTime:", error);
    return NextResponse.json(
      { error: `Failed to update bufferTime: ${error.message}` },
      { status: 500 }
    );
  }
};

