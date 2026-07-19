"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Alert,
  Autocomplete,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import DialogLayout from "@/app/components/ui/modals/DialogLayout";
import { ConfirmButton, CancelButton } from "@/app/components/ui";
import {
  CAR_CLASSES,
  TRANSMISSION_TYPES,
  FUEL_TYPES,
  PREDEFINED_COLORS,
  defaultPrices,
} from "@models/enums";
import {
  getCarModelSuggestions,
  ENGINE_PRESETS,
  ENGINE_POWER_PRESETS,
  SEATS_OPTIONS,
  DOORS_OPTIONS,
  REGISTRATION_YEAR_OPTIONS,
} from "@config/carCatalog";
import { useMainContext } from "@app/Context";
import { useSession } from "next-auth/react";
import { ROLE } from "@/domain/orders/admin-rbac";

function emptyRow() {
  return {
    model: "Toyota Yaris",
    class: CAR_CLASSES.ECONOMY,
    transmission: TRANSMISSION_TYPES.AUTOMATIC,
    fueltype: FUEL_TYPES.PETROL,
    seats: 5,
    numberOfDoors: 5,
    engine: "1.5",
    enginePower: 100,
    color: "white",
    registration: new Date().getFullYear() - 5,
    regNumber: "",
    airConditioning: true,
    photoFile: null,
    photoPreview: "",
  };
}

function revokePreview(row) {
  if (row?.photoPreview && String(row.photoPreview).startsWith("blob:")) {
    try {
      URL.revokeObjectURL(row.photoPreview);
    } catch {
      /* ignore */
    }
  }
}

