/**
 * Invitation mail for a new company admin.
 *
 * The invitation is a set-your-password link built from the same one-time
 * token as a password reset, so an invited admin never receives a password
 * and the superadmin never sees one.
 */

import { normalizeNotificationLanguage } from "@/domain/admin/companyAdmins";

const ADMIN_INVITE_DICT = {
  en: {
    subject: "{{brand}} — you have been invited as an admin",
    greeting: "Hi {{name}},",
    intro:
      "{{company}} invited you to the {{brand}} admin console. Set your own password to activate the account.",
    cta: "Set my password",
    copyHint: "Or copy this link:",
    expiry:
      "The link expires in 1 hour. Ask your superadmin to resend the invitation if it has.",
  },
  es: {
    subject: "{{brand}} — te han invitado como administrador",
    greeting: "Hola {{name}}:",
    intro:
      "{{company}} te ha invitado a la consola de administración de {{brand}}. Crea tu propia contraseña para activar la cuenta.",
    cta: "Crear mi contraseña",
    copyHint: "O copia este enlace:",
    expiry:
      "El enlace caduca en 1 hora. Pide a tu superadministrador que reenvíe la invitación si ha caducado.",
  },
  el: {
    subject: "{{brand}} — προσκληθήκατε ως διαχειριστής",
    greeting: "Γεια σας {{name}},",
    intro:
      "Η {{company}} σας προσκάλεσε στην κονσόλα διαχείρισης {{brand}}. Ορίστε τον δικό σας κωδικό για να ενεργοποιήσετε τον λογαριασμό.",
    cta: "Ορισμός κωδικού",
    copyHint: "Ή αντιγράψτε αυτόν τον σύνδεσμο:",
    expiry:
      "Ο σύνδεσμος λήγει σε 1 ώρα. Ζητήστε από τον superadmin να στείλει ξανά την πρόσκληση αν έληξε.",
  },
  ru: {
    subject: "{{brand}} — вас пригласили администратором",
    greeting: "Здравствуйте, {{name}}!",
    intro:
      "Компания {{company}} пригласила вас в админ-консоль {{brand}}. Задайте собственный пароль, чтобы активировать аккаунт.",
    cta: "Задать пароль",
    copyHint: "Или скопируйте ссылку:",
    expiry:
      "Ссылка действует 1 час. Если она истекла, попросите суперадмина прислать приглашение заново.",
  },
};

function fill(template, vars) {
  return String(template).replace(/\{\{(\w+)\}\}/g, (_, key) =>
    vars[key] == null ? "" : String(vars[key])
  );
}

export function adminInviteCopy(language) {
  const code = normalizeNotificationLanguage(language);
  return ADMIN_INVITE_DICT[code] || ADMIN_INVITE_DICT.en;
}

/**
 * Subject + plain text + html for an invitation.
 * @param {{ name: string, brand: string, company: string, inviteUrl: string, language?: string }} input
 */
export function buildAdminInviteEmail({
  name,
  brand,
  company,
  inviteUrl,
  language,
}) {
  const copy = adminInviteCopy(language);
  const vars = { name: name || "", brand, company: company || brand };

  const subject = fill(copy.subject, vars);
  const message = [
    fill(copy.greeting, vars),
    "",
    fill(copy.intro, vars),
    "",
    inviteUrl,
    "",
    copy.expiry,
  ].join("\n");

  return { subject, message, copy, vars };
}
