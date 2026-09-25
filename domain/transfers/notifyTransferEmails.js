import {
  getAdminTransferEmails,
  getInternalNotificationEmail,
} from "@config/email";
import { sendEmailDirect } from "@/lib/email/sendDirect";
import { MAIL_TYPE } from "@/domain/mail/mailTypes";
import { renderAdminOrderNotificationHtml } from "@/app/ui/email/templates/adminOrderNotification";
import {
  EMAIL_STYLE,
  escapeHtml,
  renderEmailHeaderRow,
} from "@/app/ui/email/theme/nataliCarsEmailTheme";
import { EMAIL_SIGNATURE_HTML } from "@/app/ui/email/templates/signature";
import { connectToDB } from "@lib/database";
import Transfer, { defaultOfferTtlHours } from "@models/Transfer";
import { createHashedTransferOffer } from "@/domain/transfers/claimToken";
import { getBaseUrl } from "@config/domain";
import { BRAND } from "@config/brand";
import {
  getTransferPartnerEmailCopy,
  formatTransferPartnerSubject,
  transferEmailTpl,
} from "@/domain/transfers/transferPartnerEmailI18n";
import { resolveNotifyLanguagesFromCompanyDoc } from "@/domain/orders/adminNotifyLocales";
import {
  findEligibleTransferCompanies,
  partnerNotifyEmails,
} from "@/domain/transfers/eligibility";
import { formatMinor } from "@/domain/money/minorUnits";
import { getSiteCountryCode } from "@config/siteCountry";

function adminTransferEmails() {
  return getAdminTransferEmails();
}

