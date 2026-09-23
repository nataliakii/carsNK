"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
  Checkbox,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { isMarketplaceRequestMode } from "@/domain/booking/bookingMode";
import { PAYMENT_LINK_REISSUE_REASONS } from "@/domain/orders/paymentLinkReissueReasons";
import {
  formatMarketplaceEuro,
  marketplaceFeeNotice,
  marketplaceSplitLabels,
} from "@/domain/orders/marketplaceFinancialSplit";
import { isMarketplaceFeePaid, paidPlatformAmountMinor, previewMarketplaceGrossRevision } from "@/domain/orders/marketplacePriceCorrection";
import { toMinorUnits } from "@/domain/money/minorUnits";

const REASONS = [
  {
    value: PAYMENT_LINK_REISSUE_REASONS.PAYMENT_LINK_EXPIRED,
    label: "Payment link expired",
  },
  {
    value: PAYMENT_LINK_REISSUE_REASONS.CUSTOMER_REQUESTED,
    label: "Customer requested a new link",
  },
  {
    value: PAYMENT_LINK_REISSUE_REASONS.PREVIOUS_CHECKOUT_FAILED,
    label: "Previous checkout failed",
  },
  {
    value: PAYMENT_LINK_REISSUE_REASONS.TECHNICAL_RETRY,
    label: "Technical retry",
  },
  {
    value: PAYMENT_LINK_REISSUE_REASONS.OTHER,
    label: "Other",
  },
];

function money(minor, currency) {
  if (minor == null) return "—";
  return `${String(currency || "EUR").toUpperCase()} ${(Number(minor) / 100).toFixed(2)}`;
}

function when(value) {
  if (!value) return "—";
  try {
    return new Date(value).toISOString().replace("T", " ").slice(0, 16) + " UTC";
  } catch {
    return "—";
  }
}

function Row({ label, value }) {
  return (
    <Typography variant="body2" sx={{ mb: 0.4 }}>
      <Box component="span" sx={{ color: "text.secondary", fontWeight: 600 }}>
        {label}:{" "}
      </Box>
      {value || "—"}
    </Typography>
  );
}

