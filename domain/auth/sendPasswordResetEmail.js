import { sendEmailDirect } from "@/lib/email/sendDirect";
import { MAIL_TYPE } from "@/domain/mail/mailTypes";
import { EMAIL_SIGNATURE_HTML, EMAIL_SIGNATURE_TEXT } from "@/app/ui/email/templates/signature";
import { getBrandName } from "@config/brand";
import { createPasswordResetToken, getRequestOrigin } from "./passwordReset";

/**
 * Generate reset token, persist on user, and email the reset link.
 * @param {import("mongoose").Document} user — User with .email, .save()
 * @param {Request} request — for origin detection
 */
export async function sendPasswordResetEmailToUser(user, request) {
  const { rawToken, tokenHash, expiresAt } = createPasswordResetToken();
  user.resetPasswordTokenHash = tokenHash;
  user.resetPasswordExpires = expiresAt;
  await user.save();

  const origin = getRequestOrigin(request);
  const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(rawToken)}`;
  const brand = getBrandName();
  const message = [
    `You requested a password reset for your ${brand} admin account.`,
    "",
    "Open this link within 1 hour:",
    resetUrl,
    "",
    "If you did not request this, ignore this email.",
    EMAIL_SIGNATURE_TEXT,
  ].join("\n");

  await sendEmailDirect({
    title: `${brand} — Password reset`,
    message,
    html: `<!DOCTYPE html>
<html><body style="font-family:sans-serif;padding:24px;color:#1a1a1a">
  <p>You requested a password reset for your ${brand} admin account.</p>
  <p><a href="${resetUrl}" style="display:inline-block;padding:12px 18px;background:#0B1F3A;color:#fff;text-decoration:none;border-radius:8px">Reset password</a></p>
  <p style="font-size:13px;color:#555">Or copy this link:<br/><a href="${resetUrl}">${resetUrl}</a></p>
  <p style="font-size:12px;color:#777">Link expires in 1 hour. If you did not request this, ignore the email.</p>
  ${EMAIL_SIGNATURE_HTML}
</body></html>`,
    to: [user.email],
    meta: { type: MAIL_TYPE.PASSWORD_RESET },
  });
}
