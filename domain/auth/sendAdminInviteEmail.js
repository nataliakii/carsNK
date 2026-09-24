import { sendEmailDirect } from "@/lib/email/sendDirect";
import { MAIL_TYPE } from "@/domain/mail/mailTypes";
import {
  EMAIL_SIGNATURE_HTML,
  EMAIL_SIGNATURE_TEXT,
} from "@/app/ui/email/templates/signature";
import { getBrandName } from "@config/brand";
import { buildAdminInviteEmail } from "./adminInviteEmail";
import { createPasswordResetToken, getRequestOrigin } from "./passwordReset";

/**
 * Persist a one-time token on the user and email the "set your password" link.
 * Same token semantics as a password reset — the raw token only ever leaves
 * the server inside the email body.
 *
 * @param {import("mongoose").Document} user — User with .email, .save()
 * @param {Request} request — for origin detection
 * @param {{ companyName?: string }} [options]
 */
export async function sendAdminInviteEmailToUser(user, request, options = {}) {
  const { rawToken, tokenHash, expiresAt } = createPasswordResetToken();
  user.resetPasswordTokenHash = tokenHash;
  user.resetPasswordExpires = expiresAt;
  user.invitedAt = new Date();
  await user.save();

  const origin = getRequestOrigin(request);
  const inviteUrl = `${origin}/reset-password?token=${encodeURIComponent(rawToken)}`;
  const brand = getBrandName();
  const { subject, message, copy, vars } = buildAdminInviteEmail({
    name: user.name || user.username || user.email,
    brand,
    company: options.companyName || brand,
    inviteUrl,
    language: user.notificationLanguage,
  });

  await sendEmailDirect({
    title: subject,
    message: `${message}\n${EMAIL_SIGNATURE_TEXT}`,
    html: `<!DOCTYPE html>
<html><body style="font-family:sans-serif;padding:24px;color:#1a1a1a">
  <p>${copy.greeting.replace("{{name}}", vars.name)}</p>
  <p>${copy.intro.replace("{{company}}", vars.company).replace("{{brand}}", brand)}</p>
  <p><a href="${inviteUrl}" style="display:inline-block;padding:12px 18px;background:#0B1F3A;color:#fff;text-decoration:none;border-radius:8px">${copy.cta}</a></p>
  <p style="font-size:13px;color:#555">${copy.copyHint}<br/><a href="${inviteUrl}">${inviteUrl}</a></p>
  <p style="font-size:12px;color:#777">${copy.expiry}</p>
  ${EMAIL_SIGNATURE_HTML}
</body></html>`,
    to: [user.email],
    meta: { type: MAIL_TYPE.ADMIN_INVITE },
  });
}
