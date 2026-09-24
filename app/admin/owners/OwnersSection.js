"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import SearchIcon from "@mui/icons-material/Search";
import DeleteIcon from "@mui/icons-material/Delete";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { COMPANY_ID } from "@config/company";
import CompanyContactsCard from "@/app/admin/shared/components/CompanyContactsCard";
import EditCompanyContactsDialog from "@/app/admin/shared/components/EditCompanyContactsDialog";
import CompanyStorefrontCard from "@/app/admin/shared/components/CompanyStorefrontCard";
import CompanyRentalPaymentsCard from "@/app/admin/shared/components/CompanyRentalPaymentsCard";
import { useAdminCountryFilter } from "@app/hooks/useAdminCountryFilter";
import { useAdminViewAs } from "@app/hooks/useAdminViewAs";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import { useTranslation } from "react-i18next";
import {
  meetingContactsFromCompany,
  meetingContactsUpdatePayload,
} from "@/domain/company/meetingContacts";
import CompanyAdminsPanel from "@/app/admin/shared/components/CompanyAdminsPanel";
import CompanyServiceAreasPanel from "@/app/admin/shared/components/CompanyServiceAreasPanel";
import { adminSectionTabsSx } from "@app/admin/shared/components/AdminSectionTabs";
import PartnerLegalTab from "@/app/admin/owners/PartnerLegalTab";
import {
  PARTNER_TAB,
  canManageCompanyAdmins,
  normalizePartnerTab,
  visiblePartnerTabIds,
} from "@/domain/admin/companyAdmins";

const ROLE_ADMIN = 1;
const ROLE_SUPERADMIN = 2;

