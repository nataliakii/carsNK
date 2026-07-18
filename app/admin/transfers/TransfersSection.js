"use client";

import { useCallback, useEffect, useState } from "react";
import {
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
import dayjs from "dayjs";

const STATUS_OPTIONS = ["new", "seen", "done", "cancelled"];

export default function TransfersSection() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = status ? `?status=${encodeURIComponent(status)}` : "";
      const res = await fetch(`/api/admin/transfers${qs}`);
      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.message || "Failed to load");
      }
      setItems(body.items || []);
    } catch (err) {
      setError(err.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (id, nextStatus) => {
    try {
      const res = await fetch(`/api/admin/transfers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.message || "Update failed");
      }
      setItems((prev) =>
        prev.map((item) => (item._id === id ? body.item : item))
      );
    } catch (err) {
      setError(err.message || "Update failed");
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
        gap={2}
        mb={2}
      >
        <Typography variant="h5">Transfers</Typography>
        <Stack direction="row" gap={1} alignItems="center">
          <TextField
            select
            size="small"
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">All</MenuItem>
            {STATUS_OPTIONS.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </TextField>
          <Button variant="outlined" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : items.length === 0 ? (
        <Typography color="text.secondary">No transfer requests yet.</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Created</TableCell>
              <TableCell>When</TableCell>
              <TableCell>From → To</TableCell>
              <TableCell>Pax</TableCell>
              <TableCell>Contact</TableCell>
              <TableCell>Notes</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item._id} hover>
                <TableCell>
                  {dayjs(item.createdAt).format("DD.MM.YYYY HH:mm")}
                </TableCell>
                <TableCell>
                  {dayjs(item.datetime).format("DD.MM.YYYY HH:mm")}
                </TableCell>
                <TableCell>
                  {item.from} → {item.to}
                </TableCell>
                <TableCell>{item.passengers}</TableCell>
                <TableCell>
                  <div>{item.customerName || "—"}</div>
                  <div>{item.phone || ""}</div>
                  <div>{item.email || ""}</div>
                </TableCell>
                <TableCell sx={{ maxWidth: 220 }}>{item.notes || "—"}</TableCell>
                <TableCell>
                  <TextField
                    select
                    size="small"
                    value={item.status}
                    onChange={(e) => updateStatus(item._id, e.target.value)}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <MenuItem key={s} value={s}>
                        {s}
                      </MenuItem>
                    ))}
                  </TextField>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  );
}
