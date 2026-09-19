/**
 * Company meeting contacts for official confirmation email/PDF.
 * Legacy single fields (meetingContactName/Phone/Channel) stay in sync with contacts[0].
 */

export function emptyMeetingContact() {
  return { name: "", phone: "", channel: "WhatsApp" };
}

function trimStr(value) {
  if (value == null) return "";
  return String(value).trim();
}

/**
 * @param {unknown} raw
 * @returns {{ name: string, phone: string, channel: string }[]}
 */
export function sanitizeMeetingContactsInput(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const name = trimStr(item.name);
    const phone = trimStr(item.phone);
    const channel = trimStr(item.channel) || "WhatsApp";
    if (!name && !phone) continue;
    out.push({ name, phone, channel });
    if (out.length >= 10) break;
  }
  return out;
}

/**
 * Resolve editable list from company doc (array or legacy single fields).
 * Always returns at least one row for the form.
 */
export function meetingContactsFromCompany(company) {
  const fromArray = sanitizeMeetingContactsInput(company?.meetingContacts);
  if (fromArray.length > 0) return fromArray;

  const legacy = {
    name: trimStr(company?.meetingContactName),
    phone: trimStr(company?.meetingContactPhone),
    channel: trimStr(company?.meetingContactChannel) || "WhatsApp",
  };
  if (legacy.name || legacy.phone) return [legacy];
  return [emptyMeetingContact()];
}

/** Persist shape: array + legacy mirrors of first contact. */
export function meetingContactsUpdatePayload(contacts) {
  const list = sanitizeMeetingContactsInput(contacts);
  const first = list[0] || emptyMeetingContact();
  return {
    meetingContacts: list,
    meetingContactName: first.name,
    meetingContactPhone: first.phone,
    meetingContactChannel: first.channel || "WhatsApp",
  };
}

export function formatMeetingContactLine(contact) {
  if (!contact) return "";
  return [
    trimStr(contact.phone),
    trimStr(contact.channel) ? `(${trimStr(contact.channel)})` : "",
    trimStr(contact.name),
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

/** Display string for email/PDF (all contacts). */
export function formatMeetingContactsDisplay(contacts) {
  const list = sanitizeMeetingContactsInput(contacts);
  return list
    .map(formatMeetingContactLine)
    .filter(Boolean)
    .join(" · ");
}

/**
 * Resolve contacts for confirmation send: company array → legacy → env → defaults.
 */
export function resolveMeetingContactsForConfirmation(company, defaults = {}) {
  const fromCompany = sanitizeMeetingContactsInput(company?.meetingContacts);
  if (fromCompany.length > 0) return fromCompany;

  const legacy = {
    name:
      trimStr(company?.meetingContactName) ||
      trimStr(defaults.name) ||
      "",
    phone:
      trimStr(company?.meetingContactPhone) ||
      trimStr(defaults.phone) ||
      "",
    channel:
      trimStr(company?.meetingContactChannel) ||
      trimStr(defaults.channel) ||
      "WhatsApp",
  };
  if (legacy.name || legacy.phone) return [legacy];
  if (defaults.phone || defaults.name) {
    return [
      {
        name: trimStr(defaults.name),
        phone: trimStr(defaults.phone),
        channel: trimStr(defaults.channel) || "WhatsApp",
      },
    ];
  }
  return [];
}
