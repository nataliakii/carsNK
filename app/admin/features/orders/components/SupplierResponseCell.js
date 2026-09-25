"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  Menu,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import {
  SUPPLIER_AVAILABILITY_STATEMENT,
  SUPPLIER_RESPONSE,
  SUPPLIER_RESPONSE_PAYLOAD,
  getSupplierResponseStatus,
  isSupplierResponseLocked,
} from "@/domain/orders/supplierResponseStatus";
import { askRovaroAboutBooking } from "@/app/admin/features/orders/actions/supplierBookingActions";
import {
  REPLACEMENT_KIND,
  loadReplacementFleetCars,
  proposeEquivalentReplacement,
} from "@/app/admin/features/orders/actions/bookingDetailsActions";
import {
  contractorSupplierResponseCopy,
  PLATFORM_WORKFLOW_STAGE,
  resolvePlatformWorkflowStage,
} from "@/domain/admin/rovaroContractorAdmin";

const COMPACT_BTN_SX = {
  textTransform: "none",
  fontSize: "0.7rem",
  fontWeight: 700,
  minWidth: 0,
  px: 1,
  py: 0,
  height: 26,
  lineHeight: 1.2,
};

function formatWhen(value) {
  if (!value) return "";
  const d = dayjs(value);
  return d.isValid() ? d.format("DD.MM.YYYY HH:mm") : "";
}

function stopRowOpen(e) {
  e?.stopPropagation?.();
}

function responseInfoTitle(t, actorName, when) {
  const who = actorName
    ? t("table.confirmedByAdmin", { name: actorName })
    : t("table.responseActorUnknown", {
        defaultValue: "No confirmer recorded",
      });
  return when ? `${who} · ${when}` : who;
}

function CompactResponseStatus({ label, when, infoTitle, color = "success.main" }) {
  return (
    <Stack
      direction="row"
      spacing={0.35}
      alignItems="flex-start"
      onClick={stopRowOpen}
      onDoubleClick={stopRowOpen}
      sx={{ minWidth: 0 }}
    >
      <Stack spacing={0} sx={{ minWidth: 0 }}>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            color,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </Typography>
        {when ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ lineHeight: 1.2, whiteSpace: "nowrap", fontSize: "0.65rem" }}
          >
            {when}
          </Typography>
        ) : null}
      </Stack>
      <Tooltip title={infoTitle}>
        <InfoOutlinedIcon
          sx={{ fontSize: 14, color: "text.secondary", mt: 0.15, flexShrink: 0 }}
        />
      </Tooltip>
    </Stack>
  );
}

