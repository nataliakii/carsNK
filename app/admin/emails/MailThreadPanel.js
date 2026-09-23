"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
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
  Chip,
  CircularProgress,
  Button,
  Pagination,
  Collapse,
} from "@mui/material";
import ReplayIcon from "@mui/icons-material/Replay";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useTranslation } from "react-i18next";

function formatWhen(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

function typeLabelKey(type) {
  return `admin.emails.types.${String(type || "generic").replace(/\./g, "_")}`;
}

function statusColor(status) {
  return status === "failed" ? "error" : "success";
}

export default function MailThreadPanel({
  orderId = "",
  companyId = "",
  recipient = "",
  type = "",
  status = "",
  page,
  onPageChange,
  compact = false,
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState({ items: [], total: 0, limit: 50, page: 1 });
  const [resendingId, setResendingId] = useState("");
  const [previewId, setPreviewId] = useState("");
  const [preview, setPreview] = useState(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page || 1),
        limit: compact ? "20" : "50",
      });
      if (orderId) params.set("orderId", orderId);
      if (companyId) params.set("companyId", companyId);
      if (recipient) params.set("recipient", recipient);
      if (type && type !== "all") params.set("type", type);
      if (status && status !== "all") params.set("status", status);

      const res = await fetch(`/api/admin/mail-log?${params}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load mail log");
      }
      setData(json.data);
    } catch (err) {
      setError(err.message || "Failed to load mail log");
    } finally {
      setLoading(false);
    }
  }, [orderId, companyId, recipient, type, status, page, compact]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleResend = async (id) => {
    setResendingId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/mail-log/${id}/resend`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.message || t("admin.emails.resendFailed"));
      }
      await fetchLogs();
    } catch (err) {
      setError(err.message || t("admin.emails.resendFailed"));
    } finally {
      setResendingId("");
    }
  };

  const togglePreview = async (id) => {
    if (previewId === id) {
      setPreviewId("");
      setPreview(null);
      return;
    }
    setPreviewId(id);
    setPreview(null);
    try {
      const res = await fetch(`/api/admin/mail-log/${id}`);
      const json = await res.json();
      if (res.ok && json.success) setPreview(json.data);
    } catch {
      setPreview(null);
    }
  };

  const pageCount = Math.max(1, Math.ceil((data.total || 0) / (data.limit || 50)));
  const items = data.items || [];

  return (
    <Box>
      {error ? (
        <Typography color="error" sx={{ mb: 1 }}>
          {error}
        </Typography>
      ) : null}

      <TableContainer component={compact ? Box : Paper}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={compact ? 24 : 40} />
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t("admin.emails.when")}</TableCell>
                <TableCell>{t("admin.emails.to")}</TableCell>
                {!compact ? <TableCell>{t("admin.emails.type")}</TableCell> : null}
                <TableCell>{t("admin.emails.subject")}</TableCell>
                <TableCell>{t("admin.emails.status")}</TableCell>
                <TableCell align="right">{t("admin.emails.actions")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={compact ? 5 : 6} align="center">
                    {t("admin.emails.empty")}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((row) => (
                  <Fragment key={row.id}>
                    <TableRow hover>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        {formatWhen(row.sentAt)}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 220 }}>
                        <Typography variant="body2" noWrap title={(row.to || []).join(", ")}>
                          {(row.to || []).join(", ") || "—"}
                        </Typography>
                        {row.resentFromId ? (
                          <Typography variant="caption" color="text.secondary">
                            {t("admin.emails.resendOf")}
                          </Typography>
                        ) : null}
                      </TableCell>
                      {!compact ? (
                        <TableCell>
                          {t(typeLabelKey(row.type), {
                            defaultValue: row.type,
                          })}
                        </TableCell>
                      ) : null}
                      <TableCell sx={{ maxWidth: 280 }}>
                        <Typography variant="body2" noWrap title={row.subject}>
                          {row.subject || "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={statusColor(row.status)}
                          label={t(`admin.emails.statusValue.${row.status}`, {
                            defaultValue: row.status,
                          })}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                        <Button
                          size="small"
                          onClick={() => togglePreview(row.id)}
                          endIcon={
                            previewId === row.id ? (
                              <ExpandLessIcon fontSize="small" />
                            ) : (
                              <ExpandMoreIcon fontSize="small" />
                            )
                          }
                          sx={{ textTransform: "none", mr: 0.5 }}
                        >
                          {t("admin.emails.preview")}
                        </Button>
                        <Button
                          size="small"
                          startIcon={<ReplayIcon />}
                          onClick={() => handleResend(row.id)}
                          disabled={Boolean(resendingId)}
                          sx={{ textTransform: "none" }}
                        >
                          {resendingId === row.id
                            ? t("admin.emails.resending")
                            : t("admin.emails.resend")}
                        </Button>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell
                        colSpan={compact ? 5 : 6}
                        sx={{ py: 0, borderBottom: previewId === row.id ? undefined : "none" }}
                      >
                        <Collapse in={previewId === row.id} unmountOnExit>
                          <Box sx={{ py: 1.5, px: 1 }}>
                            {preview?.html ? (
                              <Box
                                sx={{
                                  maxHeight: 280,
                                  overflow: "auto",
                                  border: "1px solid",
                                  borderColor: "divider",
                                  borderRadius: 1,
                                  p: 1,
                                  bgcolor: "background.paper",
                                }}
                                dangerouslySetInnerHTML={{ __html: preview.html }}
                              />
                            ) : (
                              <Typography
                                variant="body2"
                                sx={{ whiteSpace: "pre-wrap" }}
                              >
                                {preview?.text || t("admin.emails.noBody")}
                              </Typography>
                            )}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      {pageCount > 1 && onPageChange ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
          <Pagination
            page={page || data.page || 1}
            count={pageCount}
            onChange={(_, value) => onPageChange(value)}
            color="primary"
            size={compact ? "small" : "medium"}
          />
        </Box>
      ) : null}
    </Box>
  );
}
