/**
 * Build HTML email body for a Natali Cars transfer voucher.
 */

import {
  formatDateDisplay,
  formatVoucherLabel,
  normalizeTransferVoucherData,
} from "./transferVoucher";

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function labelHtml(key, { bilingual, locale }) {
  const { primary, secondary } = formatVoucherLabel(key, { bilingual, locale });
  return secondary
    ? `<div>${esc(primary)}</div><div style="font-weight:600;opacity:.85">${esc(secondary)}</div>`
    : esc(primary);
}

function row(key, value, opts) {
  return `<tr>
  <td style="background:#f4f7fb;color:#073763;font-weight:700;width:34%;border:1px solid #cbd6df;padding:5px 7px;vertical-align:top;font-size:10.5px;line-height:1.25">${labelHtml(key, opts)}</td>
  <td style="border:1px solid #cbd6df;padding:5px 7px;vertical-align:top;font-size:11px;line-height:1.3;color:#1f2b38;min-height:28px">${esc(value) || "&nbsp;"}</td>
</tr>`;
}

/**
 * @param {object} rawVoucher
 * @param {{ stampAbsoluteUrl?: string }} [options]
 */
export function buildTransferVoucherEmailHtml(rawVoucher, options = {}) {
  const data = normalizeTransferVoucherData(rawVoucher);
  const opts = {
    bilingual: Boolean(data.bilingual),
    locale: data.locale || "el",
  };
  const agreement = [formatDateDisplay(data.agreementDate), data.agreementTime]
    .filter(Boolean)
    .join(" ");
  const title = formatVoucherLabel("title", opts);
  const agreementLabel = formatVoucherLabel("agreementDateTime", opts);
  const stampLabel = formatVoucherLabel("companyStamp", opts);
  const signLabel = formatVoucherLabel("customerSignature", opts);
  const stampUrl = options.stampAbsoluteUrl || "";

  const left = [
    row("lessee", data.lessee, opts),
    row("lesseeDetails", data.lesseeDetails, opts),
    row("dateOfService", formatDateDisplay(data.dateOfService), opts),
    row("pickUpPoint", data.pickUpPoint, opts),
    row("rentalDuration", data.rentalDuration, opts),
    row("vehicleType", data.vehicleType, opts),
    row("vehicleRegNum", data.vehicleRegNum, opts),
    row("driverName", data.driverName, opts),
  ].join("");

  const right = [
    row("clientName", data.clientName, opts),
    row("startingPoint", data.startingPoint, opts),
    row("pickUpTime", data.pickUpTime, opts),
    row("endingTime", data.endingTime, opts),
    row("passengers", data.passengers, opts),
    row("driverLicenseNo", data.driverLicenseNo, opts),
    row("driverIdNo", data.driverIdNo, opts),
    row("amount", data.amount, opts),
  ].join("");

  return `<!DOCTYPE html>
<html lang="el">
<head><meta charset="UTF-8"><title>${esc(title.primary)}</title></head>
<body style="margin:0;padding:16px;font-family:Arial,Helvetica,sans-serif;color:#1f2b38;background:#fff">
  <div style="max-width:800px;margin:0 auto">
    <div style="text-align:center;margin-bottom:8px">
      <div style="font-weight:800;letter-spacing:.4px;color:#073763;font-size:17px">${esc(data.companyHeaderTitle)}</div>
      <div style="white-space:pre-line;font-size:10px;color:#445566;margin-top:4px">${esc(data.companyInfo)}</div>
    </div>
    <div style="text-align:right;font-size:11px;margin-bottom:8px">
      <div style="font-weight:700;color:#073763">${esc(agreementLabel.primary)}${agreementLabel.secondary ? `<div style="font-weight:600">${esc(agreementLabel.secondary)}</div>` : ""}</div>
      <div>${esc(agreement)}</div>
    </div>
    <div style="text-align:center;font-weight:800;color:#073763;font-size:16px;margin-bottom:8px">${esc(title.primary)}${title.secondary ? `<div style="font-weight:600;color:#445566;font-size:12px">${esc(title.secondary)}</div>` : ""}</div>
    <table style="width:100%;border-collapse:collapse"><tr>
      <td style="width:50%;vertical-align:top;padding-right:4px"><table style="width:100%;border-collapse:collapse">${left}</table></td>
      <td style="width:50%;vertical-align:top;padding-left:4px"><table style="width:100%;border-collapse:collapse">${right}</table></td>
    </tr></table>
    <div style="margin-top:12px">
      <div style="background:#f4f7fb;color:#073763;font-weight:700;border:1px solid #cbd6df;border-bottom:none;padding:5px 7px;font-size:10.5px">${labelHtml("notes", opts)}</div>
      <div style="border:1px solid #cbd6df;min-height:72px;padding:8px;white-space:pre-wrap;font-size:11px">${esc(data.notes) || "&nbsp;"}</div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-top:12px"><tr>
      <td style="width:50%;vertical-align:top;padding-right:6px">
        <div style="border:1px solid #cbd6df;min-height:120px;padding:8px;text-align:center">
          <div style="font-size:10px;font-weight:700;color:#073763">${esc(stampLabel.primary)}</div>
          ${stampUrl ? `<img src="${esc(stampUrl)}" alt="stamp" style="margin-top:8px;max-width:92%;max-height:100px;object-fit:contain" />` : ""}
        </div>
      </td>
      <td style="width:50%;vertical-align:top;padding-left:6px">
        <div style="border:1px solid #cbd6df;min-height:120px;padding:8px;text-align:center">
          <div style="font-size:10px;font-weight:700;color:#073763">${esc(signLabel.primary)}</div>
        </div>
      </td>
    </tr></table>
  </div>
</body>
</html>`;
}
