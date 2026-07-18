"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";

export default function TransferRequestModal({ open, onClose }) {
  const { t, i18n } = useTranslation();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [passengers, setPassengers] = useState("1");
  const [datetime, setDatetime] = useState("");
  const [notes, setNotes] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const reset = () => {
    setFrom("");
    setTo("");
    setPassengers("1");
    setDatetime("");
    setNotes("");
    setCustomerName("");
    setPhone("");
    setEmail("");
    setError("");
    setSuccess(false);
  };

  const handleClose = () => {
    if (loading) return;
    reset();
    onClose?.();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to,
          passengers: Number(passengers),
          datetime,
          notes,
          customerName,
          phone,
          email,
          locale: i18n.language || "",
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.success) {
        throw new Error(body.message || t("transfer.submitError"));
      }
      setSuccess(true);
    } catch (err) {
      setError(err.message || t("transfer.submitError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("transfer.title")}</DialogTitle>
      <DialogContent>
        {success ? (
          <Typography sx={{ py: 2 }}>{t("transfer.success")}</Typography>
        ) : (
          <Box
            component="form"
            id="transfer-request-form"
            onSubmit={handleSubmit}
            sx={{ display: "flex", flexDirection: "column", gap: 1.5, pt: 1 }}
          >
            <TextField
              required
              label={t("transfer.from")}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              fullWidth
            />
            <TextField
              required
              label={t("transfer.to")}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              fullWidth
            />
            <TextField
              required
              type="number"
              inputProps={{ min: 1, max: 50 }}
              label={t("transfer.passengers")}
              value={passengers}
              onChange={(e) => setPassengers(e.target.value)}
              fullWidth
            />
            <TextField
              required
              type="datetime-local"
              label={t("transfer.datetime")}
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label={t("transfer.customerName")}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              fullWidth
            />
            <TextField
              label={t("transfer.phone")}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              fullWidth
            />
            <TextField
              type="email"
              label={t("transfer.email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
            />
            <TextField
              label={t("transfer.notes")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
            {error && (
              <Typography color="error" variant="body2">
                {error}
              </Typography>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          {success ? t("transfer.close") : t("transfer.cancel")}
        </Button>
        {!success && (
          <Button
            type="submit"
            form="transfer-request-form"
            variant="contained"
            disabled={loading}
          >
            {loading ? t("transfer.sending") : t("transfer.submit")}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