export default function SupplierResponseCell({
  order,
  isClient,
  busy,
  onRespond,
  onViewDetails,
  onChanged,
  hideAwaitingLabel = false,
  compact = false,
}) {
  const { t } = useTranslation();
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [statementOpen, setStatementOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [alternativeOpen, setAlternativeOpen] = useState(false);
  const [alternativeReason, setAlternativeReason] = useState("");
  const [guaranteeAck, setGuaranteeAck] = useState(false);
  const [proposedCarId, setProposedCarId] = useState("");
  const [fleetCars, setFleetCars] = useState([]);
  const [fleetLoading, setFleetLoading] = useState(false);
  const [localError, setLocalError] = useState("");
  const [moreAnchor, setMoreAnchor] = useState(null);

  useEffect(() => {
    if (!alternativeOpen || !order?._id) return undefined;
    let alive = true;
    setFleetLoading(true);
    setFleetCars([]);
    setProposedCarId("");
    loadReplacementFleetCars(order._id).then((result) => {
      if (!alive) return;
      setFleetLoading(false);
      if (!result?.ok) {
        setLocalError(result?.message || "Could not load fleet cars");
        return;
      }
      setFleetCars(Array.isArray(result.cars) ? result.cars : []);
    });
    return () => {
      alive = false;
    };
  }, [alternativeOpen, order?._id]);

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
  const infoTitle = responseInfoTitle(t, actorName, when);
  const shortCopy = contractorSupplierResponseCopy(order);
  const shortLabel = t(shortCopy.key, { defaultValue: shortCopy.fallback });

  if (locked) {
    return (
      <CompactResponseStatus
        label={shortLabel}
        when={when}
        infoTitle={infoTitle}
      />
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
    const openReplacement = () => {
      setMoreAnchor(null);
      setLocalError("");
      setGuaranteeAck(false);
      setAlternativeReason("");
      setProposedCarId("");
      setAlternativeOpen(true);
    };

    const requestedClass =
      order?.vehicleSnapshot?.class ||
      order?.car?.class ||
      order?.carClass ||
      "—";
    const requestedTransmission =
      order?.vehicleSnapshot?.transmission ||
      order?.car?.transmission ||
      order?.transmission ||
      "—";
    const requestedPrice =
      order?.totalPrice != null ? `€${Number(order.totalPrice).toFixed(2)}` : "—";
    const fleetSelected = Boolean(proposedCarId);
    const replacementReady = fleetSelected || guaranteeAck;

    const awaitingDialogs = (
      <>
        <Dialog open={statementOpen} onClose={() => setStatementOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>
            {t("table.confirmRequestedVehicle", {
              defaultValue: "Confirm requested vehicle",
            })}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={1.5} sx={{ pt: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                {t("table.supplierConfirmationObligation", {
                  defaultValue:
                    "You are committing to provide this car. If something changes, you must offer an equivalent replacement — do not leave the customer without a vehicle.",
                })}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {t("table.supplierConfirmationStatement", {
                  defaultValue: SUPPLIER_AVAILABILITY_STATEMENT,
                })}
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setStatementOpen(false)}>{t("table.reset")}</Button>
            <Button color="success" variant="contained" disabled={busy} onClick={accept}>
              {t("table.supplierConfirmationConfirm", {
                defaultValue: "Yes, I commit to provide this vehicle",
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
            <Stack spacing={1.25} sx={{ pt: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                {t("bookingDetails.replacementDialog.introFleet", {
                  defaultValue:
                    "Pick a car from your available fleet to move this booking onto it (same as calendar), or guarantee class only if the exact car is not listed yet.",
                })}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {t("bookingDetails.replacementDialog.reminderTitle", {
                  defaultValue: "Requested vehicle terms",
                })}
              </Typography>
              <Typography variant="body2">
                {t("bookingDetails.replacementDialog.reminderClass", {
                  defaultValue: "Class: {{class}}",
                  class: requestedClass,
                })}
              </Typography>
              <Typography variant="body2">
                {t("bookingDetails.replacementDialog.reminderTransmission", {
                  defaultValue: "Transmission: {{transmission}}",
                  transmission: requestedTransmission,
                })}
              </Typography>
              <Typography variant="body2">
                {t("bookingDetails.replacementDialog.reminderPrice", {
                  defaultValue: "Total price ceiling: {{price}}",
                  price: requestedPrice,
                })}
              </Typography>
              {fleetLoading ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <CircularProgress size={18} />
                  <Typography variant="body2" color="text.secondary">
                    {t("bookingDetails.replacementDialog.loadingFleet", {
                      defaultValue: "Loading available cars…",
                    })}
                  </Typography>
                </Stack>
              ) : (
                <FormControl fullWidth size="small" margin="dense">
                  <InputLabel id="supplier-replacement-fleet-label">
                    {t("bookingDetails.replacementDialog.kinds.COMPANY_VEHICLE", {
                      defaultValue: "A vehicle from your fleet",
                    })}
                  </InputLabel>
                  <Select
                    labelId="supplier-replacement-fleet-label"
                    label={t("bookingDetails.replacementDialog.kinds.COMPANY_VEHICLE", {
                      defaultValue: "A vehicle from your fleet",
                    })}
                    value={proposedCarId}
                    onChange={(e) => {
                      const next = String(e.target.value || "");
                      setProposedCarId(next);
                      if (next) setGuaranteeAck(false);
                    }}
                  >
                    <MenuItem value="">
                      <em>
                        {t("bookingDetails.replacementDialog.fleetPlaceholder", {
                          defaultValue: "Choose a vehicle",
                        })}
                      </em>
                    </MenuItem>
                    {fleetCars.map((row) => (
                      <MenuItem key={row.carId} value={row.carId}>
                        {[row.name, row.carNumber, row.category, row.transmission]
                          .filter(Boolean)
                          .join(" · ")}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              <FormControlLabel
                control={
                  <Checkbox
                    checked={guaranteeAck}
                    disabled={fleetSelected}
                    onChange={(e) => {
                      setGuaranteeAck(e.target.checked);
                      if (e.target.checked) setProposedCarId("");
                    }}
                  />
                }
                label={t("bookingDetails.replacementDialog.guaranteeAck", {
                  defaultValue:
                    "I confirm the replacement will be the same or higher class, the same transmission, and the same or a lower total price.",
                })}
                sx={{
                  alignItems: "flex-start",
                  m: 0,
                  "& .MuiFormControlLabel-label": { fontSize: "0.875rem" },
                }}
              />
              <TextField
                fullWidth
                multiline
                minRows={2}
                margin="dense"
                label={t("bookingDetails.replacementDialog.comment", {
                  defaultValue: "Comment for the customer",
                })}
                value={alternativeReason}
                onChange={(e) => setAlternativeReason(e.target.value)}
                helperText={t("bookingDetails.replacementDialog.commentHelp", {
                  defaultValue: "Optional note for the customer.",
                })}
              />
              {localError ? (
                <Typography variant="caption" color="error">
                  {localError}
                </Typography>
              ) : null}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAlternativeOpen(false)}>{t("table.reset")}</Button>
            <Button
              variant="contained"
              disabled={busy || !replacementReady}
              onClick={async () => {
                const offered = await proposeEquivalentReplacement(order._id, {
                  replacementSource: fleetSelected
                    ? REPLACEMENT_KIND.COMPANY_VEHICLE
                    : REPLACEMENT_KIND.GUARANTEED_CLASS,
                  proposedCarId,
                  guaranteeAck: !fleetSelected && guaranteeAck,
                  supplierMessage: alternativeReason,
                });
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

    if (compact) {
      return (
        <>
          <Stack
            direction="row"
            spacing={0.5}
            alignItems="center"
            onClick={stopRowOpen}
            onDoubleClick={stopRowOpen}
          >
            <Button
              size="small"
              variant="contained"
              color="success"
              disabled={busy}
              sx={COMPACT_BTN_SX}
              onClick={(e) => {
                stopRowOpen(e);
                setStatementOpen(true);
              }}
            >
              {t("table.acceptShort", { defaultValue: "Accept" })}
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="error"
              disabled={busy}
              sx={COMPACT_BTN_SX}
              onClick={(e) => {
                stopRowOpen(e);
                setDeclineOpen(true);
              }}
            >
              {t("table.refuseShort", { defaultValue: "Refuse" })}
            </Button>
            <IconButton
              size="small"
              aria-label={t("table.moreActions", { defaultValue: "More actions" })}
              onClick={(e) => {
                stopRowOpen(e);
                setMoreAnchor(e.currentTarget);
              }}
              sx={{ p: 0.25 }}
            >
              <MoreVertIcon sx={{ fontSize: 18 }} />
            </IconButton>
            <Menu
              anchorEl={moreAnchor}
              open={Boolean(moreAnchor)}
              onClose={() => setMoreAnchor(null)}
              onClick={stopRowOpen}
            >
              <MenuItem
                onClick={() => {
                  void openReplacement();
                }}
              >
                {t("table.offerEquivalentReplacement", {
                  defaultValue: "Offer equivalent replacement",
                })}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setMoreAnchor(null);
                  onViewDetails?.();
                }}
              >
                {t("table.viewDetails", { defaultValue: "View request details" })}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setMoreAnchor(null);
                  setAskOpen(true);
                }}
              >
                {t("table.askRovaro", { defaultValue: "Ask Rovaro a question" })}
              </MenuItem>
            </Menu>
          </Stack>
          {localError ? (
            <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.25 }}>
              {localError}
            </Typography>
          ) : null}
          {awaitingDialogs}
        </>
      );
    }

    return (
      <>
        <Stack spacing={0.5} alignItems="center">
          {hideAwaitingLabel ? null : (
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              {t("table.supplierAwaitingYours", { defaultValue: "Awaiting your response" })}
            </Typography>
          )}
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
          <Button size="small" variant="outlined" disabled={busy} onClick={() => void openReplacement()}>
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
        {awaitingDialogs}
      </>
    );
  }

  if (status === SUPPLIER_RESPONSE.ACCEPTED) {
    return (
      <CompactResponseStatus
        label={t("table.responseConfirmedShort", {
          defaultValue: "Accepted",
        })}
        when={when}
        infoTitle={infoTitle}
      />
    );
  }

  if (status !== SUPPLIER_RESPONSE.DECLINED) {
    return (
      <CompactResponseStatus
        label={shortLabel}
        when={when}
        infoTitle={infoTitle}
        color="text.primary"
      />
    );
  }

  return (
    <CompactResponseStatus
      label={t("table.toneDeclined", { defaultValue: "Declined" })}
      when={when}
      infoTitle={
        order.declineReason || order.supplierDeclineReason
          ? `${infoTitle} · ${order.declineReason || order.supplierDeclineReason}`
          : infoTitle
      }
      color="error.main"
    />
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
