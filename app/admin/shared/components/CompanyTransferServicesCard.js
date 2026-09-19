"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";

/**
 * Supplier transfer capability config — no customer price editing.
 */
export default function CompanyTransferServicesCard({ companyId }) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [ts, setTs] = useState({
    enabled: false,
    maxPassengers: 7,
    maxStandardLuggage: 6,
    maxCabinBags: 6,
    childSeatsAvailable: 0,
    boosterSeatsAvailable: 0,
    vehicleCategories: "STANDARD,MINIVAN",
    serviceCities: "",
    airportsServed: "",
    minimumNoticeHours: 2,
    acceptUrgentRequests: true,
    notifyOnNewTransfer: true,
    contactEmails: "",
    supplierAgreementAccepted: false,
    stripeForPlatformFee: false,
    stripeForCompanyAmount: false,
  });

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/admin/transfer-services?companyId=${encodeURIComponent(companyId)}`
        );
        const body = await res.json();
        if (!res.ok || !body.success) throw new Error(body.message);
        if (cancelled) return;
        const s = body.transferServices || {};
        setTs({
          enabled: Boolean(s.enabled),
          maxPassengers: s.maxPassengers ?? 7,
          maxStandardLuggage: s.maxStandardLuggage ?? 6,
          maxCabinBags: s.maxCabinBags ?? 6,
          childSeatsAvailable: s.childSeatsAvailable ?? 0,
          boosterSeatsAvailable: s.boosterSeatsAvailable ?? 0,
          vehicleCategories: (s.vehicleCategories || ["STANDARD"]).join(","),
          serviceCities: (s.serviceCities || []).join(", "),
          airportsServed: (s.airportsServed || []).join(", "),
          minimumNoticeHours: s.minimumNoticeHours ?? 2,
          acceptUrgentRequests: s.acceptUrgentRequests !== false,
          notifyOnNewTransfer: s.notifyOnNewTransfer !== false,
          contactEmails: (s.contactEmails || []).join(", "),
          supplierAgreementAccepted: Boolean(s.supplierAgreementAcceptedAt),
          stripeForPlatformFee: Boolean(s.payments?.stripeForPlatformFee),
          stripeForCompanyAmount: Boolean(s.payments?.stripeForCompanyAmount),
        });
      } catch (err) {
        if (!cancelled) setError(err.message || "Load failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const save = async () => {
    setBusy(true);
    setError("");
    setOk("");
    try {
      const payload = {
        companyId,
        transferServices: {
          enabled: ts.enabled,
          maxPassengers: Number(ts.maxPassengers) || 7,
          maxStandardLuggage: Number(ts.maxStandardLuggage) || 0,
          maxCabinBags: Number(ts.maxCabinBags) || 0,
          childSeatsAvailable: Number(ts.childSeatsAvailable) || 0,
          boosterSeatsAvailable: Number(ts.boosterSeatsAvailable) || 0,
          vehicleCategories: String(ts.vehicleCategories || "")
            .split(",")
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean),
          serviceCities: String(ts.serviceCities || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          airportsServed: String(ts.airportsServed || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          minimumNoticeHours: Number(ts.minimumNoticeHours) || 0,
          acceptUrgentRequests: Boolean(ts.acceptUrgentRequests),
          notifyOnNewTransfer: Boolean(ts.notifyOnNewTransfer),
          contactEmails: String(ts.contactEmails || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          supplierAgreementAcceptedAt: ts.supplierAgreementAccepted
            ? new Date()
            : null,
          supplierAgreementVersion: ts.supplierAgreementAccepted ? "v1" : "",
          payments: {
            stripeForPlatformFee: Boolean(ts.stripeForPlatformFee),
            stripeForCompanyAmount: Boolean(ts.stripeForCompanyAmount),
          },
        },
      };
      const res = await fetch("/api/admin/transfer-services", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.message);
      setOk("Transfer services saved");
    } catch (err) {
      setError(err.message || "Save failed");
    } finally {
      setBusy(false);
    }
  };

  if (!companyId) return null;

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Transfer services
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Enable passenger transfers for your company. You cannot edit platform
          customer prices.
        </Typography>
        {loading ? (
          <Typography variant="body2">Loading…</Typography>
        ) : (
          <Stack spacing={1.5}>
            {error && <Alert severity="error">{error}</Alert>}
            {ok && <Alert severity="success">{ok}</Alert>}
            <FormControlLabel
              control={
                <Switch
                  checked={ts.enabled}
                  onChange={(e) =>
                    setTs((p) => ({ ...p, enabled: e.target.checked }))
                  }
                />
              }
              label="Transfer services enabled"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={ts.supplierAgreementAccepted}
                  onChange={(e) =>
                    setTs((p) => ({
                      ...p,
                      supplierAgreementAccepted: e.target.checked,
                    }))
                  }
                />
              }
              label="Supplier agreement accepted"
            />

            <Box
              sx={{
                mt: 1,
                p: 1.5,
                borderRadius: 1,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "action.hover",
              }}
            >
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                Payment collection
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                sx={{ mb: 1.5 }}
              >
                Enable Stripe separately for the platform commission and/or the
                company amount. If both are off, the company collects payment on
                site / by fact (cash or card with the driver). Global Stripe keys
                must still be configured on the server.
              </Typography>
              <Stack spacing={0.5}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={ts.stripeForPlatformFee}
                      onChange={(e) =>
                        setTs((p) => ({
                          ...p,
                          stripeForPlatformFee: e.target.checked,
                        }))
                      }
                    />
                  }
                  label="Stripe — platform commission"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={ts.stripeForCompanyAmount}
                      onChange={(e) =>
                        setTs((p) => ({
                          ...p,
                          stripeForCompanyAmount: e.target.checked,
                        }))
                      }
                    />
                  }
                  label="Stripe — company amount"
                />
              </Stack>
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                sx={{ mt: 1 }}
              >
                {!ts.stripeForPlatformFee && !ts.stripeForCompanyAmount
                  ? "Mode: on site / by fact (no online charge)."
                  : ts.stripeForPlatformFee && ts.stripeForCompanyAmount
                    ? "Mode: full amount online via Stripe."
                    : ts.stripeForPlatformFee
                      ? "Mode: platform fee online; company collects the rest on site."
                      : "Mode: company amount online; platform fee not charged in Checkout."}
              </Typography>
            </Box>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 1.5,
              }}
            >
              <TextField
                size="small"
                label="Max passengers"
                type="number"
                value={ts.maxPassengers}
                onChange={(e) =>
                  setTs((p) => ({ ...p, maxPassengers: e.target.value }))
                }
              />
              <TextField
                size="small"
                label="Vehicle categories"
                value={ts.vehicleCategories}
                onChange={(e) =>
                  setTs((p) => ({ ...p, vehicleCategories: e.target.value }))
                }
                helperText="e.g. STANDARD,MINIVAN"
              />
              <TextField
                size="small"
                label="Service cities"
                value={ts.serviceCities}
                onChange={(e) =>
                  setTs((p) => ({ ...p, serviceCities: e.target.value }))
                }
              />
              <TextField
                size="small"
                label="Airports served"
                value={ts.airportsServed}
                onChange={(e) =>
                  setTs((p) => ({ ...p, airportsServed: e.target.value }))
                }
              />
              <TextField
                size="small"
                label="Child seats available"
                type="number"
                value={ts.childSeatsAvailable}
                onChange={(e) =>
                  setTs((p) => ({ ...p, childSeatsAvailable: e.target.value }))
                }
              />
              <TextField
                size="small"
                label="Contact emails"
                value={ts.contactEmails}
                onChange={(e) =>
                  setTs((p) => ({ ...p, contactEmails: e.target.value }))
                }
              />
            </Box>
            <Button variant="contained" onClick={save} disabled={busy}>
              Save transfer settings
            </Button>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
