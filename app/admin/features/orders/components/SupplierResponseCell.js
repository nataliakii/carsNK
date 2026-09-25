"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import {
  SUPPLIER_AVAILABILITY_STATEMENT,
  SUPPLIER_RESPONSE,
  SUPPLIER_RESPONSE_PAYLOAD,
  getSupplierResponseStatus,
  isSupplierResponseLocked,
} from "@/domain/orders/supplierResponseStatus";
import {
  contractorSupplierResponseCopy,
  PLATFORM_WORKFLOW_STAGE,
  resolvePlatformWorkflowStage,
} from "@/domain/admin/rovaroContractorAdmin";
import { ORDERS_TABLE_TEXT_LINE_CLAMP } from "@/domain/admin/ordersTableLayout";

/**
 * What the supplier owes Rovaro on this booking, and the one control that
 * answers it.
 *
 * A table row carries the primary decision and nothing else. Declining,
 * offering an equivalent replacement and asking Rovaro a question are the same
 * capabilities as before, reached one click deeper in the Booking Details
 * modal, which already hosts all three. Relocating an entry point is not
 * granting one: every action stays gated by
 * `domain/orders/bookingCapabilities.js` and re-checked server side.
 */

const ResponseStack = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: theme.spacing(0.5),
  minWidth: 0,
}));

const Headline = styled(Typography)(({ theme }) => ({
  fontWeight: theme.typography.fontWeightBold,
}));

const Note = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: ORDERS_TABLE_TEXT_LINE_CLAMP,
  overflow: "hidden",
}));

/** The primary decision and the way into the rest, side by side on one line. */
const DecisionRow = styled(Box)(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: theme.spacing(0.5),
}));

const CompactButton = styled(Button)({
  textTransform: "none",
});

function formatWhen(value) {
  if (!value) return "";
  const d = dayjs(value);
  return d.isValid() ? d.format("DD.MM.YYYY HH:mm") : "";
}

export default function SupplierResponseCell({
  order,
  isClient,
  busy,
  onRespond,
  onViewDetails,
}) {
  const { t } = useTranslation();
  const [statementOpen, setStatementOpen] = useState(false);

  if (!isClient) {
    return (
      <Typography variant="caption" color="text.secondary">
        —
      </Typography>
    );
  }

  const copy = contractorSupplierResponseCopy(order);
  const headline = t(copy.key, { defaultValue: copy.fallback });
  const status = getSupplierResponseStatus(order);
  const when = formatWhen(
    order?.companyEmailDecisionAt ||
      order?.partnerConfirmedAt ||
      order?.declinedAt ||
      order?.supplierRespondedAt
  );

  // The customer has paid: the answer is final and there is nothing to press.
  if (isSupplierResponseLocked(order)) {
    return (
      <Headline variant="caption" color="success.main">
        {headline}
      </Headline>
    );
  }

  const awaitingDecision =
    status === SUPPLIER_RESPONSE.AWAITING &&
    resolvePlatformWorkflowStage(order) ===
      PLATFORM_WORKFLOW_STAGE.AWAITING_SUPPLIER_CONFIRMATION;

  if (awaitingDecision) {
    return (
      <>
        <ResponseStack>
          <Headline variant="caption">{headline}</Headline>
          <DecisionRow>
            <CompactButton
              size="small"
              variant="contained"
              color="success"
              disabled={busy}
              onClick={() => setStatementOpen(true)}
            >
              {t("table.confirmVehicle", { defaultValue: "Confirm vehicle" })}
            </CompactButton>
            <CompactButton size="small" variant="text" onClick={onViewDetails}>
              {t("table.otherResponses", { defaultValue: "Other responses" })}
            </CompactButton>
          </DecisionRow>
        </ResponseStack>
        <Dialog
          open={statementOpen}
          onClose={() => setStatementOpen(false)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>
            {t("table.confirmRequestedVehicle", {
              defaultValue: "Confirm requested vehicle",
            })}
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2">
              {t("table.supplierConfirmationStatement", {
                defaultValue: SUPPLIER_AVAILABILITY_STATEMENT,
              })}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setStatementOpen(false)}>{t("table.reset")}</Button>
            <Button
              color="success"
              variant="contained"
              disabled={busy}
              onClick={() => {
                setStatementOpen(false);
                onRespond(SUPPLIER_RESPONSE_PAYLOAD.ACCEPTED);
              }}
            >
              {t("table.confirmRequestedVehicle", {
                defaultValue: "Confirm requested vehicle",
              })}
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }

  // The decision is recorded. The supplier-response endpoint refuses a second
  // decision once the booking has moved on, so the row states the answer and
  // offers no control that the server would reject.
  const declined = status === SUPPLIER_RESPONSE.DECLINED;
  const accepted = status === SUPPLIER_RESPONSE.ACCEPTED;
  const actorName =
    order?.partnerConfirmMeta?.actor?.name || order?.supplierRespondedByName || "";
  const reason = order?.declineReason || order?.supplierDeclineReason || "";
  const tone = declined ? "error.main" : accepted ? "success.main" : "text.primary";

  return (
    <ResponseStack>
      <Headline variant="caption" color={tone}>
        {headline}
      </Headline>
      {declined && reason ? (
        <Note variant="caption">
          {t("table.supplierReason")}: {reason}
        </Note>
      ) : null}
      {!declined && actorName ? (
        <Note variant="caption">{t("table.confirmedByAdmin", { name: actorName })}</Note>
      ) : null}
      {when ? <Note variant="caption">{when}</Note> : null}
    </ResponseStack>
  );
}
