import { getServerSession } from "next-auth/next";
import { authOptions } from "@lib/authOptions";
import { ROLE } from "@models/user";

/**
 * Get admin session with role information.
 *
 * @param {Request} [request] - Optional request object (for future use)
 * @returns {Promise<{ user: Object }|null>}
 */
export async function getAdminSession(request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !session.user.isAdmin) {
    return null;
  }

  return {
    user: session.user,
  };
}

/**
 * Check if user is admin and return 401 response if not.
 *
 * @param {Request} [request]
 * @returns {Promise<{ session: Object|null, errorResponse: Response|null }>}
 */
export async function requireAdmin(request) {
  const result = await getAdminSession(request);

  if (!result) {
    return {
      session: null,
      errorResponse: new Response(
        JSON.stringify({ message: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  return {
    session: result,
    errorResponse: null,
  };
}

/**
 * Superadmin-only gate.
 */
export async function requireSuperAdmin(request) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return { session: null, errorResponse };

  if (Number(session.user.role) !== ROLE.SUPERADMIN) {
    return {
      session: null,
      errorResponse: new Response(
        JSON.stringify({ message: "Forbidden — superadmin only" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  return { session, errorResponse: null };
}
