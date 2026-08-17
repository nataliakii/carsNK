"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  IconButton,
  Button,
  TextField,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  Chip,
  Stack,
  Tooltip,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import { useTranslation, Trans } from "react-i18next";
import { computeZoneDeliveryPrice } from "@/domain/delivery/deliveryPriceFormula";

const EMPTY_FORM = {
  name: "",
  distanceKm: "",
  fixedPrice: "",
  isFreeDelivery: false,
};

function formatDistanceFormula(distanceKm, rate) {
  return `${distanceKm} × €${rate}`;
}

function buildDistanceHelperText(t, distanceKmValue, rateValue) {
  if (!String(distanceKmValue ?? "").trim()) return undefined;
  if (!String(rateValue ?? "").trim()) return undefined;

  const distanceKm = Number(distanceKmValue);
  const rate = Number(rateValue);
  const price = computeZoneDeliveryPrice({ distanceKm }, rate);

  return t("deliveryZonesPage.distanceHelper", {
    price,
    formula: formatDistanceFormula(distanceKmValue, rateValue),
  });
}

function hasFixedPrice(zone) {
  if (zone?.fixedPrice == null) return false;
  return Number.isFinite(Number(zone.fixedPrice));
}

export default function DeliveryZonesSection() {
  const { t } = useTranslation();
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [notification, setNotification] = useState(null);
  const [pricePerKm, setPricePerKm] = useState("");
  const [pricePerKmSaved, setPricePerKmSaved] = useState("");

  const fetchZones = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/delivery-zones");
      const data = await res.json();
      if (data.success) setZones(data.data);
    } catch (err) {
      console.error("Failed to fetch zones:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCompany = useCallback(async () => {
    try {
      const res = await fetch("/api/company");
      const data = await res.json();
      if (data) {
        const val = data.deliveryPricePerKm ?? 0;
        setPricePerKm(String(val));
        setPricePerKmSaved(String(val));
      }
    } catch (err) {
      console.error("Failed to fetch company:", err);
    }
  }, []);

  useEffect(() => {
    fetchZones();
    fetchCompany();
  }, [fetchZones, fetchCompany]);

  const openAddDialog = () => {
    setEditingZone(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEditDialog = (zone) => {
    setEditingZone(zone);
    setForm({
      name: zone.name,
      distanceKm: String(zone.distanceKm),
      fixedPrice: zone.fixedPrice != null ? String(zone.fixedPrice) : "",
      isFreeDelivery: zone.isFreeDelivery,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const trimmedFixedPrice = String(form.fixedPrice ?? "").trim();
    const payload = {
      name: form.name.trim(),
      distanceKm: Number(form.distanceKm) || 0,
      fixedPrice:
        trimmedFixedPrice === "" ? null : Number(trimmedFixedPrice),
      isFreeDelivery: form.isFreeDelivery,
    };

    try {
      let res;
      if (editingZone) {
        res = await fetch(`/api/admin/delivery-zones/${editingZone._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/admin/delivery-zones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (data.success) {
        setNotification({
          severity: "success",
          message: editingZone
            ? t("deliveryZonesPage.zoneUpdated")
            : t("deliveryZonesPage.zoneCreated"),
        });
        setDialogOpen(false);
        fetchZones();
      } else {
        setNotification({ severity: "error", message: data.message });
      }
    } catch (err) {
      setNotification({ severity: "error", message: err.message });
    }
  };

  const handleDelete = async (zone) => {
    if (
      !confirm(
        t("deliveryZonesPage.confirmDelete", { name: zone.name })
      )
    )
      return;

    try {
      const res = await fetch(`/api/admin/delivery-zones/${zone._id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setNotification({
          severity: "success",
          message: t("deliveryZonesPage.zoneDeleted"),
        });
        fetchZones();
      } else {
        setNotification({ severity: "error", message: data.message });
      }
    } catch (err) {
      setNotification({ severity: "error", message: err.message });
    }
  };

  const handleSavePricePerKm = async () => {
    try {
      const res = await fetch("/api/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryPricePerKm: Number(pricePerKm) || 0 }),
      });
      if (res.ok) {
        setPricePerKmSaved(pricePerKm);
        setNotification({
          severity: "success",
          message: t("deliveryZonesPage.priceSaved"),
        });
      } else {
        const data = await res.json();
        setNotification({
          severity: "error",
          message: data.message || t("deliveryZonesPage.saveFailed"),
        });
      }
    } catch (err) {
      setNotification({ severity: "error", message: err.message });
    }
  };

  const renderPrice = (zone) => {
    if (zone.isFreeDelivery) {
      return (
        <Typography variant="body2">{t("deliveryZonesPage.free")}</Typography>
      );
    }

    if (hasFixedPrice(zone)) {
      return (
        <Typography variant="body2">
          {`€${Number(zone.fixedPrice)}`}
          <Box
            component="span"
            sx={{ color: "success.main", fontWeight: 600, ml: 0.5 }}
          >
            ({t("deliveryZonesPage.fixed")})
          </Box>
        </Typography>
      );
    }

    const rate = Number(pricePerKmSaved) || 0;
    return (
      <Typography variant="body2">
        {`€${computeZoneDeliveryPrice(zone, rate)}`}
      </Typography>
    );
  };

  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: "auto" }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
        <LocalShippingIcon sx={{ fontSize: 28 }} />
        <Typography variant="h5" fontWeight={700}>
          {t("deliveryZonesPage.title")}
        </Typography>
      </Stack>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {t("deliveryZonesPage.costSection")}
        </Typography>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1.5 }}>
          <TextField
            label={t("deliveryZonesPage.pricePerKm")}
            size="small"
            type="number"
            value={pricePerKm}
            onChange={(e) => setPricePerKm(e.target.value)}
            sx={{ width: 160 }}
            inputProps={{ min: 0, step: 0.1 }}
          />
          <Button
            variant="contained"
            size="small"
            disabled={pricePerKm === pricePerKmSaved}
            onClick={handleSavePricePerKm}
          >
            {t("deliveryZonesPage.save")}
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary" component="div">
          <Trans
            i18nKey="deliveryZonesPage.formulaHint"
            components={{ bold: <b /> }}
          />
        </Typography>
      </Paper>

      <Paper>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ p: 2 }}
        >
          <Typography variant="subtitle1" fontWeight={600}>
            {t("deliveryZonesPage.citiesTitle", { count: zones.length })}
          </Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={openAddDialog}
          >
            {t("deliveryZonesPage.add")}
          </Button>
        </Stack>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t("deliveryZonesPage.colCity")}</TableCell>
                <TableCell align="right">
                  {t("deliveryZonesPage.colDistance")}
                </TableCell>
                <TableCell align="right">
                  {t("deliveryZonesPage.colCost")}
                </TableCell>
                <TableCell align="center">
                  {t("deliveryZonesPage.colStatus")}
                </TableCell>
                <TableCell align="right">
                  {t("deliveryZonesPage.colActions")}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    {t("deliveryZonesPage.loading")}
                  </TableCell>
                </TableRow>
              ) : zones.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    {t("deliveryZonesPage.empty")}
                  </TableCell>
                </TableRow>
              ) : (
                zones.map((zone) => (
                  <TableRow key={zone._id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {zone.name}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{zone.distanceKm} km</TableCell>
                    <TableCell align="right">
                      {renderPrice(zone)}
                      {!zone.isFreeDelivery && !hasFixedPrice(zone) && (
                        <Typography variant="caption" color="text.secondary">
                          {formatDistanceFormula(
                            zone.distanceKm,
                            Number(pricePerKmSaved) || 0
                          )}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {zone.isFreeDelivery ? (
                        <Chip
                          label={t("deliveryZonesPage.statusFree")}
                          size="small"
                          color="success"
                        />
                      ) : !zone.isActive ? (
                        <Chip
                          label={t("deliveryZonesPage.statusInactive")}
                          size="small"
                          color="default"
                        />
                      ) : (
                        <Chip
                          label={t("deliveryZonesPage.statusActive")}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={t("deliveryZonesPage.edit")}>
                        <IconButton
                          size="small"
                          onClick={() => openEditDialog(zone)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t("deliveryZonesPage.delete")}>
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(zone)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {editingZone
            ? t("deliveryZonesPage.dialogEdit")
            : t("deliveryZonesPage.dialogAdd")}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t("deliveryZonesPage.fieldName")}
              fullWidth
              size="small"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
              placeholder={t("deliveryZonesPage.fieldNamePlaceholder")}
            />
            <TextField
              label={t("deliveryZonesPage.fieldDistance")}
              fullWidth
              size="small"
              type="number"
              value={form.distanceKm}
              onChange={(e) =>
                setForm((f) => ({ ...f, distanceKm: e.target.value }))
              }
              inputProps={{ min: 0 }}
              helperText={buildDistanceHelperText(
                t,
                form.distanceKm,
                pricePerKmSaved
              )}
            />
            <TextField
              label={t("deliveryZonesPage.fieldFixedPrice")}
              fullWidth
              size="small"
              type="number"
              value={form.fixedPrice}
              onChange={(e) =>
                setForm((f) => ({ ...f, fixedPrice: e.target.value }))
              }
              helperText={t("deliveryZonesPage.fixedPriceHelper")}
              inputProps={{ min: 0 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.isFreeDelivery}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      isFreeDelivery: e.target.checked,
                    }))
                  }
                />
              }
              label={t("deliveryZonesPage.freeDelivery")}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>
            {t("deliveryZonesPage.cancel")}
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!form.name.trim() || !form.distanceKm}
          >
            {editingZone
              ? t("deliveryZonesPage.save")
              : t("deliveryZonesPage.create")}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!notification}
        autoHideDuration={3000}
        onClose={() => setNotification(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {notification && (
          <Alert
            severity={notification.severity}
            onClose={() => setNotification(null)}
          >
            {notification.message}
          </Alert>
        )}
      </Snackbar>
    </Box>
  );
}
