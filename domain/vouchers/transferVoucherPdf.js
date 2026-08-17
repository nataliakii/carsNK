/**
 * Build A4 PDF for transfer voucher (email attachment).
 * Mirrors the print/email layout; embeds company stamp when available.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {
  formatDateDisplay,
  formatVoucherLabel,
  normalizeTransferVoucherData,
} from "@/domain/vouchers/transferVoucher";

const FONT_PATH = path.join(
  process.cwd(),
  "app/ui/email/pdf/fonts/NotoSans-Regular.ttf"
);

const COLOR = {
  text: rgb(0.12, 0.17, 0.22),
  muted: rgb(0.27, 0.33, 0.4),
  accent: rgb(0.027, 0.216, 0.388),
  labelBg: rgb(0.957, 0.969, 0.984),
  border: rgb(0.796, 0.839, 0.875),
};

function wrapText(text, font, size, maxWidth) {
  const source = String(text ?? "").replace(/\r\n/g, "\n");
  const paragraphs = source.split("\n");
  const lines = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = words[0];
    for (let i = 1; i < words.length; i += 1) {
      const candidate = `${line} ${words[i]}`;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        lines.push(line);
        line = words[i];
      }
    }
    lines.push(line);
  }
  return lines;
}

function drawWrapped({
  page,
  font,
  text,
  x,
  y,
  maxWidth,
  size = 10,
  lineHeight = 12,
  color = COLOR.text,
}) {
  const lines = wrapText(text, font, size, maxWidth);
  let currentY = y;
  for (const line of lines) {
    page.drawText(line || " ", {
      x,
      y: currentY,
      size,
      font,
      color,
    });
    currentY -= lineHeight;
  }
  return currentY;
}

function labelText(key, opts) {
  const { primary, secondary } = formatVoucherLabel(key, opts);
  return secondary ? `${primary}\n${secondary}` : primary;
}

async function loadStampBytes(stampSrc) {
  const raw = String(stampSrc || "").trim();
  if (!raw) return null;

  try {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      const res = await fetch(raw);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    }

    const rel = raw.replace(/^\//, "").split("?")[0];
    const filePath = path.join(process.cwd(), "public", rel);
    return await readFile(filePath);
  } catch {
    return null;
  }
}

function drawFieldRow({
  page,
  font,
  x,
  y,
  width,
  label,
  value,
  minHeight = 28,
}) {
  const labelW = Math.round(width * 0.38);
  const valueW = width - labelW;
  const pad = 5;
  const labelLines = wrapText(label, font, 8.5, labelW - pad * 2);
  const valueLines = wrapText(value || " ", font, 9.5, valueW - pad * 2);
  const contentH = Math.max(
    minHeight,
    Math.max(labelLines.length, valueLines.length) * 11 + pad * 2
  );

  page.drawRectangle({
    x,
    y: y - contentH,
    width: labelW,
    height: contentH,
    color: COLOR.labelBg,
    borderColor: COLOR.border,
    borderWidth: 0.7,
  });
  page.drawRectangle({
    x: x + labelW,
    y: y - contentH,
    width: valueW,
    height: contentH,
    borderColor: COLOR.border,
    borderWidth: 0.7,
  });

  let ly = y - pad - 9;
  for (const line of labelLines) {
    page.drawText(line || " ", {
      x: x + pad,
      y: ly,
      size: 8.5,
      font,
      color: COLOR.accent,
    });
    ly -= 11;
  }

  let vy = y - pad - 9;
  for (const line of valueLines) {
    page.drawText(line || " ", {
      x: x + labelW + pad,
      y: vy,
      size: 9.5,
      font,
      color: COLOR.text,
    });
    vy -= 11;
  }

  return y - contentH;
}

/**
 * @param {object} rawVoucher
 * @param {{ stampSrc?: string }} [options]
 * @returns {Promise<{ bytes: Uint8Array, fileName: string }>}
 */
