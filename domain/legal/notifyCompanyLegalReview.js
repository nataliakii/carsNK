/**
 * Email company admins when a legal review decision needs their attention.
 * Failures are logged; callers must not roll back the status change.
 */

import { getBrandName } from "@config/brand";
import { absoluteUrl } from "@config/domain";
import { sendEmailDirect } from "@/lib/email/sendDirect";
import { resolveCompanyAdminEmails } from "@/domain/mail/notificationRecipients";
import { MAIL_RENDER_KEY, MAIL_TYPE } from "@/domain/mail/mailTypes";
import { renderAdminOrderNotificationEmail } from "@/app/ui/email/renderEmail";

/**
 * @param {{
 *   companyId: string,
 *   companyName?: string,
 *   decision: "changes_requested"|"rejected",
 *   message: string,
 *   items?: Array<{label?: string}>,
 * }} params
 */
export async function notifyCompanyLegalReviewDecision({
  companyId,
  companyName = "",
  decision,
  message,
  items = [],
}) {
  const emails = await resolveCompanyAdminEmails(companyId);
  if (!emails.length) return { ok: false, code: "no_recipients" };

  const isChanges = decision === "changes_requested";
  const title = isChanges
    ? `${getBrandName()}: changes requested for ${companyName || "your company"}`
    : `${getBrandName()}: application rejected for ${companyName || "your company"}`;

  const lines = [
    isChanges
      ? "Rovaro reviewed your company legal application and needs changes before it can be approved."
      : "Rovaro reviewed your company legal application and closed it.",
    "",
    String(message || "").trim(),
  ];
  const labels = (items || [])
    .map((item) => String(item?.label || "").trim())
    .filter(Boolean);
  if (labels.length) {
    lines.push("", "Items:", ...labels.map((label) => `• ${label}`));
  }
  lines.push("", `Open company setup: ${absoluteUrl("/admin/company/setup")}`);

  const body = lines.join("\n").trim();
  const html = renderAdminOrderNotificationEmail(title, body);

  await sendEmailDirect({
    title,
    message: body,
    html,
    to: emails,
    cc: [],
    meta: {
      type: MAIL_TYPE.ORDER_SUPERADMIN,
      renderKey: MAIL_RENDER_KEY.ADMIN_ORDER_NOTIFICATION,
      payload: {
        title,
        body,
        companyId: String(companyId),
        decision,
        // Never include document URLs or file content.
      },
    },
  });

  return { ok: true, emailed: emails.length };
}
