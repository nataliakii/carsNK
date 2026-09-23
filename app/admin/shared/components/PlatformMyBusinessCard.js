"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
  FormControlLabel,
  Switch,
} from "@mui/material";
import {
  getPublicLegalEntity,
  LEGAL_ENTITY_IDENTITY,
  LEGAL_STRUCTURE_LABEL,
} from "@config/legalEntity";

/**
 * SUPERADMIN: Rovaro / operator business details used in contracts and emails.
 * Identity facts come from config/legalEntity; editable contact/registration
 * fields persist on PlatformSettings.legal.businessProfile.
 */
export default function PlatformMyBusinessCard() {
  const identity = getPublicLegalEntity("en");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [form, setForm] = useState({
    businessAddress: "",
    country: "Ireland",
    businessNameNumber: "",
    taxRegistrationNumber: "",
    vatNumber: "",
    vatRegistered: false,
    businessEmail: "",
    supportEmail: "",
    telephone: "",
    website: "",
    governingJurisdiction: "IE",
    stripeStatementName: "",
    proprietorName: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [platformRes, legalRes] = await Promise.all([
        fetch("/api/admin/platform", { cache: "no-store" }),
        fetch("/api/admin/legal/config", { cache: "no-store" }),
      ]);
      const platform = await platformRes.json();
      const legal = await legalRes.json();
      if (!platformRes.ok || !platform.success) {
        throw new Error(platform.message || "Failed to load");
      }
      const profile = platform.settings?.businessProfile || {};
      const op = legal.operator || {};
      setForm({
        businessAddress:
          profile.businessAddress || op.businessAddress || identity.businessAddress || "",
        country: profile.country || op.countryOfEstablishment || "Ireland",
        businessNameNumber:
          profile.businessNameNumber || op.businessNameNumber || "",
        taxRegistrationNumber: profile.taxRegistrationNumber || "",
        vatNumber: profile.vatNumber || "",
        vatRegistered: Boolean(profile.vatRegistered ?? op.vatRegistered),
        businessEmail: profile.businessEmail || op.legalEmail || identity.legalEmail || "",
        supportEmail: profile.supportEmail || "",
        telephone: profile.telephone || "",
        website: profile.website || "",
        governingJurisdiction: profile.governingJurisdiction || "IE",
        stripeStatementName: profile.stripeStatementName || "",
        proprietorName:
          profile.proprietorName || LEGAL_ENTITY_IDENTITY.ownerLegalName,
      });
    } catch (err) {
      setError(err.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [identity.businessAddress, identity.legalEmail]);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (key) => (e) => {
    const value = e?.target?.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    const confirmed = window.confirm(
      "Save My business details? These values are used in contracts and official communications."
    );
    if (!confirmed) return;
    setBusy(true);
    setError("");
    setOk("");
    try {
      const res = await fetch("/api/admin/platform", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessProfile: form }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Save failed");
      }
      setOk("Business details saved.");
      await load();
    } catch (err) {
      setError(err.message || "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const structureLabel =
    LEGAL_STRUCTURE_LABEL.en[LEGAL_ENTITY_IDENTITY.legalStructure] || "sole trader";

  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
          My business details
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Operator information for contracts and official communications. Not shown as a rental company.
        </Typography>
        {error ? <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert> : null}
        {ok ? <Alert severity="success" sx={{ mb: 1.5 }}>{ok}</Alert> : null}

        <Box
          sx={{
            mb: 2,
            p: 1.5,
            borderRadius: 1,
            bgcolor: "action.hover",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography variant="caption" color="text.secondary" display="block">
            Legal / operator name
          </Typography>
          <Typography variant="body2" fontWeight={600}>
            {LEGAL_ENTITY_IDENTITY.ownerLegalName}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            Platform brand
          </Typography>
          <Typography variant="body2" fontWeight={600}>
            {LEGAL_ENTITY_IDENTITY.platformBrand}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            Trading name (legal)
          </Typography>
          <Typography variant="body2" fontWeight={600}>
            {LEGAL_ENTITY_IDENTITY.tradingName}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            Business type
          </Typography>
          <Typography variant="body2" fontWeight={600} sx={{ textTransform: "capitalize" }}>
            {structureLabel}
          </Typography>
        </Box>

        <Stack spacing={1.5}>
          <TextField
            size="small"
            label="Proprietor / contact person"
            value={form.proprietorName}
            onChange={setField("proprietorName")}
            disabled={loading || busy}
            fullWidth
          />
          <TextField
            size="small"
            label="Registered / business address"
            value={form.businessAddress}
            onChange={setField("businessAddress")}
            disabled={loading || busy}
            fullWidth
            multiline
            minRows={2}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              size="small"
              label="Country"
              value={form.country}
              onChange={setField("country")}
              disabled={loading || busy}
              fullWidth
            />
            <TextField
              size="small"
              label="Governing jurisdiction"
              value={form.governingJurisdiction}
              onChange={setField("governingJurisdiction")}
              disabled={loading || busy}
              fullWidth
              helperText="e.g. IE"
            />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              size="small"
              label="Tax registration number"
              value={form.taxRegistrationNumber}
              onChange={setField("taxRegistrationNumber")}
              disabled={loading || busy}
              fullWidth
            />
            <TextField
              size="small"
              label="Business name number (CRO)"
              value={form.businessNameNumber}
              onChange={setField("businessNameNumber")}
              disabled={loading || busy}
              fullWidth
            />
          </Stack>
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(form.vatRegistered)}
                onChange={setField("vatRegistered")}
                disabled={loading || busy}
              />
            }
            label="VAT registered"
          />
          <TextField
            size="small"
            label="VAT number (optional)"
            value={form.vatNumber}
            onChange={setField("vatNumber")}
            disabled={loading || busy || !form.vatRegistered}
            fullWidth
            helperText={
              form.vatRegistered
                ? "Leave empty only if not yet issued."
                : "Not required when not VAT registered."
            }
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              size="small"
              label="Business email"
              value={form.businessEmail}
              onChange={setField("businessEmail")}
              disabled={loading || busy}
              fullWidth
            />
            <TextField
              size="small"
              label="Support email"
              value={form.supportEmail}
              onChange={setField("supportEmail")}
              disabled={loading || busy}
              fullWidth
            />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              size="small"
              label="Telephone"
              value={form.telephone}
              onChange={setField("telephone")}
              disabled={loading || busy}
              fullWidth
            />
            <TextField
              size="small"
              label="Website"
              value={form.website}
              onChange={setField("website")}
              disabled={loading || busy}
              fullWidth
            />
          </Stack>
          <TextField
            size="small"
            label="Stripe statement / business display name"
            value={form.stripeStatementName}
            onChange={setField("stripeStatementName")}
            disabled={loading || busy}
            fullWidth
            sx={{ maxWidth: 420 }}
          />
          <Box>
            <Button variant="contained" onClick={save} disabled={loading || busy}>
              Save business details
            </Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
