"use client";

import { useCallback, useEffect, useState } from "react";
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
  TextField,
  MenuItem,
  Stack,
  Chip,
  CircularProgress,
  Button,
  Pagination,
} from "@mui/material";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useTranslation } from "react-i18next";

function formatWhen(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

function StatChips({ title, items, labelKey }) {
  if (!items?.length) return null;
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
        {title}
      </Typography>
      <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>
        {items.map((item) => (
          <Chip
            key={`${item[labelKey]}-${item.count}`}
            size="small"
            label={`${item[labelKey] || "—"} · ${item.count}`}
            sx={{ maxWidth: 360 }}
          />
        ))}
      </Stack>
    </Box>
  );
}

export default function WebsiteVisitsSection() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [days, setDays] = useState(7);
  const [q, setQ] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [country, setCountry] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({
    visits: [],
    total: 0,
    limit: 50,
    stats: { byDay: [], byCountry: [], byPath: [] },
  });

  const fetchVisits = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        days: String(days),
        page: String(page),
        limit: "50",
      });
      if (q) params.set("q", q);
      if (country) params.set("country", country);

      const res = await fetch(`/api/admin/website-visits?${params}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load visits");
      }
      setData(json.data);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load visits");
    } finally {
      setLoading(false);
    }
  }, [days, page, q, country]);

  useEffect(() => {
    fetchVisits();
  }, [fetchVisits]);

  const pageCount = Math.max(1, Math.ceil((data.total || 0) / (data.limit || 50)));

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: "auto" }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        alignItems={{ sm: "center" }}
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Stack direction="row" spacing={1.25} alignItems="center">
          <TravelExploreIcon color="primary" />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {t("header.websiteVisits")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("admin.visits.subtitle")}
            </Typography>
          </Box>
        </Stack>
        <Button
          startIcon={<RefreshIcon />}
          variant="outlined"
          onClick={fetchVisits}
          disabled={loading}
        >
          {t("admin.visits.refresh")}
        </Button>
      </Stack>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          alignItems={{ md: "center" }}
        >
          <TextField
            select
            size="small"
            label={t("admin.visits.period")}
            value={days}
            onChange={(e) => {
              setPage(1);
              setDays(Number(e.target.value));
            }}
            sx={{ minWidth: 140 }}
          >
            {[1, 3, 7, 14, 30, 90].map((d) => (
              <MenuItem key={d} value={d}>
                {t("admin.visits.days", { count: d })}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label={t("admin.visits.country")}
            value={country}
            onChange={(e) => {
              setPage(1);
              setCountry(e.target.value);
            }}
            placeholder="Greece"
            sx={{ minWidth: 160 }}
          />
          <TextField
            size="small"
            label={t("admin.visits.search")}
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setPage(1);
                setQ(qDraft.trim());
              }
            }}
            placeholder="/en/cars, IP, city…"
            sx={{ flex: 1, minWidth: 200 }}
          />
          <Button
            variant="contained"
            onClick={() => {
              setPage(1);
              setQ(qDraft.trim());
            }}
          >
            {t("admin.visits.apply")}
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          {t("admin.visits.total", { count: data.total || 0 })}
        </Typography>
        <StatChips
          title={t("admin.visits.byDay")}
          items={data.stats?.byDay || []}
          labelKey="date"
        />
        <StatChips
          title={t("admin.visits.byCountry")}
          items={data.stats?.byCountry || []}
          labelKey="country"
        />
        <StatChips
          title={t("admin.visits.byPath")}
          items={data.stats?.byPath || []}
          labelKey="path"
        />
      </Paper>

      {error ? (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      ) : null}

      <TableContainer component={Paper}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t("admin.visits.when")}</TableCell>
                <TableCell>{t("admin.visits.page")}</TableCell>
                <TableCell>{t("admin.visits.location")}</TableCell>
                <TableCell>{t("admin.visits.lang")}</TableCell>
                <TableCell>IP</TableCell>
                <TableCell>{t("admin.visits.proof")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data.visits || []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    {t("admin.visits.empty")}
                  </TableCell>
                </TableRow>
              ) : (
                data.visits.map((visit) => (
                  <TableRow key={visit._id} hover>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      {formatWhen(visit.createdAt)}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 360 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={visit.url}
                      >
                        {visit.path || visit.url}
                      </Typography>
                      {visit.host ? (
                        <Typography variant="caption" color="text.secondary">
                          {visit.host}
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {[visit.city, visit.region, visit.country]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </TableCell>
                    <TableCell>{visit.language || "—"}</TableCell>
                    <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>
                      {visit.ip || "—"}
                    </TableCell>
                    <TableCell>{visit.proof || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      {pageCount > 1 ? (
        <Stack alignItems="center" sx={{ mt: 2 }}>
          <Pagination
            page={page}
            count={pageCount}
            onChange={(_, value) => setPage(value)}
            color="primary"
          />
        </Stack>
      ) : null}
    </Box>
  );
}