export default function BulkAddCarsModal({ open, onClose, setUpdateStatus }) {
  const { resubmitCars, cars } = useMainContext();
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === ROLE.SUPERADMIN;

  const modelOptions = useMemo(() => {
    const fromFleet = (cars || []).map((c) => c.model).filter(Boolean);
    return getCarModelSuggestions(fromFleet);
  }, [cars]);

  const [companies, setCompanies] = useState([]);
  const [rows, setRows] = useState([emptyRow(), emptyRow()]);
  const [ownerId, setOwnerId] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultMsg, setResultMsg] = useState("");

  useEffect(() => {
    if (!open || !isSuperAdmin) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/owners");
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled && body?.success && Array.isArray(body.companies)) {
          setCompanies(body.companies);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, isSuperAdmin]);

  useEffect(() => {
    if (!open) return undefined;
    return () => {
      setRows((prev) => {
        prev.forEach(revokePreview);
        return prev;
      });
    };
  }, [open]);

  const updateRow = (index, field, value) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const setRowPhoto = (index, file) => {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        revokePreview(row);
        if (!file) {
          return { ...row, photoFile: null, photoPreview: "" };
        }
        return {
          ...row,
          photoFile: file,
          photoPreview: URL.createObjectURL(file),
        };
      })
    );
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const duplicateLast = () =>
    setRows((prev) => {
      if (!prev.length) return [emptyRow()];
      const last = prev[prev.length - 1];
      return [
        ...prev,
        {
          ...last,
          photoFile: null,
          photoPreview: "",
          regNumber: "",
        },
      ];
    });
  const removeRow = (index) =>
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      revokePreview(prev[index]);
      return prev.filter((_, i) => i !== index);
    });

  const handleSave = async () => {
    setLoading(true);
    setResultMsg("");
    try {
      const carsPayload = rows.map((row) => {
        const {
          photoFile: _f,
          photoPreview: _p,
          ...rest
        } = row;
        return {
          ...rest,
          pricingTiers: defaultPrices,
          seats: Number(row.seats),
          numberOfDoors: Number(row.numberOfDoors),
          enginePower: Number(row.enginePower),
          registration: Number(row.registration),
        };
      });

      const form = new FormData();
      form.append("cars", JSON.stringify(carsPayload));
      if (isSuperAdmin && ownerId) form.append("ownerId", ownerId);
      rows.forEach((row, index) => {
        if (row.photoFile) {
          form.append(`image_${index}`, row.photoFile, row.photoFile.name);
        }
      });

      const res = await fetch("/api/car/addBulk", {
        method: "POST",
        body: form,
      });
      const body = await res.json();
      if (!res.ok && !(body.created || []).length) {
        throw new Error(body.message || "Bulk add failed");
      }
      const msg = body.message || "Done";
      setResultMsg(msg);
      setUpdateStatus?.({ type: 200, message: msg });
      await resubmitCars?.();
      if ((body.errors || []).length === 0) {
        rows.forEach(revokePreview);
        onClose?.();
        setRows([emptyRow(), emptyRow()]);
      }
    } catch (err) {
      const msg = err.message || "Bulk add failed";
      setResultMsg(msg);
      setUpdateStatus?.({ type: 400, message: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogLayout
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      title="Bulk add cars"
      showCloseButton
      closeOnBackdropClick={false}
      actions={
        <Stack direction="row" gap={1} justifyContent="center">
          <CancelButton onClick={onClose} disabled={loading} label="Cancel" />
          <ConfirmButton
            onClick={handleSave}
            loading={loading}
            label={`Save all (${rows.length})`}
          />
        </Stack>
      }
    >
      <Stack direction="row" gap={1} mb={2} flexWrap="wrap">
        <Button size="small" variant="outlined" onClick={addRow}>
          Add row
        </Button>
        <Button size="small" variant="outlined" onClick={duplicateLast}>
          Duplicate last
        </Button>
        {isSuperAdmin && (
          <TextField
            select
            size="small"
            label="Company"
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="">Default (CarsNK)</MenuItem>
            {companies.map((c) => (
              <MenuItem key={String(c._id)} value={String(c._id)}>
                {c.name || String(c._id)}
              </MenuItem>
            ))}
          </TextField>
        )}
      </Stack>

      {resultMsg ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          {resultMsg}
        </Alert>
      ) : null}

      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Photo</TableCell>
              <TableCell>Model</TableCell>
              <TableCell>Class</TableCell>
              <TableCell>Trans.</TableCell>
              <TableCell>Fuel</TableCell>
              <TableCell>Seats</TableCell>
              <TableCell>Doors</TableCell>
              <TableCell>Engine</TableCell>
              <TableCell>HP</TableCell>
              <TableCell>Color</TableCell>
              <TableCell>Year</TableCell>
              <TableCell>Plate</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Stack direction="row" alignItems="center" gap={0.75}>
                    <Box
                      sx={{
                        width: 64,
                        height: 44,
                        borderRadius: 1,
                        overflow: "hidden",
                        bgcolor: "grey.100",
                        border: "1px solid",
                        borderColor: "divider",
                        flexShrink: 0,
                      }}
                    >
                      {row.photoPreview ? (
                        <Box
                          component="img"
                          src={row.photoPreview}
                          alt=""
                          sx={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                      ) : (
                        <Box
                          sx={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "text.disabled",
                          }}
                        >
                          <PhotoCameraOutlinedIcon sx={{ fontSize: 18 }} />
                        </Box>
                      )}
                    </Box>
                    <Stack direction="column" gap={0.25}>
                      <Button
                        component="label"
                        size="small"
                        variant="outlined"
                        sx={{
                          textTransform: "none",
                          fontSize: "0.7rem",
                          py: 0.15,
                          minWidth: 0,
                          px: 0.75,
                        }}
                      >
                        {row.photoFile ? "Change" : "Add"}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          hidden
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            setRowPhoto(index, file);
                            e.target.value = "";
                          }}
                        />
                      </Button>
                      {row.photoFile ? (
                        <Button
                          size="small"
                          color="inherit"
                          onClick={() => setRowPhoto(index, null)}
                          sx={{
                            textTransform: "none",
                            fontSize: "0.65rem",
                            py: 0,
                            minWidth: 0,
                          }}
                        >
                          Clear
                        </Button>
                      ) : null}
                    </Stack>
                  </Stack>
                </TableCell>
                <TableCell sx={{ minWidth: 180 }}>
                  <Autocomplete
                    freeSolo
                    size="small"
                    options={modelOptions}
                    value={row.model}
                    onChange={(_, v) => updateRow(index, "model", v || "")}
                    onInputChange={(_, v) => updateRow(index, "model", v)}
                    renderInput={(params) => <TextField {...params} />}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    select
                    size="small"
                    value={row.class}
                    onChange={(e) => updateRow(index, "class", e.target.value)}
                    sx={{ minWidth: 110 }}
                  >
                    {Object.values(CAR_CLASSES).map((v) => (
                      <MenuItem key={v} value={v}>
                        {v}
                      </MenuItem>
                    ))}
                  </TextField>
                </TableCell>
                <TableCell>
                  <TextField
                    select
                    size="small"
                    value={row.transmission}
                    onChange={(e) =>
                      updateRow(index, "transmission", e.target.value)
                    }
                  >
                    {Object.values(TRANSMISSION_TYPES).map((v) => (
                      <MenuItem key={v} value={v}>
                        {v}
                      </MenuItem>
                    ))}
                  </TextField>
                </TableCell>
                <TableCell>
                  <TextField
                    select
                    size="small"
                    value={row.fueltype}
                    onChange={(e) => updateRow(index, "fueltype", e.target.value)}
                    sx={{ minWidth: 120 }}
                  >
                    {Object.values(FUEL_TYPES).map((v) => (
                      <MenuItem key={v} value={v}>
                        {v}
                      </MenuItem>
                    ))}
                  </TextField>
                </TableCell>
                <TableCell>
                  <TextField
                    select
                    size="small"
                    value={row.seats}
                    onChange={(e) => updateRow(index, "seats", e.target.value)}
                  >
                    {SEATS_OPTIONS.map((v) => (
                      <MenuItem key={v} value={v}>
                        {v}
                      </MenuItem>
                    ))}
                  </TextField>
                </TableCell>
                <TableCell>
                  <TextField
                    select
                    size="small"
                    value={row.numberOfDoors}
                    onChange={(e) =>
                      updateRow(index, "numberOfDoors", e.target.value)
                    }
                  >
                    {DOORS_OPTIONS.map((v) => (
                      <MenuItem key={v} value={v}>
                        {v}
                      </MenuItem>
                    ))}
                  </TextField>
                </TableCell>
                <TableCell sx={{ minWidth: 100 }}>
                  <Autocomplete
                    freeSolo
                    size="small"
                    options={ENGINE_PRESETS}
                    value={String(row.engine)}
                    onChange={(_, v) => updateRow(index, "engine", v || "")}
                    onInputChange={(_, v) => updateRow(index, "engine", v)}
                    renderInput={(params) => <TextField {...params} />}
                  />
                </TableCell>
                <TableCell sx={{ minWidth: 90 }}>
                  <Autocomplete
                    freeSolo
                    size="small"
                    options={ENGINE_POWER_PRESETS.map(String)}
                    value={String(row.enginePower)}
                    onChange={(_, v) =>
                      updateRow(index, "enginePower", v || "")
                    }
                    onInputChange={(_, v) =>
                      updateRow(index, "enginePower", v)
                    }
                    renderInput={(params) => <TextField {...params} />}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    select
                    size="small"
                    value={row.color}
                    onChange={(e) => updateRow(index, "color", e.target.value)}
                  >
                    {Object.values(PREDEFINED_COLORS).map((v) => (
                      <MenuItem key={v} value={v}>
                        {v}
                      </MenuItem>
                    ))}
                  </TextField>
                </TableCell>
                <TableCell>
                  <TextField
                    select
                    size="small"
                    value={row.registration}
                    onChange={(e) =>
                      updateRow(index, "registration", e.target.value)
                    }
                  >
                    {REGISTRATION_YEAR_OPTIONS.map((v) => (
                      <MenuItem key={v} value={v}>
                        {v}
                      </MenuItem>
                    ))}
                  </TextField>
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    value={row.regNumber}
                    onChange={(e) =>
                      updateRow(index, "regNumber", e.target.value)
                    }
                    placeholder="ABC-1234"
                    sx={{ width: 100 }}
                  />
                </TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={() => removeRow(index)}
                    disabled={rows.length <= 1}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      <Typography variant="caption" color="text.secondary" mt={1} display="block">
        Per-row photo optional (JPEG/PNG/WebP). Without a photo — placeholder.
        Default pricing tiers applied to every row.
      </Typography>
    </DialogLayout>
  );
}
