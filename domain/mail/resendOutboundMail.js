import { sendEmailDirect } from "@/lib/email/sendDirect";
import { connectToDB } from "@lib/database";
import {
  renderAdminOrderNotificationEmail,
  renderCustomerOfficialConfirmationEmail,
  renderCustomerOrderConfirmationEmail,
} from "@/app/ui/email/renderEmail";
import { buildCustomerOfficialConfirmationPdf } from "@/app/ui/email/pdf/customerOfficialConfirmationPdf";
import { MAIL_RENDER_KEY } from "./mailTypes";
import { getMailLogById } from "./queryMailLog";

async function rebuildFromRenderKey(doc) {
  const key = String(doc.renderKey || "").trim();
  const payload = doc.payload && typeof doc.payload === "object" ? doc.payload : null;

  if (key === MAIL_RENDER_KEY.CUSTOMER_ORDER_CONFIRMATION && payload) {
    const rendered = renderCustomerOrderConfirmationEmail(payload);
    return {
      title: rendered.title,
      message: rendered.text,
      html: rendered.html,
      attachments: [],
    };
  }

  if (key === MAIL_RENDER_KEY.CUSTOMER_OFFICIAL_CONFIRMATION && payload) {
    const rendered = renderCustomerOfficialConfirmationEmail(payload);
    const attachments = [];
    if (rendered.pdfData && rendered.pdfFileName) {
      const pdfBytes = await buildCustomerOfficialConfirmationPdf(rendered.pdfData);
      attachments.push({
        filename: rendered.pdfFileName,
        content: Buffer.from(pdfBytes),
        contentType: "application/pdf",
      });
    }
    return {
      title: rendered.title,
      message: rendered.text,
      html: rendered.html,
      attachments,
    };
  }

  if (key === MAIL_RENDER_KEY.ADMIN_ORDER_NOTIFICATION && payload) {
    const title = payload.title || doc.subject;
    const body = payload.body || doc.text || "";
    return {
      title,
      message: body,
      html: renderAdminOrderNotificationEmail(title, body, payload.actions),
      attachments: [],
    };
  }

  return null;
}

export async function rebuildMailForResend(doc) {
  const rendered = await rebuildFromRenderKey(doc);
  if (rendered) return rendered;

  const html = typeof doc.html === "string" && doc.html.trim() ? doc.html : undefined;
  const message = typeof doc.text === "string" ? doc.text : "";
  return {
    title: doc.subject || "",
    message,
    html,
    attachments: [],
  };
}

/**
 * Re-send a logged email using current templates when a render key exists.
 * The new send is recorded in MailLog via sendEmailDirect.
 */
export async function resendMailLog(id) {
  await connectToDB();
  const doc = await getMailLogById(id);
  if (!doc) {
    return { ok: false, status: 404, message: "Mail log not found" };
  }

  const rebuilt = await rebuildMailForResend(doc);
  await sendEmailDirect({
    title: rebuilt.title,
    message: rebuilt.message,
    html: rebuilt.html,
    to: Array.isArray(doc.to) ? doc.to : [],
    cc: Array.isArray(doc.cc) ? doc.cc : [],
    attachments: rebuilt.attachments,
    meta: {
      type: doc.type,
      orderId: doc.orderId ? String(doc.orderId) : null,
      companyId: doc.companyId ? String(doc.companyId) : null,
      renderKey: doc.renderKey || "",
      payload: doc.payload,
      resentFromId: String(doc._id),
    },
  });

  return { ok: true };
}
