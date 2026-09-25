"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
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
  askRovaroAboutBooking,
  loadAlternativeCars,
  offerEquivalentReplacement,
  suggestAlternativeVehicle,
} from "@/app/admin/features/orders/actions/supplierBookingActions";
import {
  contractorSupplierResponseCopy,
  PLATFORM_WORKFLOW_STAGE,
  resolvePlatformWorkflowStage,
} from "@/domain/admin/rovaroContractorAdmin";
import { REPLACEMENT_SOURCE } from "@/domain/booking/equivalentReplacementCopy";

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
  onChanged,
}) {
  const { t } = useTranslation();
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [changeOpen, setChangeOpen] = useState(false);
  const [statementOpen, setStatementOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [alternativeOpen, setAlternativeOpen] = useState(false);
  const [alternativeCars, setAlternativeCars] = useState([]);
  const [proposedCarId, setProposedCarId] = useState("");
  const [replacementSource, setReplacementSource] = useState(REPLACEMENT_SOURCE.COMPANY_VEHICLE);
  const [replacementClass, setReplacementClass] = useState("");
  const [replacementTransmission, setReplacementTransmission] = useState("");
  const [replacementSeats, setReplacementSeats] = useState("");
  const [replacementLuggage, setReplacementLuggage] = useState("");
  const [replacementModel, setReplacementModel] = useState("");
  const [alternativeReason, setAlternativeReason] = useState("");
  const [localError, setLocalError] = useState("");

  if (!isClient) {
    return (
      <Typography variant="caption" color="text.secondary">
        —
      </Typography>
    );
  }

  const status = getSupplierResponseStatus(order);
  const locked = isSupplierResponseLocked(order);
  const actorName =
    order?.partnerConfirmMeta?.actor?.name ||
    order?.supplierRespondedByName ||
    "";
  const when = formatWhen(
    order?.companyEmailDecisionAt ||
      order?.partnerConfirmedAt ||
      order?.declinedAt ||
      order?.supplierRespondedAt
  );

  if (locked) {
    return (
      <Typography variant="caption" color="success.main" sx={{ fontWeight: 700 }}>
        {t(contractorSupplierResponseCopy(order).key, {
          defaultValue: contractorSupplierResponseCopy(order).fallback,
        })}
      </Typography>
    );
  }

  const accept = () => {
    setStatementOpen(false);
    onRespond(SUPPLIER_RESPONSE_PAYLOAD.ACCEPTED);
  };
  const decline = () => {
    const trimmed = reason.trim();
    if (!trimmed) return;
    onRespond(SUPPLIER_RESPONSE_PAYLOAD.DECLINED, trimmed);
    setDeclineOpen(false);
    setReason("");
  };

  if (
    status === SUPPLIER_RESPONSE.AWAITING &&
    resolvePlatformWorkflowStage(order) ===
      PLATFORM_WORKFLOW_STAGE.AWAITING_SUPPLIER_CONFIRMATION
  ) {
    return (
      <>
        <Stack spacing={0.5} alignItems="center">
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            {t("table.supplierAwaitingYours", { defaultValue: "Awaiting your response" })}
          </Typography>
          <Button
            size="small"
            variant="contained"
            color="success"
            disabled={busy}
            onClick={() => setStatementOpen(true)}
          >
            {t("table.confirmRequestedVehicle", {
              defaultValue: "Confirm requested vehicle",
            })}
          </Button>
          <Button
            size="small"
            variant="outlined"
            disabled={busy}
            onClick={async () => {
              setLocalError("");
              setAlternativeOpen(true);
              const loaded = await loadAlternativeCars(order._id);
              if (!loaded.ok) {
                setLocalError(loaded.message);
                return;
              }
              setAlternativeCars(loaded.cars || []);
            }}
          >
            {t("table.offerEquivalentReplacement", {
              defaultValue: "Offer equivalent replacement",
            })}
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            disabled={busy}
            onClick={() => setDeclineOpen(true)}
          >
            {t("table.declineRequest", { defaultValue: "Decline request" })}
          </Button>
          <Button size="small" variant="text" onClick={onViewDetails}>
            {t("table.viewDetails", { defaultValue: "View request details" })}
          </Button>
          <Button size="small" variant="text" onClick={() => setAskOpen(true)}>
            {t("table.askRovaro", { defaultValue: "Ask Rovaro a question" })}
          </Button>
          {localError ? (
            <Typography variant="caption" color="error">
              {localError}
            </Typography>
          ) : null}
        </Stack>
        <Dialog open={statementOpen} onClose={() => setStatementOpen(false)} fullWidth maxWidth="sm">
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
            <Button color="success" variant="contained" disabled={busy} onClick={accept}>
              {t("table.confirmRequestedVehicle", {
                defaultValue: "Confirm requested vehicle",
              })}
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog open={askOpen} onClose={() => setAskOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>{t("table.askRovaro", { defaultValue: "Ask Rovaro a question" })}</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              fullWidth
              multiline
              minRows={3}
              margin="dense"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAskOpen(false)}>{t("table.reset")}</Button>
            <Button
              variant="contained"
              disabled={!question.trim()}
              onClick={async () => {
                const sent = await askRovaroAboutBooking(order._id, question.trim());
                if (!sent.ok) {
                  setLocalError(sent.message);
                  return;
                }
                setQuestion("");
                setAskOpen(false);
              }}
            >
              {t("table.askRovaro", { defaultValue: "Ask Rovaro a question" })}
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog open={alternativeOpen} onClose={() => setAlternativeOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>
            {t("table.offerEquivalentReplacement", {
              defaultValue: "Offer equivalent replacement",
            })}
          </DialogTitle>
          <DialogContent>
            <TextField
              select
              fullWidth
              margin="dense"
              label="Replacement source"
              value={replacementSource}
              onChange={(e) => setReplacementSource(e.target.value)}
              SelectProps={{ native: true }}
            >
              <option value={REPLACEMENT_SOURCE.COMPANY_VEHICLE}>Another company vehicle</option>
              <option value={REPLACEMENT_SOURCE.EXTERNAL_VEHICLE}>Unlisted vehicle</option>
              <option value={REPLACEMENT_SOURCE.GUARANTEED_CLASS}>
                Guaranteed same or higher class
              </option>
            </TextField>
            {replacementSource === REPLACEMENT_SOURCE.COMPANY_VEHICLE ? (
              <TextField
                select
                fullWidth
                margin="dense"
                label={t("table.carModel")}
                value={proposedCarId}
                onChange={(e) => setProposedCarId(e.target.value)}
                SelectProps={{ native: true }}
              >
                <option value="" />
                {alternativeCars.map((car) => (
                  <option key={car.carId || car._id} value={car.carId || car._id}>
                    {car.name || car.model || car.carId}
                  </option>
                ))}
              </TextField>
            ) : (
              <>
                <TextField
                  fullWidth
                  margin="dense"
                  label="Class"
                  value={replacementClass}
                  onChange={(e) => setReplacementClass(e.target.value)}
                />
                <TextField
                  fullWidth
                  margin="dense"
                  label="Transmission"
                  value={replacementTransmission}
                  onChange={(e) => setReplacementTransmission(e.target.value)}
                />
                <TextField
                  fullWidth
                  margin="dense"
                  label="Seats"
                  value={replacementSeats}
                  onChange={(e) => setReplacementSeats(e.target.value)}
                />
                <TextField
                  fullWidth
                  margin="dense"
                  label="Luggage"
                  value={replacementLuggage}
                  onChange={(e) => setReplacementLuggage(e.target.value)}
                />
                {replacementSource === REPLACEMENT_SOURCE.EXTERNAL_VEHICLE ? (
                  <TextField
                    fullWidth
                    margin="dense"
                    label="Make and model"
                    value={replacementModel}
                    onChange={(e) => setReplacementModel(e.target.value)}
                  />
                ) : null}
              </>
            )}
            <TextField
              fullWidth
              multiline
              minRows={2}
              margin="dense"
              label={t("table.supplierReason")}
              value={alternativeReason}
              onChange={(e) => setAlternativeReason(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAlternativeOpen(false)}>{t("table.reset")}</Button>
            <Button
              variant="contained"
              disabled={busy}
              onClick={async () => {
                if (replacementSource === REPLACEMENT_SOURCE.COMPANY_VEHICLE) {
                  if (!proposedCarId) return;
                  const offered = await suggestAlternativeVehicle(
                    order._id,
                    proposedCarId,
                    alternativeReason
                  );
                  if (!offered.ok) {
                    setLocalError(offered.message);
                    return;
                  }
                  setAlternativeOpen(false);
                  if (typeof onChanged === "function") await onChanged();
                  return;
                }
                const proposal = {
                  replacementSource,
                  category: replacementClass,
                  transmission: replacementTransmission,
                  seats: Number(replacementSeats),
                  luggage: replacementLuggage === "" ? null : Number(replacementLuggage),
                  model: replacementModel,
                  totalPrice: order.totalPrice,
                  supplierMessage: alternativeReason,
                  reason: alternativeReason,
                };
                const offered = await offerEquivalentReplacement(order._id, proposal);
                if (!offered.ok) {
                  setLocalError(offered.message);
                  return;
                }
                setAlternativeOpen(false);
                if (typeof onChanged === "function") await onChanged();
              }}
            >
              {t("table.offerEquivalentReplacement", {
                defaultValue: "Offer equivalent replacement",
              })}
            </Button>
          </DialogActions>
        </Dialog>
        <DeclineDialog
          open={declineOpen}
          reason={reason}
          setReason={setReason}
          onClose={() => setDeclineOpen(false)}
          onConfirm={decline}
          busy={busy}
          t={t}
        />
      </>
    );
  }

  if (status === SUPPLIER_RESPONSE.ACCEPTED) {
    return (
      <>
        <Stack spacing={0.25} alignItems="flex-start">
          <Typography variant="caption" sx={{ fontWeight: 700, color: "success.main" }}>
            {t(contractorSupplierResponseCopy(order).key, {
              defaultValue: contractorSupplierResponseCopy(order).fallback,
            })}
          </Typography>
          {actorName ? (
            <Typography variant="caption" color="text.secondary">
              {t("table.confirmedByAdmin", { name: actorName })}
            </Typography>
          ) : null}
          {when ? (
            <Typography variant="caption" color="text.secondary">
              {when}
            </Typography>
          ) : null}
          <Button
            size="small"
            variant="text"
            disabled={busy}
            onClick={() => setChangeOpen(true)}
            sx={{ textTransform: "none", fontSize: "0.65rem", minWidth: 0, px: 0 }}
          >
            {t("table.changeResponse")}
          </Button>
        </Stack>
        <Dialog open={changeOpen} onClose={() => setChangeOpen(false)}>
          <DialogTitle>{t("table.changeResponse")}</DialogTitle>
          <DialogContent>
            <Typography variant="body2">{t("table.changeResponseConfirm")}</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setChangeOpen(false)}>{t("table.reset")}</Button>
            <Button
              color="error"
              onClick={() => {
                setChangeOpen(false);
                setDeclineOpen(true);
              }}
            >
              {t("table.cannotProvide")}
            </Button>
          </DialogActions>
        </Dialog>
        <DeclineDialog
          open={declineOpen}
          reason={reason}
          setReason={setReason}
          onClose={() => setDeclineOpen(false)}
          onConfirm={decline}
          busy={busy}
          t={t}
        />
      </>
    );
  }

  if (status !== SUPPLIER_RESPONSE.DECLINED) {
    const copy = contractorSupplierResponseCopy(order);
    return (
      <Typography variant="caption" sx={{ fontWeight: 700 }}>
        {t(copy.key, { defaultValue: copy.fallback })}
      </Typography>
    );
  }

  return (
    <Stack spacing={0.25} alignItems="flex-start">
      <Typography variant="caption" sx={{ fontWeight: 700, color: "error.main" }}>
        {t("table.toneDeclined", { defaultValue: "Declined" })}
      </Typography>
      {order.declineReason || order.supplierDeclineReason ? (
        <Typography variant="caption" color="text.secondary">
          {t("table.supplierReason")}: {order.declineReason || order.supplierDeclineReason}
        </Typography>
      ) : null}
      {when ? (
        <Typography variant="caption" color="text.secondary">
          {t("table.sentAt", { when })}
        </Typography>
      ) : null}
      <Button
        size="small"
        variant="text"
        disabled={busy}
        onClick={accept}
        sx={{ textTransform: "none", fontSize: "0.65rem", minWidth: 0, px: 0 }}
      >
        {t("table.changeResponse")}
      </Button>
    </Stack>
  );
}

function DeclineDialog({ open, reason, setReason, onClose, onConfirm, busy, t }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t("table.cannotProvide")}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          required
          multiline
          minRows={2}
          margin="dense"
          label={t("table.supplierReason")}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("table.reset")}</Button>
        <Button
          color="error"
          variant="contained"
          disabled={busy || !String(reason || "").trim()}
          onClick={onConfirm}
        >
          {t("table.cannotProvide")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
