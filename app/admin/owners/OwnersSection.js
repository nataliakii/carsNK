"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import Link from "next/link";
import { COMPANY_ID } from "@config/company";
import CompanyContactsCard from "@/app/admin/shared/components/CompanyContactsCard";
import EditCompanyContactsDialog from "@/app/admin/shared/components/EditCompanyContactsDialog";

const ROLE_ADMIN = 1;
const ROLE_SUPERADMIN = 2;

function shortId(id) {
  const s = String(id || "");
  if (s.length <= 10) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

export default function OwnersSection() {
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [cars, setCars] = useState([]);
  const [unassignedCarCount, setUnassignedCarCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [carQuery, setCarQuery] = useState("");
  const [carFilter, setCarFilter] = useState("all"); // all | company | unassigned | other
  const [selectedCarIds, setSelectedCarIds] = useState([]);

  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");

  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");

  const [editCompanyOpen, setEditCompanyOpen] = useState(false);
  const [editCompanyName, setEditCompanyName] = useState("");
  const [editCompanyEmail, setEditCompanyEmail] = useState("");
  const [editCompanyTel, setEditCompanyTel] = useState("");
  const [editCompanyBaseLat, setEditCompanyBaseLat] = useState("");
  const [editCompanyBaseLon, setEditCompanyBaseLon] = useState("");

  const [editAdminOpen, setEditAdminOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [editAdminEmail, setEditAdminEmail] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [ownersRes, carsRes] = await Promise.all([
        fetch("/api/admin/owners"),
        fetch("/api/car/all", { method: "POST", cache: "no-store" }),
      ]);
      const ownersBody = await ownersRes.json();
      if (!ownersRes.ok || !ownersBody.success) {
        throw new Error(ownersBody.message || "Failed to load owners");
      }
      const list = ownersBody.companies || [];
      setCompanies(list);
      setUsers(ownersBody.users || []);
      setUnassignedCarCount(ownersBody.unassignedCarCount || 0);
      setSelectedCompanyId((prev) => {
        if (prev && list.some((c) => String(c._id) === prev)) return prev;
        return list[0] ? String(list[0]._id) : "";
      });

      if (carsRes.ok) {
        const carsBody = await carsRes.json();
        const carList = Array.isArray(carsBody)
          ? carsBody
          : carsBody?.data || carsBody?.cars || [];
        setCars(carList);
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

  const selectedCompany = useMemo(
    () => companies.find((c) => String(c._id) === selectedCompanyId) || null,
    [companies, selectedCompanyId]
  );

  const adminsForCompany = useMemo(() => {
    if (!selectedCompanyId) return [];
    return users.filter(
      (u) =>
        Number(u.role) !== ROLE_SUPERADMIN &&
        String(u.ownerId || "") === selectedCompanyId
    );
  }, [users, selectedCompanyId]);

  const superadmins = useMemo(
    () => users.filter((u) => Number(u.role) === ROLE_SUPERADMIN),
    [users]
  );

  const adminCountByCompany = useMemo(() => {
    const map = {};
    for (const u of users) {
      if (Number(u.role) === ROLE_SUPERADMIN) continue;
      const oid = String(u.ownerId || "");
      if (!oid) continue;
      map[oid] = (map[oid] || 0) + 1;
    }
    return map;
  }, [users]);

  const filteredCars = useMemo(() => {
    const q = carQuery.trim().toLowerCase();
    return (cars || []).filter((car) => {
      const owner = car.ownerId ? String(car.ownerId) : "";
      if (carFilter === "company" && owner !== selectedCompanyId) return false;
      if (carFilter === "unassigned" && owner) return false;
      if (
        carFilter === "other" &&
        (!owner || owner === selectedCompanyId)
      ) {
        return false;
      }
      if (!q) return true;
      const hay = `${car.model || ""} ${car.carNumber || ""} ${car.regNumber || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [cars, carQuery, carFilter, selectedCompanyId]);

  const createCompany = async () => {
    setBusy(true);
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
      setCompanyDialogOpen(false);
      setOk(`Company created: ${body.company?.name}`);
      await load();
      if (body.company?._id) setSelectedCompanyId(String(body.company._id));
    } catch (err) {
      setError(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const createUser = async () => {
    setBusy(true);
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
          ownerId: selectedCompanyId,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.message || "Failed");
      setUserEmail("");
      setUserPassword("");
      setAdminDialogOpen(false);
      setOk(`Admin created for ${selectedCompany?.name || "company"}: ${body.user?.email}`);
      await load();
    } catch (err) {
      setError(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const openEditCompany = () => {
    if (!selectedCompany) return;
    setEditCompanyName(selectedCompany.name || "");
    setEditCompanyEmail(selectedCompany.email || "");
    setEditCompanyTel(selectedCompany.tel || "");
    setEditCompanyBaseLat(
      selectedCompany?.coords?.lat != null ? String(selectedCompany.coords.lat) : ""
    );
    setEditCompanyBaseLon(
      selectedCompany?.coords?.lon != null ? String(selectedCompany.coords.lon) : ""
    );
    setEditCompanyOpen(true);
  };

  const updateCompany = async () => {
    if (!selectedCompanyId) return;
    setBusy(true);
    setError("");
    setOk("");
    try {
      const res = await fetch(`/api/company/${selectedCompanyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editCompanyName,
          email: editCompanyEmail,
          tel: editCompanyTel,
          coords: {
            lat: editCompanyBaseLat,
            lon: editCompanyBaseLon,
          },
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || body.message || "Failed");
      setEditCompanyOpen(false);
      setOk(`Company updated: ${body.name}`);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("company-contacts-updated"));
      }
      await load();
    } catch (err) {
      setError(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const deleteCompany = async () => {
    if (!selectedCompany) return;
    const confirmed = window.confirm(
      `Delete "${selectedCompany.name}"?\n\nAll company admins will be removed. Cars must be reassigned first.`
    );
    if (!confirmed) return;
    setBusy(true);
    setError("");
    setOk("");
    try {
      const res = await fetch(`/api/admin/owners/${selectedCompanyId}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.message || "Failed");
      setOk(`Company deleted (${body.adminsRemoved || 0} admin(s) removed)`);
      setSelectedCompanyId("");
      await load();
    } catch (err) {
      setError(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const openEditAdmin = (admin) => {
    setEditingAdmin(admin);
    setEditAdminEmail(admin.email || "");
    setEditAdminOpen(true);
  };

  const updateAdminEmail = async () => {
    if (!editingAdmin?._id) return;
    setBusy(true);
    setError("");
    setOk("");
    try {
      const res = await fetch(`/api/admin/owners/users/${editingAdmin._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: editAdminEmail }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.message || "Failed");
      setEditAdminOpen(false);
      setEditingAdmin(null);
      setOk(`Email updated: ${body.user?.email}`);
      await load();
    } catch (err) {
      setError(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const deleteAdmin = async (admin) => {
    const confirmed = window.confirm(
      `Delete admin ${admin.email}? They will no longer be able to log in.`
    );
    if (!confirmed) return;
    setBusy(true);
    setError("");
    setOk("");
    try {
      const res = await fetch(`/api/admin/owners/users/${admin._id}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.message || "Failed");
      setOk(`Admin removed: ${admin.email}`);
      await load();
    } catch (err) {
      setError(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const sendAdminPasswordReset = async (admin) => {
    setBusy(true);
    setError("");
    setOk("");
    try {
      const res = await fetch(
        `/api/admin/owners/users/${admin._id}/reset-password`,
        { method: "POST" }
      );
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.message || "Failed");
      setOk(body.message || `Reset email sent to ${admin.email}`);
    } catch (err) {
      setError(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const assignCars = async (ownerId = selectedCompanyId) => {
    if (!ownerId || selectedCarIds.length === 0) return;
    setBusy(true);
    setError("");
    setOk("");
    try {
      const res = await fetch("/api/admin/owners/assign-cars", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId,
          carIds: selectedCarIds,
          updateOrders: true,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.message || "Failed");
      setSelectedCarIds([]);
      setOk(
        `Moved ${body.carsModified} cars to ${companyNameById[ownerId] || "company"} (orders updated: ${body.ordersModified})`
      );
      await load();
    } catch (err) {
      setError(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleCar = (id) => {
    const sid = String(id);
    setSelectedCarIds((prev) =>
      prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]
    );
  };

  const toggleAllFiltered = () => {
    const ids = filteredCars.map((c) => String(c._id));
    const allSelected =
      ids.length > 0 && ids.every((id) => selectedCarIds.includes(id));
    if (allSelected) {
      setSelectedCarIds((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedCarIds((prev) => Array.from(new Set([...prev, ...ids])));
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, display: "flex", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 1280, mx: "auto" }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ sm: "flex-start" }}
        gap={1.5}
        mb={2}
      >
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Partner companies
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Pick a company → manage its login and fleet. Superadmin sees
            everyone; each company admin only sees their cars.
          </Typography>
        </Box>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Button
            component={Link}
            href="/admin/access-tokens"
            variant="outlined"
            sx={{ textTransform: "none" }}
          >
            Access links
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCompanyDialogOpen(true)}
            sx={{ textTransform: "none" }}
          >
            New company
          </Button>
        </Stack>
      </Stack>

      <Stack direction="row" gap={1} flexWrap="wrap" mb={2}>
        <Chip label={`${companies.length} companies`} size="small" />
        <Chip
          label={`${users.filter((u) => Number(u.role) === ROLE_ADMIN).length} company admins`}
          size="small"
        />
        <Chip
          color={unassignedCarCount > 0 ? "warning" : "default"}
          label={`${unassignedCarCount} unassigned cars`}
          size="small"
        />
        {superadmins.length > 0 ? (
          <Chip
            variant="outlined"
            label={`Superadmin: ${superadmins.map((u) => u.email).join(", ")}`}
            size="small"
          />
        ) : null}
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      ) : null}
      {ok ? (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setOk("")}>
          {ok}
        </Alert>
      ) : null}

      <Stack
        direction={{ xs: "column", md: "row" }}
        gap={2}
        alignItems="stretch"
      >
        {/* Company list */}
        <Box
          sx={{
            width: { xs: "100%", md: 300 },
            flexShrink: 0,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            bgcolor: "background.paper",
            overflow: "hidden",
          }}
        >
          <Box sx={{ px: 2, py: 1.25, borderBottom: "1px solid", borderColor: "divider" }}>
            <Typography variant="subtitle2" fontWeight={700}>
              Companies
            </Typography>
          </Box>
          <List dense disablePadding>
            {companies.map((c) => {
              const id = String(c._id);
              const selected = id === selectedCompanyId;
              return (
                <ListItemButton
                  key={id}
                  selected={selected}
                  onClick={() => {
                    setSelectedCompanyId(id);
                    setSelectedCarIds([]);
                    setCarFilter("company");
                  }}
                  sx={{ py: 1.25, alignItems: "flex-start" }}
                >
                  <ListItemText
                    primary={
                      <Typography fontWeight={selected ? 700 : 600}>
                        {c.name}
                      </Typography>
                    }
                    secondary={
                      <Stack
                        component="span"
                        direction="row"
                        gap={0.75}
                        flexWrap="wrap"
                        useFlexGap
                        sx={{ mt: 0.5 }}
                      >
                        <Chip
                          size="small"
                          icon={<DirectionsCarIcon />}
                          label={`${c.carCount || 0} cars`}
                          sx={{ height: 22, "& .MuiChip-label": { px: 0.75 } }}
                        />
                        <Chip
                          size="small"
                          label={`${adminCountByCompany[id] || 0} admins`}
                          sx={{ height: 22, "& .MuiChip-label": { px: 0.75 } }}
                        />
                      </Stack>
                    }
                    secondaryTypographyProps={{ component: "div" }}
                  />
                </ListItemButton>
              );
            })}
            {companies.length === 0 ? (
              <Box sx={{ p: 2 }}>
                <Typography color="text.secondary" variant="body2">
                  No companies yet. Create the first partner.
                </Typography>
              </Box>
            ) : null}
          </List>
        </Box>

        {/* Detail */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {!selectedCompany ? (
            <Alert severity="info">Select a company on the left.</Alert>
          ) : (
            <Stack gap={2}>
              <CompanyContactsCard
                company={selectedCompany}
                onEdit={openEditCompany}
                canEdit
                actions={
                  <>
                    <Button
                      variant="outlined"
                      startIcon={<PersonAddIcon />}
                      onClick={() => setAdminDialogOpen(true)}
                      sx={{ textTransform: "none" }}
                    >
                      Add admin
                    </Button>
                    {String(selectedCompany._id) !== String(COMPANY_ID) ? (
                      <Button
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={deleteCompany}
                        disabled={busy || (selectedCompany.carCount || 0) > 0}
                        sx={{ textTransform: "none" }}
                      >
                        Delete company
                      </Button>
                    ) : null}
                  </>
                }
              />

              <Box
                sx={{
                  p: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  bgcolor: "background.paper",
                }}
              >
                <Typography variant="subtitle1" fontWeight={700} mb={1}>
                  Admins for this company
                </Typography>
                {adminsForCompany.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" mb={1}>
                    No company admin yet. Add one so they can log in and manage
                    only this fleet.
                  </Typography>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Email</TableCell>
                        <TableCell>Username</TableCell>
                        <TableCell>Role</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {adminsForCompany.map((u) => (
                        <TableRow key={String(u._id)}>
                          <TableCell>{u.email}</TableCell>
                          <TableCell>{u.username || "—"}</TableCell>
                          <TableCell>
                            <Chip size="small" label="ADMIN" color="primary" variant="outlined" />
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" gap={0.5} justifyContent="flex-end">
                              <Tooltip title="Change email">
                                <IconButton
                                  size="small"
                                  onClick={() => openEditAdmin(u)}
                                  disabled={busy}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Send password reset email">
                                <IconButton
                                  size="small"
                                  onClick={() => sendAdminPasswordReset(u)}
                                  disabled={busy}
                                >
                                  <MailOutlineIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete admin">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => deleteAdmin(u)}
                                  disabled={busy}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Box>

              <Box
                sx={{
                  p: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  bgcolor: "background.paper",
                }}
              >
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  justifyContent="space-between"
                  gap={1}
                  mb={1.5}
                  alignItems={{ sm: "center" }}
                >
                  <Typography variant="subtitle1" fontWeight={700}>
                    Fleet assignment
                  </Typography>
                  <Button
                    variant="contained"
                    disabled={busy || !selectedCompanyId || selectedCarIds.length === 0}
                    onClick={() => assignCars(selectedCompanyId)}
                    sx={{ textTransform: "none" }}
                  >
                    Assign to {selectedCompany.name} ({selectedCarIds.length})
                  </Button>
                </Stack>

                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  gap={1}
                  mb={1.5}
                  flexWrap="wrap"
                >
                  <TextField
                    size="small"
                    placeholder="Search model / number"
                    value={carQuery}
                    onChange={(e) => setCarQuery(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                    sx={{ minWidth: 220, flex: 1 }}
                  />
                  <TextField
                    size="small"
                    select
                    label="Show"
                    value={carFilter}
                    onChange={(e) => setCarFilter(e.target.value)}
                    sx={{ minWidth: 180 }}
                  >
                    <MenuItem value="company">This company</MenuItem>
                    <MenuItem value="unassigned">Unassigned only</MenuItem>
                    <MenuItem value="other">Other companies</MenuItem>
                    <MenuItem value="all">All cars</MenuItem>
                  </TextField>
                </Stack>

                {unassignedCarCount > 0 && carFilter !== "unassigned" ? (
                  <Alert
                    severity="warning"
                    sx={{ mb: 1.5 }}
                    action={
                      <Button
                        color="inherit"
                        size="small"
                        onClick={() => setCarFilter("unassigned")}
                        sx={{ textTransform: "none" }}
                      >
                        Show
                      </Button>
                    }
                  >
                    {unassignedCarCount} cars have no company — assign them here.
                  </Alert>
                ) : null}

                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          size="small"
                          indeterminate={
                            filteredCars.some((c) =>
                              selectedCarIds.includes(String(c._id))
                            ) &&
                            !filteredCars.every((c) =>
                              selectedCarIds.includes(String(c._id))
                            )
                          }
                          checked={
                            filteredCars.length > 0 &&
                            filteredCars.every((c) =>
                              selectedCarIds.includes(String(c._id))
                            )
                          }
                          onChange={toggleAllFiltered}
                        />
                      </TableCell>
                      <TableCell>Car</TableCell>
                      <TableCell>#</TableCell>
                      <TableCell>Owner</TableCell>
                      <TableCell>Site</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredCars.map((car) => {
                      const id = String(car._id);
                      const checked = selectedCarIds.includes(id);
                      const ownerLabel = car.ownerId
                        ? companyNameById[String(car.ownerId)] || shortId(car.ownerId)
                        : "Unassigned";
                      return (
                        <TableRow
                          key={id}
                          hover
                          selected={checked}
                          onClick={() => toggleCar(id)}
                          sx={{ cursor: "pointer" }}
                        >
                          <TableCell padding="checkbox">
                            <Checkbox size="small" checked={checked} />
                          </TableCell>
                          <TableCell>{car.model}</TableCell>
                          <TableCell>{car.carNumber}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              color={!car.ownerId ? "warning" : "default"}
                              variant={!car.ownerId ? "filled" : "outlined"}
                              label={ownerLabel}
                            />
                          </TableCell>
                          <TableCell>
                            {car.isActive === false ? (
                              <Chip size="small" color="default" label="Hidden" />
                            ) : (
                              <Chip size="small" color="success" variant="outlined" label="Active" />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredCars.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Typography color="text.secondary" variant="body2">
                            No cars match this filter.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </Box>
            </Stack>
          )}
        </Box>
      </Stack>

      <Dialog
        open={companyDialogOpen}
        onClose={() => !busy && setCompanyDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>New partner company</DialogTitle>
        <DialogContent>
          <Stack gap={1.5} sx={{ pt: 1 }}>
            <TextField
              label="Company name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              autoFocus
              fullWidth
            />
            <TextField
              label="Email (optional)"
              value={companyEmail}
              onChange={(e) => setCompanyEmail(e.target.value)}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCompanyDialogOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={createCompany}
            disabled={busy || !companyName.trim()}
            sx={{ textTransform: "none" }}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={adminDialogOpen}
        onClose={() => !busy && setAdminDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          Add admin
          {selectedCompany ? ` — ${selectedCompany.name}` : ""}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            This login will only see cars and orders for this company.
          </Typography>
          <Stack gap={1.5}>
            <TextField
              label="Email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              autoFocus
              fullWidth
            />
            <TextField
              type="password"
              label="Password (min 6)"
              value={userPassword}
              onChange={(e) => setUserPassword(e.target.value)}
              fullWidth
            />
            <FormControlLabel
              control={<Checkbox checked disabled />}
              label={`Owner: ${selectedCompany?.name || "—"}`}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAdminDialogOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={createUser}
            disabled={
              busy ||
              !selectedCompanyId ||
              !userEmail.trim() ||
              userPassword.trim().length < 6
            }
            sx={{ textTransform: "none" }}
          >
            Create admin
          </Button>
        </DialogActions>
      </Dialog>

      <EditCompanyContactsDialog
        open={editCompanyOpen}
        busy={busy}
        name={editCompanyName}
        email={editCompanyEmail}
        tel={editCompanyTel}
        baseLat={editCompanyBaseLat}
        baseLon={editCompanyBaseLon}
        lockName={String(selectedCompanyId) === String(COMPANY_ID)}
        onNameChange={setEditCompanyName}
        onEmailChange={setEditCompanyEmail}
        onTelChange={setEditCompanyTel}
        onBaseLatChange={setEditCompanyBaseLat}
        onBaseLonChange={setEditCompanyBaseLon}
        onClose={() => setEditCompanyOpen(false)}
        onSave={updateCompany}
      />

      <Dialog
        open={editAdminOpen}
        onClose={() => !busy && setEditAdminOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Change admin email</DialogTitle>
        <DialogContent>
          <Stack gap={1.5} sx={{ pt: 1 }}>
            <TextField
              label="Email"
              type="email"
              value={editAdminEmail}
              onChange={(e) => setEditAdminEmail(e.target.value)}
              autoFocus
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditAdminOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={updateAdminEmail}
            disabled={busy || !editAdminEmail.trim()}
            sx={{ textTransform: "none" }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
