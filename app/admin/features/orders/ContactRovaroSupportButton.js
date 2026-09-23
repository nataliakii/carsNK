"use client";

import { useMemo, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { SUPPORT_REASON_CODES } from "@/domain/orders/partnerSupportCopy";

function newIdempotencyKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function ContactRovaroSupportButton({ orderId }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("booking_question");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");

  const reasonOptions = useMemo(
    () =>
      SUPPORT_REASON_CODES.map((code) => ({
        value: code,
        label: t(`partnerSupport.reasons.${code}`, { defaultValue: code }),
      })),
    [t]
  );

  const openModal = () => {
    setOpen(true);
    setSent(false);
    setError("");
    setIdempotencyKey(newIdempotencyKey());
  };

  const closeModal = () => {
    if (sending) return;
    setOpen(false);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/order/support-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          reason,
          message,
          idempotencyKey,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Could not send message");
      }
      setSent(true);
      setMessage("");
    } catch (err) {
      setError(err.message || "Could not send message");
    } finally {
      setSending(false);
    }
  };

  if (!orderId) return null;

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        color="inherit"
        onClick={openModal}
        sx={{ textTransform: "none", fontWeight: 600, borderColor: "divider" }}
      >
        {t("partnerSupport.button", {
          defaultValue: "Contact Rovaro support",
        })}
      </Button>
      <Dialog open={open} onClose={closeModal} fullWidth maxWidth="xs">
        <DialogTitle>
          {t("partnerSupport.title", {
            defaultValue: "Contact Rovaro support",
          })}
        </DialogTitle>
        <DialogContent>
          {sent ? (
            <Typography sx={{ py: 1 }}>
              {t("partnerSupport.success", {
                defaultValue: "Your message has been sent to Rovaro support.",
              })}
            </Typography>
          ) : (
            <form id="rovaro-support-form" onSubmit={submit}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t("partnerSupport.intro", {
                  defaultValue:
                    "Send a message about this booking. The booking details will be attached automatically.",
                })}
              </Typography>
              <TextField
                select
                fullWidth
                size="small"
                label={t("partnerSupport.reasonLabel", {
                  defaultValue: "Reason (optional)",
                })}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                sx={{ mb: 1.5 }}
              >
                {reasonOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                required
                fullWidth
                multiline
                minRows={4}
                inputProps={{ minLength: 2, maxLength: 4000 }}
                label={t("partnerSupport.messagePlaceholder", {
                  defaultValue: "Your message…",
                })}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              {error ? (
                <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                  {error}
                </Typography>
              ) : null}
            </form>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeModal} disabled={sending}>
            {t("partnerSupport.cancel", { defaultValue: "Cancel" })}
          </Button>
          {sent ? null : (
            <Button
              type="submit"
              form="rovaro-support-form"
              variant="contained"
              disabled={sending || message.trim().length < 2}
            >
              {t("partnerSupport.send", { defaultValue: "Send message" })}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