export async function buildTransferVoucherPdf(rawVoucher, options = {}) {
  const data = normalizeTransferVoucherData(rawVoucher);
  const opts = {
    bilingual: Boolean(data.bilingual),
    locale: data.locale || "el",
  };

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const page = pdf.addPage([595.28, 841.89]);
  const fontBytes = await readFile(FONT_PATH);
  const font = await pdf.embedFont(fontBytes, { subset: true });

  const marginX = 36;
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();
  const contentWidth = pageWidth - marginX * 2;
  let y = pageHeight - 40;

  // Header
  const headerLines = wrapText(data.companyHeaderTitle || "", font, 14, contentWidth);
  for (const line of headerLines) {
    const w = font.widthOfTextAtSize(line, 14);
    page.drawText(line, {
      x: marginX + (contentWidth - w) / 2,
      y,
      size: 14,
      font,
      color: COLOR.accent,
    });
    y -= 17;
  }

  y = y - 2;
  {
    const infoLines = wrapText(data.companyInfo || "", font, 8.5, contentWidth);
    for (const line of infoLines) {
      const w = font.widthOfTextAtSize(line || " ", 8.5);
      page.drawText(line || " ", {
        x: marginX + (contentWidth - w) / 2,
        y,
        size: 8.5,
        font,
        color: COLOR.muted,
      });
      y -= 11;
    }
  }

  // Agreement date (right)
  y -= 8;
  const agreementLabel = labelText("agreementDateTime", opts);
  const agreement = [formatDateDisplay(data.agreementDate), data.agreementTime]
    .filter(Boolean)
    .join(" ");
  const agreeBlock = `${agreementLabel}\n${agreement}`;
  const agreeLines = wrapText(agreeBlock, font, 9, 180);
  let ay = y;
  for (const line of agreeLines) {
    const w = font.widthOfTextAtSize(line, 9);
    page.drawText(line, {
      x: pageWidth - marginX - w,
      y: ay,
      size: 9,
      font,
      color: COLOR.accent,
    });
    ay -= 11;
  }
  y = Math.min(y, ay) - 6;

  // Title
  const title = formatVoucherLabel("title", opts);
  {
    const w = font.widthOfTextAtSize(title.primary, 13);
    page.drawText(title.primary, {
      x: marginX + (contentWidth - w) / 2,
      y,
      size: 13,
      font,
      color: COLOR.accent,
    });
    y -= 16;
    if (title.secondary) {
      const w2 = font.widthOfTextAtSize(title.secondary, 10);
      page.drawText(title.secondary, {
        x: marginX + (contentWidth - w2) / 2,
        y,
        size: 10,
        font,
        color: COLOR.muted,
      });
      y -= 14;
    }
  }

  y -= 4;
  const gap = 8;
  const colW = (contentWidth - gap) / 2;
  const leftX = marginX;
  const rightX = marginX + colW + gap;

  const leftFields = [
    ["lessee", data.lessee],
    ["lesseeDetails", data.lesseeDetails],
    ["dateOfService", formatDateDisplay(data.dateOfService)],
    ["pickUpPoint", data.pickUpPoint],
    ["rentalDuration", data.rentalDuration],
    ["vehicleType", data.vehicleType],
    ["vehicleRegNum", data.vehicleRegNum],
    ["driverName", data.driverName],
  ];
  const rightFields = [
    ["clientName", data.clientName],
    ["startingPoint", data.startingPoint],
    ["pickUpTime", data.pickUpTime],
    ["endingTime", data.endingTime],
    ["passengers", data.passengers],
    ["driverLicenseNo", data.driverLicenseNo],
    ["driverIdNo", data.driverIdNo],
    ["amount", data.amount],
  ];

  let leftY = y;
  let rightY = y;
  for (const [key, value] of leftFields) {
    leftY = drawFieldRow({
      page,
      font,
      x: leftX,
      y: leftY,
      width: colW,
      label: labelText(key, opts),
      value,
    });
  }
  for (const [key, value] of rightFields) {
    rightY = drawFieldRow({
      page,
      font,
      x: rightX,
      y: rightY,
      width: colW,
      label: labelText(key, opts),
      value,
    });
  }

  y = Math.min(leftY, rightY) - 12;

  // Notes
  const notesLabel = labelText("notes", opts);
  const notesLabelH = 20;
  page.drawRectangle({
    x: marginX,
    y: y - notesLabelH,
    width: contentWidth,
    height: notesLabelH,
    color: COLOR.labelBg,
    borderColor: COLOR.border,
    borderWidth: 0.7,
  });
  page.drawText(notesLabel.split("\n")[0] || "Notes", {
    x: marginX + 6,
    y: y - 14,
    size: 9,
    font,
    color: COLOR.accent,
  });
  y -= notesLabelH;

  const notesBoxH = 70;
  page.drawRectangle({
    x: marginX,
    y: y - notesBoxH,
    width: contentWidth,
    height: notesBoxH,
    borderColor: COLOR.border,
    borderWidth: 0.7,
  });
  drawWrapped({
    page,
    font,
    text: data.notes || "",
    x: marginX + 6,
    y: y - 12,
    maxWidth: contentWidth - 12,
    size: 9.5,
    lineHeight: 12,
  });
  y -= notesBoxH + 12;

  // Stamp + signature boxes
  const boxH = 110;
  const boxW = (contentWidth - gap) / 2;
  page.drawRectangle({
    x: marginX,
    y: y - boxH,
    width: boxW,
    height: boxH,
    borderColor: COLOR.border,
    borderWidth: 0.7,
  });
  page.drawRectangle({
    x: marginX + boxW + gap,
    y: y - boxH,
    width: boxW,
    height: boxH,
    borderColor: COLOR.border,
    borderWidth: 0.7,
  });

  const stampLabel = formatVoucherLabel("companyStamp", opts);
  const signLabel = formatVoucherLabel("customerSignature", opts);
  {
    const w = font.widthOfTextAtSize(stampLabel.primary, 9);
    page.drawText(stampLabel.primary, {
      x: marginX + (boxW - w) / 2,
      y: y - 14,
      size: 9,
      font,
      color: COLOR.accent,
    });
  }
  {
    const w = font.widthOfTextAtSize(signLabel.primary, 9);
    page.drawText(signLabel.primary, {
      x: marginX + boxW + gap + (boxW - w) / 2,
      y: y - 14,
      size: 9,
      font,
      color: COLOR.accent,
    });
  }

  const stampSrc = options.stampSrc || data.stampSrc;
  const stampBytes = await loadStampBytes(stampSrc);
  if (stampBytes) {
    try {
      const isJpg =
        stampSrc.toLowerCase().includes(".jpg") ||
        stampSrc.toLowerCase().includes(".jpeg");
      const image = isJpg
        ? await pdf.embedJpg(stampBytes)
        : await pdf.embedPng(stampBytes);
      const maxW = boxW - 24;
      const maxH = boxH - 28;
      const scale = Math.min(maxW / image.width, maxH / image.height, 1);
      const iw = image.width * scale;
      const ih = image.height * scale;
      page.drawImage(image, {
        x: marginX + (boxW - iw) / 2,
        y: y - boxH + 10,
        width: iw,
        height: ih,
        opacity: 0.92,
      });
    } catch {
      // stamp optional
    }
  }

  const bytes = await pdf.save();
  const datePart =
    String(data.dateOfService || data.agreementDate || "")
      .replace(/[^0-9]/g, "")
      .slice(0, 8) || new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const namePart = String(data.clientName || data.lessee || "voucher")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const fileName = `transfer-voucher-${datePart}${namePart ? `-${namePart}` : ""}.pdf`;

  return { bytes, fileName };
}
