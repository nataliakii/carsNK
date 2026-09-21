import Company from "@models/company";
import { connectToDB } from "@lib/database";
import { COMPANY_ID } from "@config/company";
import { getSiteCountryConfig } from "@config/siteCountry";
import { withSiteCountry } from "@/domain/platform/companyCountryScope";

/**
 * POST /api/company
 * Creates a new company from request body (always tagged with deployment country).
 */
export const POST = async (request) => {
  try {
    await connectToDB();

    const companyData = await request.json();
    const country = getSiteCountryConfig();
    const newCompany = new Company(
      withSiteCountry({
        ...companyData,
        address: companyData?.address || country.defaultAddress,
        coords: companyData?.coords || country.defaultCoords,
        tel: companyData?.tel || country.defaultTel,
      })
    );
    await newCompany.save();

    return new Response(JSON.stringify(newCompany), { status: 201 });
  } catch (error) {
    console.error("Error adding company:", error);
    return new Response(`Failed to add company: ${error.message}`, {
      status: 500,
    });
  }
};

/**
 * PATCH /api/company
 * Partial update of company settings.
 */
export const PATCH = async (request) => {
  try {
    await connectToDB();
    const updates = await request.json();
    // Country is deployment-scoped — never change via this route.
    delete updates.country;
    // Rental Stripe settings are superadmin-only (PATCH /api/company/:id).
    delete updates.rentalPayments;
    delete updates.prepaymentPercent;

    const company = await Company.findByIdAndUpdate(COMPANY_ID, updates, {
      new: true,
    });

    if (!company) {
      return new Response(
        JSON.stringify({ success: false, message: "Company not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(company), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error updating company:", error);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

/**
 * GET /api/company
 * Returns the company data by COMPANY_ID.
 */
export const GET = async () => {
  try {
    await connectToDB();

    const company = await Company.findById(COMPANY_ID);

    if (!company) {
      return new Response("Company not found", { status: 404 });
    }

    return new Response(JSON.stringify(company), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching company:", error);
    return new Response(`Failed to fetch company: ${error.message}`, {
      status: 500,
    });
  }
};
