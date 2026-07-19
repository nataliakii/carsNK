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
  Alert,
  Divider,
} from "@mui/material";

const ROLE_ADMIN = 1;
const ROLE_SUPERADMIN = 2;

export default function OwnersSection() {
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [cars, setCars] = useState([]);
  const [unassignedCarCount, setUnassignedCarCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");

  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userOwnerId, setUserOwnerId] = useState("");

  const [assignOwnerId, setAssignOwnerId] = useState("");
  const [selectedCarIds, setSelectedCarIds] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [ownersRes, carsRes] = await Promise.all([
        fetch("/api/admin/owners"),
        fetch("/api/car/all"),
      ]);
      const ownersBody = await ownersRes.json();
      if (!ownersRes.ok || !ownersBody.success) {
        throw new Error(ownersBody.message || "Failed to load owners");
      }
      setCompanies(ownersBody.companies || []);
      setUsers(ownersBody.users || []);
      setUnassignedCarCount(ownersBody.unassignedCarCount || 0);

      if (carsRes.ok) {
        const carsBody = await carsRes.json();
        const list = Array.isArray(carsBody)
          ? carsBody
          : carsBody?.data || carsBody?.cars || [];
        setCars(list);
      }
    } catch (err) {
      setError(err.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const companyNameById = useMemo(() => {
    const map = {};
    for (const c of companies) map[String(c._id)] = c.name;
    return map;
  }, [companies]);

  const createCompany = async () => {
    setError("");
    setOk("");
    try {
      const res = await fetch("/api/admin/owners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: companyName, email: companyEmail }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.message || "Failed");
      setCompanyName("");
      setCompanyEmail("");
      setOk(`Company created: ${body.company?.name}`);
      await load();
    } catch (err) {
      setError(err.message || "Failed");
    }
  };

  const createUser = async () => {
    setError("");
    setOk("");
    try {
      const res = await fetch("/api/admin/owners/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail,
          password: userPassword,
          role: ROLE_ADMIN,
          ownerId: userOwnerId,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.message || "Failed");
      setUserEmail("");
      setUserPassword("");
      setOk(`Admin created: ${body.user?.email}`);
      await load();
    } catch (err) {
      setError(err.message || "Failed");
    }
  };

  const assignCars = async () => {
    setError("");
    setOk("");
    try {
      const res = await fetch("/api/admin/owners/assign-cars", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId: assignOwnerId,
          carIds: selectedCarIds,
          updateOrders: true,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.message || "Failed");
      setSelectedCarIds([]);
      setOk(
        `Assigned ${body.carsModified} cars (${body.ordersModified} orders updated)`
      );
      await load();
    } catch (err) {
      setError(err.message || "Failed");
    }
  };

  const toggleCar = (id) => {
    const sid = String(id);
    setSelectedCarIds((prev) =>
      prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]
    );
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, display: "flex", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200 }}>
      <Typography variant="h5" mb={1}>
        Owners &amp; admins
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Multi-tenant: each partner company owns a fleet. ADMIN users see only
        their ownerId. Unassigned cars: {unassignedCarCount}.
      </Typography>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}
      {ok ? (
        <Alert severity="success" sx={{ mb: 2 }}>
          {ok}
        </Alert>
      ) : null}

      <Stack
        direction={{ xs: "column", md: "row" }}
        gap={3}
        alignItems="flex-start"
        mb={1}
      >
        <Box sx={{ flex: 1, minWidth: 0, width: "100%" }}>
          <Typography variant="h6" mb={1}>
            Companies
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} gap={1} mb={2}>
            <TextField
              size="small"
              label="New company name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              fullWidth
            />
            <TextField
              size="small"
              label="Email"
              value={companyEmail}
              onChange={(e) => setCompanyEmail(e.target.value)}
              fullWidth
            />
            <Button
              variant="contained"
              onClick={createCompany}
              disabled={!companyName}
              sx={{ flexShrink: 0 }}
            >
              Create company
            </Button>
          </Stack>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Cars</TableCell>
                <TableCell>ID</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {companies.map((c) => (
                <TableRow key={String(c._id)}>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{c.email}</TableCell>
                  <TableCell>{c.carCount}</TableCell>
                  <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>
                    {String(c._id)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>

        <Box sx={{ flex: 1, minWidth: 0, width: "100%" }}>
          <Typography variant="h6" mb={1}>
            Admin users
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} gap={1} mb={2}>
            <TextField
              size="small"
              select
              label="Owner company"
              value={userOwnerId}
              onChange={(e) => setUserOwnerId(e.target.value)}
              sx={{ minWidth: { sm: 140 }, flex: 1 }}
            >
              {companies.map((c) => (
                <MenuItem key={String(c._id)} value={String(c._id)}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              label="Admin email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              type="password"
              label="Password"
              value={userPassword}
              onChange={(e) => setUserPassword(e.target.value)}
              sx={{ flex: 1 }}
            />
            <Button
              variant="contained"
              onClick={createUser}
              disabled={!userEmail || !userPassword || !userOwnerId}
              sx={{ flexShrink: 0 }}
            >
              Create ADMIN
            </Button>
          </Stack>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Owner</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => (
                <TableRow key={String(u._id)}>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    {Number(u.role) === ROLE_SUPERADMIN
                      ? "SUPERADMIN"
                      : "ADMIN"}
                  </TableCell>
                  <TableCell>
                    {u.ownerId
                      ? companyNameById[String(u.ownerId)] || String(u.ownerId)
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Stack>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" mb={1}>
        Assign cars to owner
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} gap={1} mb={2}>
        <TextField
          size="small"
          select
          label="Owner"
          value={assignOwnerId}
          onChange={(e) => setAssignOwnerId(e.target.value)}
          sx={{ minWidth: 180 }}
        >
          {companies.map((c) => (
            <MenuItem key={String(c._id)} value={String(c._id)}>
              {c.name}
            </MenuItem>
          ))}
        </TextField>
        <Button
          variant="contained"
          onClick={assignCars}
          disabled={!assignOwnerId || selectedCarIds.length === 0}
        >
          Assign selected ({selectedCarIds.length})
        </Button>
      </Stack>

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox" />
            <TableCell>Model</TableCell>
            <TableCell>#</TableCell>
            <TableCell>Owner</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {cars.map((car) => {
            const id = String(car._id);
            const checked = selectedCarIds.includes(id);
            return (
              <TableRow
                key={id}
                hover
                selected={checked}
                onClick={() => toggleCar(id)}
                sx={{ cursor: "pointer" }}
              >
                <TableCell padding="checkbox">{checked ? "✓" : ""}</TableCell>
                <TableCell>{car.model}</TableCell>
                <TableCell>{car.carNumber}</TableCell>
                <TableCell>
                  {car.ownerId
                    ? companyNameById[String(car.ownerId)] || String(car.ownerId)
                    : "— unassigned"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}
