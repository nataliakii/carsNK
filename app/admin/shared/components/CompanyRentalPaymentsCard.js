"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useSession } from "next-auth/react";
import { useTranslation } from "react-i18next";
import { ROLE } from "@/domain/orders/admin-rbac";

/**
 * Per-company rental Stripe / on-site payment settings.
 * Visible to company admins (read-only); only superadmin can change them.
 */
export default function CompanyRentalPaymentsCard({ company, onSaved }) {
  const { t } = useTranslation();
  const { data: session, status } = useSession();
  const sessionReady = status !== "loading";
  const canEdit = Number(session?.user?.role) === ROLE.SUPERADMIN;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [timing, setTiming] = useState("after_confirm");
  const [prepaymentPercent, setPrepaymentPercent] = useState("");

  useEffect(() => {
    if (!company) return;
    setStripeEnabled(Boolean(company.rentalPayments?.stripeEnabled));
    setTiming(
      company.rentalPayments?.timing === "before_confirm"
        ? "before_confirm"
        : "after_confirm"
    );
    setPrepaymentPercent(
      company.prepaymentPercent == null || company.prepaymentPercent === ""
        ? ""
        : String(company.prepaymentPercent)
    );
  }, [company]);

  if (!company?._id) return null;

  const save = async () => {
    if (!canEdit) return;
    setBusy(true);
    setError("");
    setOk("");
    try {
      const res = await fetch(`/api/company/${company._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rentalPayments: {
            stripeEnabled,
            timing,
          },
          prepaymentPercent:
            prepaymentPercent === "" ? null : Number(prepaymentPercent),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || body.message || "Failed");
      setOk("Rental payment settings saved");
      if (typeof onSaved === "function") onSaved(body);
    } catch (err) {
      setError(err.message || "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent sx={{ p: { xs: 2, sm: 2.5 }, "&:last-child": { pb: { xs: 2, sm: 2.5 } } }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
          Rental payments
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Choose whether this company collects rental money on site, or charges
          an online prepayment via Stripe — and when that link is created.
        </Typography>

        <Stack spacing={1.5}>
          {error && <Alert severity="error">{error}</Alert>}
          {ok && <Alert severity="success">{ok}</Alert>}
          {sessionReady && !canEdit ? (
            <Alert severity="info">
              {t("companyProfile.rentalPaymentsLockedNote", {
                defaultValue:
                  "Only the platform superadmin can change these settings.",
              })}
            </Alert>
          ) : null}

          <FormControlLabel
            control={
              <Switch
                checked={stripeEnabled}
                onChange={(e) => setStripeEnabled(e.target.checked)}
                disabled={!canEdit}
              />
            }
            label="Stripe — charge rental prepayment online"
          />

          <TextField
            size="small"
            label="Prepayment %"
            type="number"
            value={prepaymentPercent}
            onChange={(e) => setPrepaymentPercent(e.target.value)}
            helperText="Empty = platform default (e.g. 10% marketplace / 0% calendar). Required for Stripe amounts."
            inputProps={{ min: 0, max: 100, readOnly: !canEdit }}
            disabled={!canEdit}
            sx={{ maxWidth: 280 }}
          />

          <FormControl disabled={!canEdit || !stripeEnabled}>
            <FormLabel>When to create the Stripe pay link</FormLabel>
            <RadioGroup
              value={timing}
              onChange={(e) => setTiming(e.target.value)}
            >
              <FormControlLabel
                value="before_confirm"
                control={<Radio size="small" />}
                label="Before confirmation — link on booking; confirm blocked until paid"
              />
              <FormControlLabel
                value="after_confirm"
                control={<Radio size="small" />}
                label="After confirmation — link when admin confirms the order"
              />
            </RadioGroup>
          </FormControl>

          <Box
            sx={{
              p: 1.25,
              borderRadius: 1,
              bgcolor: "action.hover",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography variant="caption" color="text.secondary">
              {!stripeEnabled
                ? "Mode: on site / by fact — no online charge."
                : timing === "before_confirm"
                  ? "Mode: Stripe prepayment on booking create; admin cannot confirm until paid."
                  : "Mode: Stripe prepayment after admin confirms; remainder on site at pickup."}
            </Typography>
          </Box>

          {sessionReady && canEdit ? (
            <Button variant="contained" onClick={save} disabled={busy}>
              Save rental payment settings
            </Button>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
