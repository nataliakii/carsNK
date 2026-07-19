"use client";

import { useMemo, useState } from "react";
import {
  Alert,
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
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import dayjs from "dayjs";
import DialogLayout from "@/app/components/ui/modals/DialogLayout";
import { ConfirmButton, CancelButton } from "@/app/components/ui";
import { useMainContext } from "@app/Context";

function emptyRow(defaultCarId = "") {
  const start = dayjs().add(1, "day").format("YYYY-MM-DD");
  const end = dayjs().add(4, "day").format("YYYY-MM-DD");
  return {
    carId: defaultCarId,
    rentalStartDate: start,
    rentalEndDate: end,
    timeInHm: "14:00",
    timeOutHm: "12:00",
    customerName: "",
    phone: "",
    email: "",
    placeIn: "Nea Kallikratia",
    placeOut: "Nea Kallikratia",
    totalPrice: "",
  };
}

export default function BulkAddOfflineOrdersModal({
  open,
  onClose,
  setUpdateStatus,
}) {
  const { cars, company, fetchAndUpdateOrders } = useMainContext();

  const carOptions = useMemo(
    () =>
      (cars || []).filter((c) => !c.testingCar).map((c) => ({
        id: String(c._id),
        label: `${c.model} (#${c.carNumber}${c.regNumber ? ` · ${c.regNumber}` : ""})`,
      })),
    [cars]
  );

  const defaultStart = company?.defaultStart || "14:00";
  const defaultEnd = company?.defaultEnd || "12:00";

  const [rows, setRows] = useState(() => [
    emptyRow(carOptions[0]?.id || ""),
    emptyRow(carOptions[0]?.id || ""),
  ]);
  const [loading, setLoading] = useState(false);
  const [resultMsg, setResultMsg] = useState("");

  const updateRow = (index, field, value) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const addRow = () =>
    setRows((prev) => [
      ...prev,
      emptyRow(prev[0]?.carId || carOptions[0]?.id || ""),
    ]);
  const duplicateLast = () =>
    setRows((prev) =>
      prev.length ? [...prev, { ...prev[prev.length - 1] }] : [emptyRow()]
    );
  const removeRow = (index) =>
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));

  const handleSave = async () => {
    setLoading(true);
    setResultMsg("");
    try {
      const payload = {
        orders: rows.map((row) => ({
          carId: row.carId,
          rentalStartDate: row.rentalStartDate,
          rentalEndDate: row.rentalEndDate,
          timeInHm: row.timeInHm || defaultStart,
          timeOutHm: row.timeOutHm || defaultEnd,
          customerName: row.customerName,
          phone: row.phone,
          email: row.email,
          placeIn: row.placeIn,
          placeOut: row.placeOut,
          totalPrice: row.totalPrice === "" ? 0 : Number(row.totalPrice),
        })),
      };

      const res = await fetch("/api/order/addBulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok && !(body.created || []).length) {
        throw new Error(body.message || "Bulk add failed");
      }
      const msg = body.message || "Done";
      setResultMsg(msg);
      setUpdateStatus?.({ type: 200, message: msg });
      if (typeof fetchAndUpdateOrders === "function") {
        await fetchAndUpdateOrders();
      }
      if ((body.errors || []).length === 0) {
        onClose?.();
        setRows([
          emptyRow(carOptions[0]?.id || ""),
          emptyRow(carOptions[0]?.id || ""),
        ]);
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
      title="Bulk add offline orders"
      showCloseButton
      closeOnBackdropClick={false}
      actions={
        <Stack direction="row" gap={1} justifyContent="center">
          <CancelButton onClick={onClose} disabled={loading} label="Cancel" />
          <ConfirmButton
            onClick={handleSave}
            loading={loading}
            label={`Save all (${rows.length})`}
            disabled={carOptions.length === 0}
          />
        </Stack>
      }
    >
      {carOptions.length === 0 ? (
        <Alert severity="warning">Add cars first — no fleet available.</Alert>
      ) : (
        <>
          <Stack direction="row" gap={1} mb={2}>
            <Button size="small" variant="outlined" onClick={addRow}>
              Add row
            </Button>
            <Button size="small" variant="outlined" onClick={duplicateLast}>
              Duplicate last
            </Button>
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
                  <TableCell>Car</TableCell>
                  <TableCell>Start</TableCell>
                  <TableCell>End</TableCell>
                  <TableCell>In</TableCell>
                  <TableCell>Out</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Pickup</TableCell>
                  <TableCell>Return</TableCell>
                  <TableCell>€</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <TextField
                        select
                        size="small"
                        value={row.carId}
                        onChange={(e) =>
                          updateRow(index, "carId", e.target.value)
                        }
                        sx={{ minWidth: 200 }}
                      >
                        {carOptions.map((c) => (
                          <MenuItem key={c.id} value={c.id}>
                            {c.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>
                    <TableCell>
                      <TextField
                        type="date"
                        size="small"
                        value={row.rentalStartDate}
                        onChange={(e) =>
                          updateRow(index, "rentalStartDate", e.target.value)
                        }
                        InputLabelProps={{ shrink: true }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        type="date"
                        size="small"
                        value={row.rentalEndDate}
                        onChange={(e) =>
                          updateRow(index, "rentalEndDate", e.target.value)
                        }
                        InputLabelProps={{ shrink: true }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={row.timeInHm}
                        onChange={(e) =>
                          updateRow(index, "timeInHm", e.target.value)
                        }
                        placeholder="14:00"
                        sx={{ width: 80 }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={row.timeOutHm}
                        onChange={(e) =>
                          updateRow(index, "timeOutHm", e.target.value)
                        }
                        placeholder="12:00"
                        sx={{ width: 80 }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={row.customerName}
                        onChange={(e) =>
                          updateRow(index, "customerName", e.target.value)
                        }
                        sx={{ width: 120 }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={row.phone}
                        onChange={(e) =>
                          updateRow(index, "phone", e.target.value)
                        }
                        sx={{ width: 120 }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={row.email}
                        onChange={(e) =>
                          updateRow(index, "email", e.target.value)
                        }
                        sx={{ width: 140 }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={row.placeIn}
                        onChange={(e) =>
                          updateRow(index, "placeIn", e.target.value)
                        }
                        sx={{ width: 120 }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={row.placeOut}
                        onChange={(e) =>
                          updateRow(index, "placeOut", e.target.value)
                        }
                        sx={{ width: 120 }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        type="number"
                        value={row.totalPrice}
                        onChange={(e) =>
                          updateRow(index, "totalPrice", e.target.value)
                        }
                        sx={{ width: 80 }}
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
          <Typography
            variant="caption"
            color="text.secondary"
            mt={1}
            display="block"
          >
            Each row is saved as an offline booking (confirmed, no email/Telegram).
          </Typography>
        </>
      )}
    </DialogLayout>
  );
}
