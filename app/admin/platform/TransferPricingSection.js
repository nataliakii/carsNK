"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { formatMinor } from "@/domain/money/minorUnits";

const KINDS = ["FIXED_ROUTE", "ZONE_PAIR", "CITY_FORMULA"];

export default function TransferPricingSection() {
  const [rules, setRules] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const [kind, setKind] = useState("CITY_FORMULA");
  const [country, setCountry] = useState("GR");
  const [name, setName] = useState("");
  const [customerPrice, setCustomerPrice] = useState("");
  const [supplierPayout, setSupplierPayout] = useState("");
  const [baseFare, setBaseFare] = useState("25");
  const [pricePerKm, setPricePerKm] = useState("1.2");
  const [minimumFare, setMinimumFare] = useState("35");
  const [city, setCity] = useState("");
  const [manualThreshold, setManualThreshold] = useState("200");

  const [previewFrom, setPreviewFrom] = useState("Malaga Airport");
  const [previewTo, setPreviewTo] = useState("Marbella");
  const [previewResult, setPreviewResult] = useState(null);

  const [zoneName, setZoneName] = useState("");
  const [zoneCountry, setZoneCountry] = useState("ES");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [rulesRes, zonesRes] = await Promise.all([
        fetch("/api/admin/transfer-pricing", { cache: "no-store" }),
        fetch("/api/admin/transfer-zones", { cache: "no-store" }),
      ]);
      const rulesBody = await rulesRes.json();
      const zonesBody = await zonesRes.json();
      if (!rulesRes.ok || !rulesBody.success) {
        throw new Error(rulesBody.message || "Failed to load rules");
      }
      setRules(rulesBody.items || []);
      if (zonesRes.ok && zonesBody.success) setZones(zonesBody.items || []);
    } catch (err) {
      setError(err.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toMinor = (major) => Math.round(Number(major || 0) * 100);

  const createRule = async () => {
    setBusy(true);
    setError("");
    setOk("");
    try {
      const payload = {
        kind,
        country,
        name: name || `${kind} ${country}`,
        currency: "EUR",
        vehicleCategory: "STANDARD",
        direction: "both",
        isActive: true,
        priority: 100,
      };
      if (kind === "FIXED_ROUTE" || kind === "ZONE_PAIR") {
        payload.customerPriceMinor = toMinor(customerPrice);
        payload.supplierPayoutMinor = toMinor(supplierPayout);
      }
      if (kind === "CITY_FORMULA") {
        payload.city = city;
        payload.baseFareMinor = toMinor(baseFare);
        payload.pricePerKmMinor = toMinor(pricePerKm);
        payload.minimumFareMinor = toMinor(minimumFare);
        payload.manualQuoteThresholdKm = Number(manualThreshold) || null;
        payload.nightStartTime = "22:00";
        payload.nightEndTime = "06:00";
        payload.nightSurchargeType = "fixed";
        payload.nightSurchargeValue = 1500;
        payload.airportPickupFeeMinor = 500;
      }
      if (kind === "FIXED_ROUTE") {
        payload.origin = { placeName: previewFrom, locationType: "airport" };
        payload.destination = { placeName: previewTo, locationType: "city" };
      }
      const res = await fetch("/api/admin/transfer-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.message || "Create failed");
      setOk("Rule created");
      setName("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async (id) => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/transfer-pricing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "deactivate" }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.message);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const duplicate = async (id) => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/transfer-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "duplicate", id }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.message);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const runPreview = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/transfer-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview",
          country,
          from: previewFrom,
          to: previewTo,
          origin: {
            placeName: previewFrom,
            city: previewFrom,
            locationType: /airport/i.test(previewFrom) ? "airport" : "city",
            country,
          },
          destination: {
            placeName: previewTo,
            city: previewTo,
            country,
          },
          datetime: new Date().toISOString(),
          adults: 2,
          standardSuitcases: 2,
          cabinBags: 2,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.message);
      setPreviewResult(body);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const createZone = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/transfer-zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: zoneName,
          country: zoneCountry,
          isActive: true,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.message);
      setZoneName("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h5" sx={{ mb: 1 }}>
        Transfer pricing
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Priority: fixed route → zone pair → city formula → manual quote.
        Suppliers cannot edit customer prices.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {ok && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {ok}
        </Alert>
      )}

      <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
        Create rule
      </Typography>
      <Stack direction={{ xs: "column", md: "row" }} gap={1.5} flexWrap="wrap" mb={2}>
        <TextField select size="small" label="Kind" value={kind} onChange={(e) => setKind(e.target.value)} sx={{ minWidth: 160 }}>
          {KINDS.map((k) => (
            <MenuItem key={k} value={k}>{k}</MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label="Country" value={country} onChange={(e) => setCountry(e.target.value)} sx={{ minWidth: 100 }}>
          <MenuItem value="GR">GR</MenuItem>
          <MenuItem value="ES">ES</MenuItem>
        </TextField>
        <TextField size="small" label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        {kind === "CITY_FORMULA" && (
          <>
            <TextField size="small" label="City" value={city} onChange={(e) => setCity(e.target.value)} />
            <TextField size="small" label="Base fare €" value={baseFare} onChange={(e) => setBaseFare(e.target.value)} />
            <TextField size="small" label="€/km" value={pricePerKm} onChange={(e) => setPricePerKm(e.target.value)} />
            <TextField size="small" label="Min €" value={minimumFare} onChange={(e) => setMinimumFare(e.target.value)} />
            <TextField size="small" label="Manual km" value={manualThreshold} onChange={(e) => setManualThreshold(e.target.value)} />
          </>
        )}
        {(kind === "FIXED_ROUTE" || kind === "ZONE_PAIR") && (
          <>
            <TextField size="small" label="Customer €" value={customerPrice} onChange={(e) => setCustomerPrice(e.target.value)} />
            <TextField size="small" label="Supplier €" value={supplierPayout} onChange={(e) => setSupplierPayout(e.target.value)} />
          </>
        )}
        <Button variant="contained" onClick={createRule} disabled={busy}>
          Create
        </Button>
      </Stack>

      <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
        Preview calculator
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} gap={1.5} mb={1}>
        <TextField size="small" label="From" value={previewFrom} onChange={(e) => setPreviewFrom(e.target.value)} />
        <TextField size="small" label="To" value={previewTo} onChange={(e) => setPreviewTo(e.target.value)} />
        <Button variant="outlined" onClick={runPreview} disabled={busy}>
          Preview
        </Button>
      </Stack>
      {previewResult?.fullQuote && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Method: {previewResult.fullQuote.pricingMethod} —{" "}
          {previewResult.fullQuote.pricingExplanation}
          <br />
          Customer: {formatMinor(previewResult.fullQuote.customerPriceMinor, previewResult.fullQuote.currency)}
          {" · "}
          Payout: {formatMinor(previewResult.fullQuote.supplierPayoutMinor, previewResult.fullQuote.currency)}
          {" · "}
          Margin: {formatMinor(previewResult.fullQuote.platformMarginMinor, previewResult.fullQuote.currency)}
        </Alert>
      )}

      <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
        Zones
      </Typography>
      <Stack direction="row" gap={1} mb={2}>
        <TextField size="small" label="Zone name" value={zoneName} onChange={(e) => setZoneName(e.target.value)} />
        <TextField select size="small" label="Country" value={zoneCountry} onChange={(e) => setZoneCountry(e.target.value)} sx={{ minWidth: 100 }}>
          <MenuItem value="GR">GR</MenuItem>
          <MenuItem value="ES">ES</MenuItem>
        </TextField>
        <Button variant="outlined" onClick={createZone} disabled={busy || !zoneName}>
          Add zone
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {zones.length} zones — {zones.map((z) => z.name).join(", ") || "none"}
      </Typography>

      <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
        Active rules
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Kind</TableCell>
            <TableCell>Name</TableCell>
            <TableCell>Country</TableCell>
            <TableCell>Active</TableCell>
            <TableCell>Price / formula</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rules.map((rule) => (
            <TableRow key={rule._id}>
              <TableCell>{rule.kind}</TableCell>
              <TableCell>{rule.name || "—"}</TableCell>
              <TableCell>{rule.country}</TableCell>
              <TableCell>{rule.isActive ? "yes" : "no"}</TableCell>
              <TableCell>
                {rule.customerPriceMinor != null
                  ? formatMinor(rule.customerPriceMinor, rule.currency)
                  : `base ${formatMinor(rule.baseFareMinor || 0)} + ${formatMinor(rule.pricePerKmMinor || 0)}/km`}
              </TableCell>
              <TableCell align="right">
                <Button size="small" onClick={() => duplicate(rule._id)} disabled={busy}>
                  Duplicate
                </Button>
                {rule.isActive && (
                  <Button size="small" color="warning" onClick={() => deactivate(rule._id)} disabled={busy}>
                    Deactivate
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