function uniqueEmails(list) {
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const email = String(raw || "").trim().toLowerCase();
    if (!email || !email.includes("@") || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

function formatWhen(datetime) {
  if (!datetime) return "";
  const d = new Date(datetime);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

/**
 * Transfer email body lines.
 * Partner emails must use includePii: false (no name/phone/email/notes).
 */
export function buildTransferDetailsLines(
  doc,
  { includePii = false, locale = "en" } = {}
) {
  const t = getTransferPartnerEmailCopy(locale);
  const quote = doc.quoteSnapshot;
  const payout =
    quote?.supplierPayoutMinor != null
      ? formatMinor(quote.supplierPayoutMinor, quote.currency || "EUR")
      : null;
  const lines = [
    `${t.from}: ${doc.from}${
      !includePii && doc.origin?.city ? ` (${doc.origin.city})` : ""
    }`,
    `${t.to}: ${doc.to}${
      !includePii && doc.destination?.city ? ` (${doc.destination.city})` : ""
    }`,
    !includePii &&
    (doc.origin?.locationType === "airport" ||
      doc.destination?.locationType === "airport")
      ? `Airport transfer`
      : null,
    doc.distanceKm != null
      ? `${t.distance}: ${doc.distanceKm} km${
          doc.durationMinutes != null ? ` (~${doc.durationMinutes} min)` : ""
        }`
      : null,
    `${t.when}: ${formatWhen(doc.datetime)}`,
    `${t.passengers}: ${doc.passengers}`,
  ];

  if (!includePii) {
    lines.push(
      doc.standardSuitcases != null
        ? `Luggage: ${doc.standardSuitcases} suitcases, ${doc.cabinBags || 0} cabin`
        : null,
      doc.vehicleCategory ? `Vehicle: ${doc.vehicleCategory}` : null,
      payout ? `Supplier payout: ${payout}` : null,
      doc.accessibilityRequirements
        ? `Special requirements: accessibility noted`
        : null,
      doc.childSeats || doc.boosterSeats
        ? `Child seats: ${doc.childSeats || 0}, boosters: ${doc.boosterSeats || 0}`
        : null
    );
  } else {
    lines.push(
      doc.customerName ? `${t.name}: ${doc.customerName}` : null,
      doc.phone ? `${t.phone}: ${doc.phone}` : null,
      doc.email ? `${t.email}: ${doc.email}` : null,
      doc.flightNumber ? `Flight: ${doc.flightNumber}` : null,
      doc.hotelName ? `Hotel: ${doc.hotelName}` : null,
      doc.notes ? `${t.notes}: ${doc.notes}` : null,
      quote?.customerPriceMinor != null
        ? `Customer price: ${formatMinor(quote.customerPriceMinor, quote.currency || "EUR")}`
        : null,
      quote?.pricingMethod ? `Pricing: ${quote.pricingMethod}` : null
    );
  }

  return lines.filter(Boolean);
}

/** Operational summary only — no phone / exact private address / email. */
export function buildPartnerOfferLines(doc, locale = "en") {
  return buildTransferDetailsLines(doc, { includePii: false, locale });
}

/** Full details for admin / customer / assigned supplier. */
export function buildFullTransferLines(doc, locale = "en") {
  return buildTransferDetailsLines(doc, { includePii: true, locale });
}

function renderCustomerTransferHtml({ title, greeting, lines }) {
  const s = EMAIL_STYLE;
  const linesHtml = lines
    .map(
      (line) =>
        `<div style="margin:8px 0;color:${s.text};line-height:1.6;font-size:15px;font-family:${s.fontSans};">${escapeHtml(line)}</div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${s.bgPage};font-family:${s.fontSans};">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:${s.bgPage};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background-color:${s.bgCard};border:1px solid ${s.border};border-radius:8px;overflow:hidden;">
          ${renderEmailHeaderRow({ title })}
          <tr>
            <td style="padding:28px;">
              <div style="margin:0 0 16px;color:${s.text};font-size:15px;line-height:1.6;">${escapeHtml(greeting)}</div>
              ${linesHtml}
              <div style="margin:20px 0 0;color:${s.muted};font-size:14px;line-height:1.5;">
                We will match you with a transfer partner and confirm the details shortly.
              </div>
              ${EMAIL_SIGNATURE_HTML}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderPartnerOfferHtml({
  brandName,
  companyName,
  lines,
  claimUrl,
  payoutFormatted,
  locale = "en",
}) {
  const copy = getTransferPartnerEmailCopy(locale);
  const s = EMAIL_STYLE;
  const linesHtml = lines
    .map(
      (line) =>
        `<div style="margin:8px 0;color:${s.text};line-height:1.6;font-size:15px;font-family:${s.fontSans};">${escapeHtml(line)}</div>`
    )
    .join("");
  const title = transferEmailTpl(copy.title, { brand: brandName });
  const greeting = transferEmailTpl(copy.greeting, {
    company: escapeHtml(companyName || "partner"),
  });
  const payoutLine = payoutFormatted
    ? `Supplier payout: <strong>${escapeHtml(payoutFormatted)}</strong>`
    : "";

  return `<!DOCTYPE html>
<html lang="${escapeHtml(locale)}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${s.bgPage};font-family:${s.fontSans};">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:${s.bgPage};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background-color:${s.bgCard};border:1px solid ${s.border};border-radius:8px;overflow:hidden;">
          ${renderEmailHeaderRow({ title })}
          <tr>
            <td style="padding:28px;">
              <div style="margin:0 0 16px;color:${s.text};font-size:15px;line-height:1.6;">
                ${greeting}
              </div>
              ${linesHtml}
              ${
                payoutLine
                  ? `<div style="margin:16px 0;color:${s.text};font-size:14px;line-height:1.5;">${payoutLine}</div>`
                  : ""
              }
              <div style="margin:24px 0;">
                <a href="${escapeHtml(claimUrl)}" style="display:inline-block;padding:14px 28px;background-color:${s.ctaBg};color:${s.ctaText};text-decoration:none;font-weight:700;border-radius:8px;font-size:16px;font-family:${s.fontSans};">${copy.cta}</a>
              </div>
              <div style="margin:0;color:${s.muted};font-size:13px;line-height:1.5;">
                ${escapeHtml(copy.footer)}
              </div>
              ${EMAIL_SIGNATURE_HTML}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function recordCommunication(transferId, entry) {
  try {
    await Transfer.findByIdAndUpdate(transferId, {
      $push: { communications: entry },
    });
  } catch (err) {
    console.error("[transfer] communication log failed", err?.message || err);
  }
}

/**
 * Email platform admins, eligible partners (claim CTA), and customer.
 * Partner emails must NOT include raw phone / private address / email.
 */
export async function notifyTransferEmails(doc) {
  const brandName = BRAND?.name || "Platform";
  const adminLines = buildFullTransferLines(doc, "en");
  const adminBody = adminLines.join("\n");
  const adminTitle = `🚕 New transfer request — ${brandName}`;
  const adminTo = uniqueEmails(adminTransferEmails());
  const transferId = String(doc._id);

  const adminHtml = renderAdminOrderNotificationHtml({
    title: adminTitle,
    body: adminBody,
  });

  try {
    await sendEmailDirect({
      meta: { type: MAIL_TYPE.TRANSFER },
      title: adminTitle,
      message: adminBody,
      html: adminHtml,
      to: adminTo,
    });
    await recordCommunication(transferId, {
      channel: "email",
      template: "transfer_admin_new",
      to: adminTo,
      subject: adminTitle,
      status: "sent",
    });
  } catch (err) {
    await recordCommunication(transferId, {
      channel: "email",
      template: "transfer_admin_new",
      to: adminTo,
      subject: adminTitle,
      status: "failed",
      errorMessage: err?.message || String(err),
    });
  }

  await connectToDB();
  const eligible = await findEligibleTransferCompanies(doc);
  const baseUrl = getBaseUrl().replace(/\/$/, "");
  const offerEmails = [];
  const eligibleIds = [];
  const ttlSec = defaultOfferTtlHours() * 3600;
  const payoutMinor = doc.quoteSnapshot?.supplierPayoutMinor ?? null;
  const currency = doc.quoteSnapshot?.currency || "EUR";
  const payoutFormatted =
    payoutMinor != null ? formatMinor(payoutMinor, currency) : null;

  for (const { company } of eligible) {
    eligibleIds.push(company._id);
    const emails = partnerNotifyEmails(company);
    if (!emails.length) continue;
    const locale = resolveNotifyLanguagesFromCompanyDoc(company).langAdmin;
    const lines = buildPartnerOfferLines(doc, locale);
    const body = lines.join("\n");

    let claimUrl = `${baseUrl}/transfer/claim`;
    try {
      const created = await createHashedTransferOffer({
        transferId,
        companyId: String(company._id),
        supplierPayoutMinor: payoutMinor,
        currency,
        expSec: ttlSec,
      });
      if (created.ok) {
        claimUrl = `${baseUrl}/transfer/claim/${encodeURIComponent(created.token)}`;
      }
    } catch (err) {
      console.error("[transfer] offer token failed", err?.message || err);
    }

    const partnerHtml = renderPartnerOfferHtml({
      brandName,
      companyName: company.name,
      lines,
      claimUrl,
      payoutFormatted,
      locale,
    });

    for (const email of emails) {
      try {
        await sendEmailDirect({
      meta: { type: MAIL_TYPE.TRANSFER },
          title: formatTransferPartnerSubject(locale, brandName),
          // Do not put raw token-bearing URL in analytics; body may include claim link for the partner.
          message: `${body}\n\nOpen the secure claim page to accept.`,
          html: partnerHtml,
          to: [email],
        });
        offerEmails.push(email);
        await recordCommunication(transferId, {
          channel: "email",
          template: "transfer_partner_offer",
          to: [email],
          subject: formatTransferPartnerSubject(locale, brandName),
          status: "sent",
          metadata: { companyId: String(company._id) },
        });
      } catch (err) {
        console.error("[transfer] partner email failed", email, err?.message || err);
        await recordCommunication(transferId, {
          channel: "email",
          template: "transfer_partner_offer",
          to: [email],
          status: "failed",
          errorMessage: err?.message || String(err),
        });
      }
    }
  }

  const offerExpiresAt = new Date(
    Date.now() + defaultOfferTtlHours() * 60 * 60 * 1000
  );

  try {
    await Transfer.findByIdAndUpdate(transferId, {
      $set: {
        offerSentAt: new Date(),
        offerEmails,
        offerExpiresAt,
        eligibleSupplierIds: eligibleIds,
        country: doc.country || getSiteCountryCode(),
      },
    });
  } catch (err) {
    console.error("[transfer] offer audit failed", err?.message || err);
  }

  const customerEmail = String(doc.email || "").trim();
  if (!customerEmail || !customerEmail.includes("@")) {
    return {
      adminSent: true,
      customerSent: false,
      partnersSent: offerEmails.length,
      eligibleCount: eligible.length,
    };
  }

  const name = String(doc.customerName || "").trim() || "there";
  const customerTitle = `${brandName} — transfer request received`;
  const greeting = `Hi ${name}, thank you for your transfer request. Here are the details:`;
  const customerLines = buildFullTransferLines(doc, "en").filter(
    (line) => !line.startsWith("Phone:") && !/^\s*Phone:/i.test(line)
  );
  // Customer email can include their own details; exclude supplier payout.
  const customerHtml = renderCustomerTransferHtml({
    title: customerTitle,
    greeting,
    lines: customerLines,
  });

  try {
    await sendEmailDirect({
      meta: { type: MAIL_TYPE.TRANSFER },
      title: customerTitle,
      message: `${greeting}\n\n${customerLines.join("\n")}`,
      html: customerHtml,
      to: [customerEmail],
      cc: [getInternalNotificationEmail()],
    });
    await recordCommunication(transferId, {
      channel: "email",
      template: "transfer_customer_received",
      to: [customerEmail],
      subject: customerTitle,
      status: "sent",
    });
  } catch (err) {
    await recordCommunication(transferId, {
      channel: "email",
      template: "transfer_customer_received",
      to: [customerEmail],
      status: "failed",
      errorMessage: err?.message || String(err),
    });
  }

  return {
    adminSent: true,
    customerSent: true,
    partnersSent: offerEmails.length,
    eligibleCount: eligible.length,
  };
}

export async function notifyTransferClaimed({
  transfer,
  company,
  paymentUrl = null,
  paymentError = null,
  collectionMode = null,
  onSiteAmountLabel = null,
}) {
  const brandName = BRAND?.name || "Platform";
  const lines = [
    `Transfer claimed by ${company?.name || "partner"}`,
    `${transfer.from} → ${transfer.to}`,
    `When: ${formatWhen(transfer.datetime)}`,
    transfer.quoteSnapshot?.supplierPayoutMinor != null
      ? `Payout: ${formatMinor(
          transfer.quoteSnapshot.supplierPayoutMinor,
          transfer.quoteSnapshot.currency || "EUR"
        )}`
      : null,
    collectionMode ? `Payment mode: ${collectionMode}` : null,
    paymentUrl ? `Customer payment link: ${paymentUrl}` : null,
    onSiteAmountLabel
      ? `On-site / by fact: ${onSiteAmountLabel}`
      : null,
    paymentError ? `Payment link error: ${paymentError}` : null,
  ].filter(Boolean);

  try {
    await sendEmailDirect({
      meta: { type: MAIL_TYPE.TRANSFER },
      title: `${brandName} — transfer claimed`,
      message: lines.join("\n"),
      to: uniqueEmails(adminTransferEmails()),
    });
    await recordCommunication(String(transfer._id), {
      channel: "email",
      template: "transfer_admin_claimed",
      to: uniqueEmails(adminTransferEmails()),
      subject: `${brandName} — transfer claimed`,
      status: "sent",
    });
  } catch (err) {
    console.error("[transfer claim] notify platform failed", err?.message || err);
  }

  const customerEmail = String(transfer.email || "").trim();
  if (customerEmail.includes("@")) {
    try {
      const customerLines = [
        `Hi ${transfer.customerName || "there"},`,
        `Your transfer ${transfer.from} → ${transfer.to} has been assigned to a partner.`,
        `When: ${formatWhen(transfer.datetime)}`,
      ];
      if (paymentUrl) {
        customerLines.push(
          "",
          "Please complete online payment to confirm your booking:",
          paymentUrl
        );
        if (onSiteAmountLabel) {
          customerLines.push(
            "",
            `The remaining ${onSiteAmountLabel} is paid to the driver / company on site.`
          );
        }
      } else if (collectionMode === "on_site") {
        customerLines.push(
          "",
          "Payment is collected by the transfer company on site (cash or card with the driver). No online payment is required."
        );
      } else {
        customerLines.push(
          "",
          "We will send a payment link shortly, or the partner will contact you."
        );
      }
      await sendEmailDirect({
      meta: { type: MAIL_TYPE.TRANSFER },
        title: paymentUrl
          ? `${brandName} — pay to confirm your transfer`
          : `${brandName} — transfer assigned`,
        message: customerLines.join("\n"),
        to: [customerEmail],
      });
      await recordCommunication(String(transfer._id), {
        channel: "email",
        template: paymentUrl
          ? "transfer_customer_payment"
          : "transfer_customer_assigned",
        to: [customerEmail],
        status: "sent",
        metadata: paymentUrl ? { paymentUrl } : {},
      });
    } catch (err) {
      console.error("[transfer claim] customer notify failed", err?.message || err);
    }
  }

  const winnerEmails = partnerNotifyEmails(company);
  if (winnerEmails.length) {
    try {
      await sendEmailDirect({
      meta: { type: MAIL_TYPE.TRANSFER },
        title: `${brandName} — transfer assigned to you`,
        message: [
          `The transfer has been assigned to your company.`,
          paymentUrl
            ? `Customer has an online payment link (${collectionMode || "stripe"}).`
            : null,
          onSiteAmountLabel
            ? `Collect ${onSiteAmountLabel} on site / by fact.`
            : collectionMode === "on_site"
              ? `Collect the full amount on site / by fact (no Stripe for this company).`
              : null,
          ...buildFullTransferLines(transfer, "en"),
        ]
          .filter(Boolean)
          .join("\n"),
        to: winnerEmails,
      });
      await recordCommunication(String(transfer._id), {
        channel: "email",
        template: "transfer_supplier_won",
        to: winnerEmails,
        status: "sent",
      });
    } catch (err) {
      console.error("[transfer claim] winner notify failed", err?.message || err);
    }
  }
}

export default notifyTransferEmails;
