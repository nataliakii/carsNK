"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  Chip,
} from "@mui/material";
import dayjs from "dayjs";
import { useSession } from "next-auth/react";
import { ROLE } from "@/domain/orders/admin-rbac";
import { useAdminCountryFilter } from "@app/hooks/useAdminCountryFilter";
import { formatMinor } from "@/domain/money/minorUnits";
import { useMainContext } from "@app/Context";

const STATUS_OPTIONS = [
  "OPEN_FOR_CLAIM",
  "MANUAL_QUOTE_REQUIRED",
  "CLAIMED",
  "AWAITING_CUSTOMER_PAYMENT",
  "CONFIRMED",
  "COMPLETED",
  "EXPIRED_UNCLAIMED",
  "SUPPLIER_CANCELLED",
  "ADMIN_CANCELLED",
  "REOPENED_FOR_CLAIM",
];

const FLEET_ASSIGNABLE = new Set([
  "CLAIMED",
  "AWAITING_CUSTOMER_PAYMENT",
  "CONFIRMED",
  "COMPLETED",
]);

const PAYMENT_LINK_STATUSES = new Set([
  "CLAIMED",
  "AWAITING_CUSTOMER_PAYMENT",
]);


export default function TransfersSection() {
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === ROLE.SUPERADMIN;
  const { country: adminCountry } = useAdminCountryFilter();
  const { cars: allCars } = useMainContext();

  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const carsByOwner = useMemo(() => {
    const map = new Map();
    for (const car of Array.isArray(allCars) ? allCars : []) {
      const oid = car?.ownerId ? String(car.ownerId) : "";
      if (!oid) continue;
      if (!map.has(oid)) map.set(oid, []);
      map.get(oid).push(car);
    }
    return map;
  }, [allCars]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (isSuperAdmin) {
        params.set(
          "country",
          adminCountry === "ALL" ? "ALL" : adminCountry
        );
      }
      const qs = params.toString() ? `?${params}` : "";
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
  }, [status, isSuperAdmin, adminCountry]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = async (id, body) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/transfers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Update failed");
      }
      await load();
    } catch (err) {
      setError(err.message || "Update failed");
    } finally {
      setBusyId("");
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
        <Box>
          <Typography variant="h5">Transfers</Typography>
          <Typography variant="body2" color="text.secondary">
            Passenger transfers table. Assign a rental-fleet car when the
            same vehicle is used — it can then show on the rental calendar.
          </Typography>
        </Box>
        <Stack direction="row" gap={1} alignItems="center">
          {isSuperAdmin && (
            <Button
              variant="outlined"
              href="/admin/company?tab=platform"
              sx={{ textTransform: "none" }}
            >
              Pricing rules
            </Button>
          )}
          <TextField
            select
            size="small"
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="open">Open for claim</MenuItem>
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
              <TableCell>Price</TableCell>
              <TableCell>Payout</TableCell>
              <TableCell>Pax</TableCell>
              <TableCell>Contact</TableCell>
              <TableCell>Country</TableCell>
              <TableCell>Claimed by</TableCell>
              <TableCell>Payment</TableCell>
              <TableCell>Fleet car</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => {
              const companyId =
                item.assignedSupplierId || item.claimedByCompanyId
                  ? String(item.assignedSupplierId || item.claimedByCompanyId)
                  : "";
              const fleetCars = companyId
                ? carsByOwner.get(companyId) || []
                : [];
              const canAssign =
                FLEET_ASSIGNABLE.has(String(item.status || "").toUpperCase()) &&
                fleetCars.length > 0;

              return (
                <TableRow key={item._id} hover>
                  <TableCell>
                    {dayjs(item.createdAt).format("DD.MM.YYYY HH:mm")}
                  </TableCell>
                  <TableCell>
                    {dayjs(item.datetime).format("DD.MM.YYYY HH:mm")}
                  </TableCell>
                  <TableCell>
                    {item.from} → {item.to}
                    {item.pricingMethod && (
                      <Typography
                        variant="caption"
                        display="block"
                        color="text.secondary"
                      >
                        {item.pricingMethod}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.customerPriceMinor != null
                      ? formatMinor(
                          item.customerPriceMinor,
                          item.currency || "EUR"
                        )
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {item.supplierPayoutMinor != null
                      ? formatMinor(
                          item.supplierPayoutMinor,
                          item.currency || "EUR"
                        )
                      : "—"}
                  </TableCell>
                  <TableCell>{item.passengers}</TableCell>
                  <TableCell>
                    <div>{item.customerName || "—"}</div>
                    <div>{item.phone || ""}</div>
                    <div>{item.email || ""}</div>
                  </TableCell>
                  <TableCell>{item.country || "—"}</TableCell>
                  <TableCell>
                    {item.claimedByCompanyName ||
                      item.claimedByEmail ||
                      (item.isOpen ? (
                        <Chip size="small" label="Open" color="warning" />
                      ) : (
                        "—"
                      ))}
                  </TableCell>
                  <TableCell>
                    {item.paymentStatus ? (
                      <Stack spacing={0.5}>
                        <Chip
                          size="small"
                          label={item.paymentStatus}
                          color={
                            item.paymentStatus === "paid"
                              ? "success"
                              : item.paymentStatus === "pending"
                                ? "warning"
                                : "default"
                          }
                        />
                        {item.paymentCollectionMode ? (
                          <Typography variant="caption" color="text.secondary">
                            {item.paymentCollectionMode}
                          </Typography>
                        ) : null}
                        {item.paymentCheckoutUrl ? (
                          <Button
                            size="small"
                            href={item.paymentCheckoutUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ textTransform: "none", px: 0, minWidth: 0 }}
                          >
                            Open link
                          </Button>
                        ) : null}
                      </Stack>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {canAssign ? (
                      <TextField
                        select
                        size="small"
                        value={item.assignedCarId || ""}
                        onChange={(e) =>
                          patch(item._id, {
                            action: "assign_fleet_car",
                            carId: e.target.value || null,
                          })
                        }
                        disabled={busyId === item._id}
                        sx={{ minWidth: 140 }}
                      >
                        <MenuItem value="">Not assigned</MenuItem>
                        {fleetCars.map((car) => (
                          <MenuItem key={String(car._id)} value={String(car._id)}>
                            {car.model}
                            {car.regNumber ? ` (${car.regNumber})` : ""}
                          </MenuItem>
                        ))}
                      </TextField>
                    ) : fleetCars.length === 0 && companyId ? (
                      <Typography variant="caption" color="text.secondary">
                        No rental cars
                      </Typography>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {isSuperAdmin ? (
                      <TextField
                        select
                        size="small"
                        value={item.status}
                        onChange={(e) =>
                          patch(item._id, { status: e.target.value })
                        }
                        disabled={busyId === item._id}
                        sx={{ minWidth: 160 }}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <MenuItem key={s} value={s}>
                            {s}
                          </MenuItem>
                        ))}
                      </TextField>
                    ) : (
                      item.status
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Stack
                      direction="row"
                      spacing={0.5}
                      justifyContent="flex-end"
                    >
                      {item.isOpen && (
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => patch(item._id, { action: "claim" })}
                          disabled={busyId === item._id}
                          sx={{ textTransform: "none" }}
                        >
                          Claim
                        </Button>
                      )}
                      {PAYMENT_LINK_STATUSES.has(
                        String(item.status || "").toUpperCase()
                      ) &&
                        item.paymentStatus !== "paid" && (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() =>
                              patch(item._id, {
                                action: "create_payment_link",
                                forceNew: Boolean(item.paymentCheckoutUrl),
                              })
                            }
                            disabled={busyId === item._id}
                            sx={{ textTransform: "none" }}
                          >
                            {item.paymentCheckoutUrl
                              ? "Resend pay link"
                              : "Create pay link"}
                          </Button>
                        )}
                      {isSuperAdmin && item.status === "EXPIRED_UNCLAIMED" && (
                        <Button
                          size="small"
                          onClick={() =>
                            patch(item._id, {
                              action: "reopen",
                              reason: "Admin reopen",
                            })
                          }
                          disabled={busyId === item._id}
                          sx={{ textTransform: "none" }}
                        >
                          Reopen
                        </Button>
                      )}
                      {isSuperAdmin && item.isOpen && (
                        <Button
                          size="small"
                          onClick={() =>
                            patch(item._id, {
                              action: "extend_offer",
                              hours: 24,
                            })
                          }
                          disabled={busyId === item._id}
                          sx={{ textTransform: "none" }}
                        >
                          Extend
                        </Button>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Box>
  );
}
