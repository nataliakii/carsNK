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
  SUPPLIER_RESPONSE,
  SUPPLIER_RESPONSE_PAYLOAD,
  getSupplierResponseStatus,
  isSupplierResponseLocked,
} from "@/domain/orders/supplierResponseStatus";

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
}) {
  const { t } = useTranslation();
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [changeOpen, setChangeOpen] = useState(false);

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
      <Typography variant="caption" sx={{ fontWeight: 600 }}>
        {t("table.bookingConfirmedByRovaro")}
      </Typography>
    );
  }

  const accept = () => onRespond(SUPPLIER_RESPONSE_PAYLOAD.ACCEPTED);
  const decline = () => {
    const trimmed = reason.trim();
    if (!trimmed) return;
    onRespond(SUPPLIER_RESPONSE_PAYLOAD.DECLINED, trimmed);
    setDeclineOpen(false);
    setReason("");
  };

  if (status === SUPPLIER_RESPONSE.AWAITING) {
    return (
      <>
        <Stack spacing={0.5} alignItems="center">
          <Button
            size="small"
            variant="contained"
            color="success"
            disabled={busy}
            onClick={accept}
            sx={{ textTransform: "none", fontSize: "0.7rem", py: 0.25 }}
          >
            {t("table.vehicleAvailable")}
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            disabled={busy}
            onClick={() => setDeclineOpen(true)}
            sx={{ textTransform: "none", fontSize: "0.7rem", py: 0.25 }}
          >
            {t("table.cannotProvide")}
          </Button>
        </Stack>
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
            ✓ {t("table.vehicleAvailable")}
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

  return (
    <Stack spacing={0.25} alignItems="flex-start">
      <Typography variant="caption" sx={{ fontWeight: 700, color: "error.main" }}>
        {t("table.cannotProvide")}
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