export default function MarketplacePaymentOpsPanel({ order, isSuperAdmin }) {
  const orderId = order?._id ? String(order._id) : "";
  const marketplace = isMarketplaceRequestMode(order?.bookingMode);
  const [view, setView] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [reason, setReason] = useState(
    PAYMENT_LINK_REISSUE_REASONS.PAYMENT_LINK_EXPIRED
  );
  const [reasonNote, setReasonNote] = useState("");
  const [complianceOverride, setComplianceOverride] = useState(false);
  const [complianceOverrideReason, setComplianceOverrideReason] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [correctionTotal, setCorrectionTotal] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [confirmZeroCollect, setConfirmZeroCollect] = useState(false);
  const splitLabels = marketplaceSplitLabels("en");

  const load = useCallback(async () => {
    if (!orderId || !isSuperAdmin) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/orders/${encodeURIComponent(orderId)}/payment-ops`,
        { cache: "no-store" }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Could not load payment details");
      }
      setView(json.view);
    } catch (err) {
      setError(err.message || "Could not load payment details");
    } finally {
      setLoading(false);
    }
  }, [orderId, isSuperAdmin]);

  const act = async (action) => {
    if (!orderId || busy) return;
    setBusy(action);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/orders/${encodeURIComponent(orderId)}/payment-ops`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            action === "retry_invalidation"
              ? { action }
              : action === "refund"
                ? {
                    action,
                    reason: refundReason,
                    idempotencyKey:
                      typeof crypto !== "undefined" && crypto.randomUUID
                        ? crypto.randomUUID()
                        : `${Date.now()}`,
                  }
                : action === "correct_price"
                  ? {
                      action,
                      totalPrice: Number(correctionTotal),
                      reason: correctionReason,
                      confirmZeroSupplierBalance: confirmZeroCollect,
                    }
                : {
                    action,
                    reason,
                    reasonNote,
                    idempotencyKey:
                      typeof crypto !== "undefined" && crypto.randomUUID
                        ? crypto.randomUUID()
                        : `${Date.now()}`,
                    complianceOverride: Boolean(complianceOverride),
                    complianceOverrideReason,
                  }
          ),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Action failed");
      }
      if (json.view) setView(json.view);
      else await load();
    } catch (err) {
      setError(err.message || "Action failed");
    } finally {
      setBusy("");
    }
  };

  const snapshot = view || null;
  const canIssue = Boolean(snapshot?.canIssueNewLink);
  const canResend = Boolean(snapshot?.canResendExisting && !canIssue);

  const history = useMemo(
    () => snapshot?.payment?.sessionHistory || [],
    [snapshot]
  );

  if (!isSuperAdmin || !marketplace || !orderId) return null;

  return (
    <Box
      sx={{
        mt: 1.5,
        mb: 1,
        p: 1.5,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        bgcolor: "background.paper",
      }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
        Marketplace payment
      </Typography>
      {!snapshot && (
        <Button size="small" onClick={load} disabled={loading}>
          {loading ? "Loading…" : "Load payment details"}
        </Button>
      )}
      {error ? (
        <Alert severity="error" sx={{ mt: 1, mb: 1 }}>
          {error}
        </Alert>
      ) : null}
      {snapshot ? (
        <Box sx={{ mt: 1 }}>
          <Row label="Status" value={snapshot.bookingStatus} />
          <Row
            label={splitLabels.total}
            value={formatMarketplaceEuro(snapshot.price?.grossMinor)}
          />
          <Row
            label={splitLabels.paidToRovaro}
            value={formatMarketplaceEuro(
              snapshot.price?.platformAmountMinor ?? snapshot.price?.prepaymentMinor
            )}
          />
          <Row
            label={splitLabels.collectFromCustomer}
            value={formatMarketplaceEuro(
              snapshot.price?.supplierBalanceMinor ?? snapshot.price?.balanceMinor
            )}
          />
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            {marketplaceFeeNotice(
              "en",
              snapshot.price?.platformAmountMinor ?? snapshot.price?.prepaymentMinor
            )}
          </Typography>
          <Row label="Payment" value={snapshot.payment?.status} />
          <Accordion disableGutters elevation={0} sx={{ mt: 1, "&:before": { display: "none" } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2">Technical details</Typography>
            </AccordionSummary>
            <AccordionDetails>
          <Row label="Hold status" value={snapshot.hold?.status} />
          <Row
            label="Hold expires"
            value={when(snapshot.hold?.holdExpiresAt)}
          />
          <Row
            label="Current Stripe session"
            value={snapshot.payment?.currentSessionId}
          />
          <Row
            label="Session expires"
            value={when(snapshot.payment?.expiresAt)}
          />
          <Row label="Paid" value={money(
              snapshot.payment?.paidAmountMinor,
              snapshot.payment?.currency
            )}
          />
          <Row
            label="Refunded"
            value={money(
              snapshot.payment?.refundedAmountMinor,
              snapshot.payment?.currency
            )}
          />
          <Row
            label="Net paid"
            value={money(
              snapshot.payment?.netPaidAmountMinor,
              snapshot.payment?.currency
            )}
          />
          <Row label="Refund status" value={snapshot.payment?.refundStatus} />
          <Row label="Dispute status" value={snapshot.payment?.disputeStatus} />
          <Row
            label="Last checkout error"
            value={snapshot.invalidation?.lastErrorCategory || snapshot.payment?.lastInvalidateErrorCategory}
          />
          <Row
            label="Last webhook error"
            value={snapshot.payment?.lastWebhookError}
          />
          {snapshot.invalidation?.pending || snapshot.invalidation?.canRetry ? (
            <Box sx={{ mt: 1, p: 1, bgcolor: "action.hover", borderRadius: 1 }}>
              <Row
                label="Invalidation"
                value={snapshot.invalidation.pending ? "pending retry" : "idle"}
              />
              <Row
                label="Session type"
                value={
                  snapshot.invalidation.sessionType === "alternative_offer"
                    ? "alternative offer"
                    : "normal booking"
                }
              />
              <Row
                label="Last attempt"
                value={when(snapshot.invalidation.lastAttemptAt)}
              />
              <Row
                label="Attempt count"
                value={String(snapshot.invalidation.attemptCount || 0)}
              />
              <Row
                label="Last error"
                value={snapshot.invalidation.lastErrorCategory}
              />
              <Button
                size="small"
                sx={{ mt: 1 }}
                variant="outlined"
                disabled={Boolean(busy) || !snapshot.invalidation.canRetry}
                onClick={() => act("retry_invalidation")}
              >
                {busy === "retry_invalidation" ? "Retrying…" : "Retry invalidation"}
              </Button>
            </Box>
          ) : null}
          <Row
            label="Payment emails"
            value={
              (snapshot.emails || [])
                .slice(0, 4)
                .map((row) => `${row.type} ${when(row.sentAt)}`)
                .join(" · ") || "none"
            }
          />
          {history.length ? (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 700 }}>
                Previous Stripe sessions
              </Typography>
              {history.map((row) => (
                <Typography key={row.sessionId} variant="caption" display="block">
                  {row.sessionId} — {row.status} — {when(row.archivedAt)}
                </Typography>
              ))}
            </Box>
          ) : null}
            </AccordionDetails>
          </Accordion>
          {snapshot.issueBlockedReason && !canIssue ? (
            <Alert severity="info" sx={{ mt: 1 }}>
              {snapshot.issueBlockedReason}
            </Alert>
          ) : null}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1.5 }}>
            <Button
              size="small"
              variant="outlined"
              disabled={!canResend || Boolean(busy)}
              onClick={() => act("resend")}
            >
              {busy === "resend" ? "Sending…" : "Resend existing email"}
            </Button>
            <TextField
              select
              size="small"
              label="Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              sx={{ minWidth: 220 }}
              disabled={!canIssue}
            >
              {REASONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <Button
              size="small"
              variant="contained"
              disabled={!canIssue || Boolean(busy)}
              onClick={() => act("reissue")}
            >
              {busy === "reissue" ? "Creating…" : "Issue new payment link"}
            </Button>
          </Stack>
          {reason === PAYMENT_LINK_REISSUE_REASONS.OTHER ? (
            <TextField
              size="small"
              fullWidth
              sx={{ mt: 1 }}
              label="Other reason"
              value={reasonNote}
              onChange={(e) => setReasonNote(e.target.value)}
            />
          ) : null}
          <FormControlLabel
            sx={{ mt: 1, alignItems: "flex-start" }}
            control={
              <Checkbox
                size="small"
                checked={complianceOverride}
                onChange={(e) => setComplianceOverride(e.target.checked)}
              />
            }
            label="Compliance override (audited)"
          />
          {complianceOverride ? (
            <TextField
              size="small"
              required
              fullWidth
              sx={{ mt: 1 }}
              label="Override reason"
              value={complianceOverrideReason}
              onChange={(e) => setComplianceOverrideReason(e.target.value)}
              helperText="Required. Does not change the price."
            />
          ) : null}
          {isSuperAdmin ? (
            <Box sx={{ mt: 2, p: 1.25, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                Correct rental total
              </Typography>
              {(() => {
                const paid = isMarketplaceFeePaid(order);
                const revisedGrossMinor =
                  correctionTotal === ""
                    ? null
                    : toMinorUnits(correctionTotal, order?.currency || "EUR");
                const preview =
                  revisedGrossMinor == null
                    ? { ok: false }
                    : previewMarketplaceGrossRevision({
                        order,
                        revisedGrossMinor,
                        reason: correctionReason || "preview",
                        actorRole: "SUPERADMIN",
                        confirmZeroSupplierBalance: confirmZeroCollect,
                      });
                const previous = Number(order?.authoritativePrice?.grossMinor || 0);
                const paidMinor = paidPlatformAmountMinor(order);
                return (
                  <>
                    <Typography variant="body2">Previous total: {formatMarketplaceEuro(previous)}</Typography>
                    {revisedGrossMinor != null ? (
                      <>
                        <Typography variant="body2">New total: {formatMarketplaceEuro(revisedGrossMinor)}</Typography>
                        <Typography variant="body2">Already paid: {formatMarketplaceEuro(paidMinor)}</Typography>
                        {preview.ok ? (
                          <Typography variant="body2">
                            New amount to collect: {formatMarketplaceEuro(preview.revisedSupplierBalanceMinor)}
                          </Typography>
                        ) : preview.code !== "reason_required" ? (
                          <Alert severity="error" sx={{ mt: 1 }}>{preview.message}</Alert>
                        ) : null}
                      </>
                    ) : null}
                    <TextField
                      size="small"
                      type="number"
                      fullWidth
                      sx={{ mt: 1 }}
                      label="New total (€)"
                      value={correctionTotal}
                      onChange={(e) => setCorrectionTotal(e.target.value)}
                    />
                    <TextField
                      size="small"
                      required
                      fullWidth
                      sx={{ mt: 1 }}
                      label="Reason"
                      value={correctionReason}
                      onChange={(e) => setCorrectionReason(e.target.value)}
                    />
                    {preview.code === "zero_supplier_unconfirmed" ? (
                      <FormControlLabel
                        control={
                          <Checkbox
                            size="small"
                            checked={confirmZeroCollect}
                            onChange={(e) => setConfirmZeroCollect(e.target.checked)}
                          />
                        }
                        label="Collect €0 from the customer"
                      />
                    ) : null}
                    <Button
                      size="small"
                      variant="contained"
                      sx={{ mt: 1 }}
                      disabled={!correctionTotal || !correctionReason.trim() || Boolean(busy)}
                      onClick={() =>
                        act("correct_price").catch(() => {})
                      }
                    >
                      {busy === "correct_price" ? "Saving…" : "Confirm price correction"}
                    </Button>
                    {paid ? (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                        The amount already paid online will not change.
                      </Typography>
                    ) : null}
                  </>
                );
              })()}
            </Box>
          ) : null}
          {String(snapshot.payment?.status || "") === "paid" &&
          Number(snapshot.payment?.netPaidAmountMinor || 0) > 0 ? (
            <Box sx={{ mt: 2, p: 1.25, border: "1px solid", borderColor: "warning.light", borderRadius: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                Refund
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                The booking fee is non-refundable.
              </Typography>
              <TextField
                size="small"
                required
                fullWidth
                label="Reason"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
              />
              <Button
                size="small"
                color="warning"
                variant="outlined"
                sx={{ mt: 1 }}
                disabled={!refundReason.trim() || Boolean(busy)}
                onClick={() => act("refund")}
              >
                {busy === "refund" ? "Refunding…" : "Refund"}
              </Button>
            </Box>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}