function shortId(id) {
  const s = String(id || "");
  if (s.length <= 10) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

export default function OwnersSection({ viewMode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { enter: enterViewAs, loading: viewAsLoading } = useAdminViewAs();
  const canManageAdmins = canManageCompanyAdmins(session?.user);
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [cars, setCars] = useState([]);
  const [unassignedCarCount, setUnassignedCarCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const urlCompanyId = searchParams?.get("companyId") || "";
  const [selectedCompanyId, setSelectedCompanyId] = useState(urlCompanyId);
  const tab = normalizePartnerTab(searchParams?.get("section"), {
    canManageAdmins,
  });
  const [carQuery, setCarQuery] = useState("");
  const [carFilter, setCarFilter] = useState("all"); // all | company | unassigned | other
  const [selectedCarIds, setSelectedCarIds] = useState([]);

  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");

  const [editCompanyOpen, setEditCompanyOpen] = useState(false);
  const [editCompanyName, setEditCompanyName] = useState("");
  const [editCompanyEmail, setEditCompanyEmail] = useState("");
  const [editCompanyTel, setEditCompanyTel] = useState("");
  const [editCompanyBaseLat, setEditCompanyBaseLat] = useState("");
  const [editCompanyBaseLon, setEditCompanyBaseLon] = useState("");
  const [editCompanyMeetingContacts, setEditCompanyMeetingContacts] = useState(
    () => meetingContactsFromCompany(null)
  );

  const [storefrontOpen, setStorefrontOpen] = useState(false);

  const { country: adminCountry } = useAdminCountryFilter();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const ownersUrl =
        adminCountry && adminCountry !== "ALL"
          ? `/api/admin/owners?country=${encodeURIComponent(adminCountry)}`
          : "/api/admin/owners?country=ALL";
      const [ownersRes, carsRes] = await Promise.all([
        fetch(ownersUrl),
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
  }, [adminCountry]);

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
    const countryOwnerIds = new Set(companies.map((c) => String(c._id)));
    return (cars || []).filter((car) => {
      const owner = car.ownerId ? String(car.ownerId) : "";
      // When country filter is active, only show cars of listed companies + unassigned
      if (
        adminCountry !== "ALL" &&
        owner &&
        !countryOwnerIds.has(owner)
      ) {
        return false;
      }
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
  }, [cars, carQuery, carFilter, selectedCompanyId, companies, adminCountry]);

  const createCompany = async () => {
    setBusy(true);
    setError("");
    setOk("");
    try {
      const res = await fetch("/api/admin/owners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: companyName,
          email: companyEmail,
          country: adminCountry === "ALL" ? undefined : adminCountry,
        }),
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

  const openCompanyAdmin = async () => {
    if (!selectedCompanyId) return;
    setError("");
    setOk("");
    const result = await enterViewAs(selectedCompanyId);
    if (!result.ok) {
      setError(result.message || "Failed to open company admin");
      return;
    }
    setOk(`Viewing as ${result.company?.name || "company"}`);
    router.push("/admin/orders-calendar");
    router.refresh();
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
    setEditCompanyMeetingContacts(meetingContactsFromCompany(selectedCompany));
    setEditCompanyOpen(true);
  };

  const updateCompany = async () => {
    if (!selectedCompanyId) return;
    setBusy(true);
    setError("");
    setOk("");
    try {
      const meetingPayload = meetingContactsUpdatePayload(
        editCompanyMeetingContacts
      );
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
          ...meetingPayload,
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

  /** Company and tab live in the URL so every tab is deep-linkable. */
  const writeUrl = useCallback(
    (companyId, section) => {
      const params = new URLSearchParams(searchParams?.toString() || "");
      params.set("tab", "all");
      params.delete("filter");
      if (companyId) params.set("companyId", String(companyId));
      else params.delete("companyId");
      if (section) params.set("section", section);
      else params.delete("section");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const selectCompany = useCallback(
    (companyId, section = tab) => {
      setSelectedCompanyId(String(companyId));
      setSelectedCarIds([]);
      setCarFilter("company");
      writeUrl(companyId, section);
    },
    [tab, writeUrl]
  );

  // Follow a deep link (for example the "N admins" badge) into this page.
  useEffect(() => {
    if (urlCompanyId && urlCompanyId !== selectedCompanyId) {
      setSelectedCompanyId(urlCompanyId);
    }
  }, [urlCompanyId, selectedCompanyId]);

  if (loading) {
    return (
      <Box sx={{ p: 3, display: "flex", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 1400, mx: "auto", width: "100%" }}>
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

      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          {t("admin.companies.legalHelperPlatform")}
        </Typography>
        <Typography variant="body2">
          {t("admin.companies.legalHelperPartner")}
        </Typography>
      </Alert>

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
        sx={{ width: "100%" }}
      >
        {/* Company list */}
        <Box
          sx={{
            width: { xs: "100%", md: 280 },
            flexShrink: 0,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            bgcolor: "background.paper",
            overflow: "hidden",
            alignSelf: { md: "flex-start" },
            position: { md: "sticky" },
            top: { md: 80 },
            maxHeight: { md: "calc(100dvh - 96px)" },
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box sx={{ px: 2, py: 1.25, borderBottom: "1px solid", borderColor: "divider", flexShrink: 0 }}>
            <Typography variant="subtitle2" fontWeight={700}>
              Partners
            </Typography>
          </Box>
          <List dense disablePadding sx={{ overflowY: "auto", flex: 1 }}>
            {companies.map((c) => {
              const id = String(c._id);
              const selected = id === selectedCompanyId;
              return (
                <ListItemButton
                  key={id}
                  selected={selected}
                  onClick={() => selectCompany(id)}
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
                          clickable={canManageAdmins}
                          label={t("admin.partners.adminCount", {
                            count: adminCountByCompany[id] || 0,
                          })}
                          onClick={
                            canManageAdmins
                              ? (event) => {
                                  // Open this company straight on its Admins tab.
                                  event.stopPropagation();
                                  selectCompany(id, PARTNER_TAB.ADMINS);
                                }
                              : undefined
                          }
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
        <Box sx={{ flex: 1, minWidth: 0, width: "100%" }}>
          {!selectedCompany ? (
            <Alert severity="info">Select a company on the left.</Alert>
          ) : (
            <Stack gap={2} sx={{ width: "100%" }}>
              <Tabs
                value={tab}
                onChange={(_, next) => selectCompany(selectedCompanyId, next)}
                variant="scrollable"
                allowScrollButtonsMobile
                sx={{ ...adminSectionTabsSx, px: 0 }}
              >
                {visiblePartnerTabIds({ canManageAdmins }).map((id) => (
                  <Tab
                    key={id}
                    value={id}
                    label={t(`admin.partnerTabs.${id}`)}
                  />
                ))}
              </Tabs>

              {tab === PARTNER_TAB.OVERVIEW ? (
                <>
              <CompanyContactsCard
                company={selectedCompany}
                onEdit={openEditCompany}
                canEdit
                actions={
                  <>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<AssignmentTurnedInIcon />}
                      onClick={() =>
                        selectCompany(selectedCompanyId, PARTNER_TAB.LEGAL)
                      }
                      disabled={busy || viewAsLoading || !selectedCompanyId}
                    >
                      {t("admin.companies.reviewLegal")}
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<OpenInNewIcon />}
                      onClick={openCompanyAdmin}
                      disabled={busy || viewAsLoading || !selectedCompanyId}
                    >
                      Open company admin
                    </Button>
                    {String(selectedCompany._id) !== String(COMPANY_ID) ? (
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={deleteCompany}
                        disabled={busy || (selectedCompany.carCount || 0) > 0}
                      >
                        Delete company
                      </Button>
                    ) : null}
                  </>
                }
              />

              <Box
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  p: 1.5,
                  bgcolor: "background.paper",
                }}
              >
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  alignItems={{ sm: "center" }}
                  justifyContent="space-between"
                >
                  <Typography variant="body2" color="text.secondary">
                    {t("admin.companies.storefrontHint")}
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => setStorefrontOpen((open) => !open)}
                    sx={{ textTransform: "none", flexShrink: 0 }}
                  >
                    {storefrontOpen
                      ? t("admin.companies.hideStorefront")
                      : t("admin.companies.showStorefront")}
                  </Button>
                </Stack>
                <Collapse in={storefrontOpen}>
                  <Box sx={{ mt: 2 }}>
                    <CompanyStorefrontCard
                      company={selectedCompany}
                      onEditBaseLocation={openEditCompany}
                      onSaved={(updated) => {
                        setCompanies((prev) =>
                          prev.map((item) =>
                            String(item._id) === String(updated._id)
                              ? { ...item, ...updated }
                              : item
                          )
                        );
                        setOk(`Company updated: ${updated.name}`);
                      }}
                    />
                  </Box>
                </Collapse>
              </Box>

              <CompanyRentalPaymentsCard
                company={selectedCompany}
                onSaved={(updated) => {
                  setCompanies((prev) =>
                    prev.map((item) =>
                      String(item._id) === String(updated._id)
                        ? { ...item, ...updated }
                        : item
                    )
                  );
                  setOk(`Company updated: ${updated.name}`);
                }}
              />
                </>
              ) : null}

              {tab === PARTNER_TAB.ADMINS ? (
                <Box
                  sx={{
                    p: { xs: 1.5, sm: 2 },
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    bgcolor: "background.paper",
                    minWidth: 0,
                  }}
                >
                  <CompanyAdminsPanel
                    companyId={selectedCompanyId}
                    companyName={selectedCompany.name}
                  />
                </Box>
              ) : null}

              {tab === PARTNER_TAB.LEGAL ? (
                <PartnerLegalTab
                  companyId={selectedCompanyId}
                  viewMode={viewMode}
                />
              ) : null}

              {tab === PARTNER_TAB.COVERAGE ? (
                <CompanyServiceAreasPanel
                  company={selectedCompany}
                  onSaved={(updated) => {
                    setCompanies((prev) =>
                      prev.map((item) =>
                        String(item._id) === String(updated._id)
                          ? { ...item, ...updated }
                          : item
                      )
                    );
                    setOk(`Company updated: ${updated.name}`);
                  }}
                />
              ) : null}

              {tab === PARTNER_TAB.CARS ? (
              <Box
                sx={{
                  p: { xs: 1.5, sm: 2 },
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  bgcolor: "background.paper",
                  minWidth: 0,
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
              ) : null}
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
            <Typography variant="body2" color="text.secondary">
              Will be saved for country:{" "}
              <strong>
                {adminCountry === "ALL"
                  ? process.env.NEXT_PUBLIC_SITE_COUNTRY || "site default"
                  : adminCountry}
              </strong>
            </Typography>
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

      <EditCompanyContactsDialog
        open={editCompanyOpen}
        busy={busy}
        name={editCompanyName}
        email={editCompanyEmail}
        tel={editCompanyTel}
        baseLat={editCompanyBaseLat}
        baseLon={editCompanyBaseLon}
        meetingContacts={editCompanyMeetingContacts}
        lockName={String(selectedCompanyId) === String(COMPANY_ID)}
        onNameChange={setEditCompanyName}
        onEmailChange={setEditCompanyEmail}
        onTelChange={setEditCompanyTel}
        onBaseLatChange={setEditCompanyBaseLat}
        onBaseLonChange={setEditCompanyBaseLon}
        onMeetingContactsChange={setEditCompanyMeetingContacts}
        onClose={() => setEditCompanyOpen(false)}
        onSave={updateCompany}
      />

    </Box>
  );
}
