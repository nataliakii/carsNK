/**
 * Superadmin ops notify — email (+ Telegram if configured).
 * Used when a company admin confirms a booking, signs the agreement,
 * or submits the legal profile. Failures are logged; callers should not
 * roll back the business action.
 */

import { getSuperadminNotificationEmails } from "@config/email";
import { getBaseUrl, absoluteUrl } from "@config/domain";
import { getBrandName } from "@config/brand";
import { sendEmailDirect } from "@/lib/email/sendDirect";
import { sendTelegramDirect } from "@/lib/telegram/sendDirect";
import { renderAdminOrderNotificationEmail } from "@/app/ui/email/renderEmail";
import { MAIL_RENDER_KEY, MAIL_TYPE } from "@/domain/mail/mailTypes";

function brandFooter() {
  return `${getBrandName()} · ${getBaseUrl()}`;
}

/**
 * @param {{
 *   title: string,
 *   bodyLines: string[],
 *   telegramText?: string,
 *   meta?: object,
 * }} params
 */
export async function notifySuperadmin({ title, bodyLines, telegramText, meta }) {
  const heading = String(title || "").trim() || "Platform notification";
  const lines = Array.isArray(bodyLines)
    ? bodyLines.map((line) => String(line ?? ""))
    : [String(bodyLines || "")];
  const body = lines.join("\n").trim();
  const html = renderAdminOrderNotificationEmail(heading, body);
  const to = getSuperadminNotificationEmails();

  await sendEmailDirect({
    title: heading,
    message: body,
    html,
    to,
    cc: [],
    meta: {
      type: MAIL_TYPE.ORDER_SUPERADMIN,
      renderKey: MAIL_RENDER_KEY.ADMIN_ORDER_NOTIFICATION,
      payload: { title: heading, body },
      ...(meta && typeof meta === "object" ? meta : {}),
    },
  });

  try {
    await sendTelegramDirect(
      telegramText || `${heading}\n\n${body}\n\n${brandFooter()}`
    );
  } catch (err) {
    console.warn("[notifySuperadmin] telegram failed:", err?.message || err);
  }
}

export function adminCalendarUrl() {
  return absoluteUrl("/admin");
}

export { brandFooter as superadminNotifyFooter };
