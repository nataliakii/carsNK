import { createTransferCheckoutSession } from "@/domain/transfers/stripeCheckout";
import { isStripeConfigured } from "@config/stripe";
import { notifyTransferClaimed } from "@/domain/transfers/notifyTransferEmails";
import { resolveCompanyTransferPaymentPolicy } from "@/domain/transfers/companyPaymentPolicy";
import { formatMinor } from "@/domain/money/minorUnits";

/**
 * Post-claim pipeline: company payment policy → Stripe and/or on-site + emails.
 */
export async function afterTransferClaimed({ transfer, company }) {
  let paymentUrl = null;
  let paymentError = null;
  let updatedTransfer = transfer;
  let onSiteAmountMinor = 0;
  let collectionMode = null;

  const policy = resolveCompanyTransferPaymentPolicy(company, {
    stripeConfigured: isStripeConfigured(),
  });
  collectionMode = policy.mode;

  try {
    const pay = await createTransferCheckoutSession(String(transfer._id), {
      company,
    });
    if (pay.ok) {
      paymentUrl = pay.url || null;
      updatedTransfer = pay.transfer || transfer;
      onSiteAmountMinor = Number(pay.onSiteAmountMinor) ||
        Number(pay.transfer?.payment?.onSiteAmountMinor) ||
        0;
      collectionMode = pay.mode || collectionMode;
    } else {
      paymentError = pay.message || pay.code;
      console.warn(
        "[transfer claim] payment setup skipped:",
        pay.code,
        pay.message
      );
    }
  } catch (err) {
    paymentError = err?.message || String(err);
    console.error("[transfer claim] payment setup failed", paymentError);
  }

  const currency =
    updatedTransfer?.quoteSnapshot?.currency ||
    updatedTransfer?.payment?.currency ||
    "EUR";
  const onSiteLabel =
    onSiteAmountMinor > 0
      ? formatMinor(onSiteAmountMinor, currency)
      : null;

  try {
    await notifyTransferClaimed({
      transfer: updatedTransfer,
      company,
      paymentUrl,
      paymentError,
      collectionMode,
      onSiteAmountLabel: onSiteLabel,
    });
  } catch (err) {
    console.error("[transfer claim] notify failed", err?.message || err);
  }

  return {
    transfer: updatedTransfer,
    paymentUrl,
    paymentError,
    collectionMode,
    onSiteAmountMinor,
  };
}
