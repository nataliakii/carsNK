"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
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
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { useSession } from "next-auth/react";
import { useTranslation } from "react-i18next";
import { ROLE } from "@/domain/orders/admin-rbac";
import {
  adminCardSx,
  adminReadableTextSx,
} from "@/app/admin/shared/components/AdminSettingsSection";
import SendMyPasswordResetButton from "@/app/admin/shared/components/SendMyPasswordResetButton";

function generateStrongPassword(length = 16) {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%&*-_=+?";
  const all = upper + lower + digits + symbols;
  const pick = (charset) => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return charset[buf[0] % charset.length];
  };
  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const j = buf[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export default function CompanyAdminsCard({ companyId, companyName = "" }) {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const canManage = Number(session?.user?.role) === ROLE.SUPERADMIN;
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(Boolean(companyId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [editEmail, setEditEmail] = useState("");

  const load = useCallback(async () => {
    if (!companyId) {
      setAdmins([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/owners/users?ownerId=${encodeURIComponent(companyId)}`,
        { cache: "no-store" }
      );
      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.message || t("companyProfile.adminsLoadFailed"));
      }
      setAdmins(Array.isArray(body.users) ? body.users : []);
    } catch (err) {
      setError(err.message || t("companyProfile.adminsLoadFailed"));
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const createAdmin = async () => {
    if (!companyId) return;
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
          role: ROLE.ADMIN,
          ownerId: companyId,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.message || "Failed");
      setUserEmail("");
      setUserPassword("");
      setShowPassword(false);
      setPasswordCopied(false);
      setAddOpen(false);
      setOk(
        t("companyProfile.adminCreated", {
          email: body.user?.email || userEmail,
        })
      );
      await load();
    } catch (err) {
      setError(err.message || "Failed");
    } finally {
      setBusy(false);
    }
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
        body: JSON.stringify({ email: editEmail }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.message || "Failed");
      setEditOpen(false);
      setEditingAdmin(null);
      setOk(
        t("companyProfile.adminEmailUpdated", {
          email: body.user?.email || editEmail,
        })
      );
      await load();
    } catch (err) {
      setError(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const deleteAdmin = async (admin) => {
    const confirmed = window.confirm(
      t("companyProfile.adminDeleteConfirm", { email: admin.email })
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
      setOk(t("companyProfile.adminRemoved", { email: admin.email }));
      await load();
    } catch (err) {
      setError(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const sendPasswordReset = async (admin) => {
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
      setOk(
        body.message ||
          t("companyProfile.adminResetSent", { email: admin.email })
      );
    } catch (err) {
      setError(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (!companyId) return null;

  return (
    <Box sx={adminCardSx}>
      <Stack
        direction="row"
        alignItems="flex-start"
        justifyContent="space-between"
        gap={1}
        flexWrap="wrap"
        sx={{ mb: 1.5 }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            variant="h6"
            fontWeight={700}
            sx={{ fontSize: { xs: "1.05rem", sm: "1.25rem" }, ...adminReadableTextSx }}
          >
            {t("companyProfile.adminsTitle")}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.5, whiteSpace: "normal", lineHeight: 1.5, ...adminReadableTextSx }}
          >
            {t("companyProfile.adminsHelp")}
          </Typography>
        </Box>
        {canManage ? (
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => {
              setUserEmail("");
              setUserPassword("");
              setShowPassword(false);
              setPasswordCopied(false);
              setAddOpen(true);
            }}
            disabled={busy}
            sx={{ textTransform: "none", flexShrink: 0 }}
          >
            {t("companyProfile.addAdmin")}
          </Button>
        ) : (
          <SendMyPasswordResetButton variant="outlined" />
        )}
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError("")}>
          {error}
        </Alert>
      ) : null}
      {ok ? (
        <Alert severity="success" sx={{ mb: 1.5 }} onClose={() => setOk("")}>
          {ok}
        </Alert>
      ) : null}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <CircularProgress size={28} />
        </Box>
      ) : admins.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={adminReadableTextSx}>
          {t("companyProfile.adminsEmpty")}
        </Typography>
      ) : (
        <Box sx={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t("companyProfile.adminEmail")}</TableCell>
                <TableCell>{t("companyProfile.adminUsername")}</TableCell>
                <TableCell>{t("companyProfile.adminRole")}</TableCell>
                {canManage ? (
                  <TableCell align="right">
                    {t("companyProfile.adminActions")}
                  </TableCell>
                ) : null}
              </TableRow>
            </TableHead>
            <TableBody>
              {admins.map((u) => (
                <TableRow key={String(u._id)}>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.username || "—"}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label="ADMIN"
                      color="primary"
                      variant="outlined"
                    />
                  </TableCell>
                  {canManage ? (
                    <TableCell align="right">
                      <Stack direction="row" gap={0.5} justifyContent="flex-end">
                        <Tooltip title={t("companyProfile.adminChangeEmail")}>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setEditingAdmin(u);
                              setEditEmail(u.email || "");
                              setEditOpen(true);
                            }}
                            disabled={busy}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t("companyProfile.adminSendReset")}>
                          <IconButton
                            size="small"
                            onClick={() => sendPasswordReset(u)}
                            disabled={busy}
                          >
                            <MailOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t("companyProfile.adminDelete")}>
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
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      <Dialog
        open={addOpen}
        onClose={() => !busy && setAddOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          {t("companyProfile.addAdmin")}
          {companyName ? ` — ${companyName}` : ""}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {t("companyProfile.addAdminHelp")}
          </Typography>
          <Stack gap={1.5}>
            <TextField
              label={t("companyProfile.adminEmail")}
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              autoFocus
              fullWidth
            />
            <TextField
              type={showPassword ? "text" : "password"}
              label={t("companyProfile.adminPassword")}
              value={userPassword}
              onChange={(e) => {
                setUserPassword(e.target.value);
                setPasswordCopied(false);
              }}
              fullWidth
              helperText={
                passwordCopied
                  ? t("companyProfile.adminPasswordCopied")
                  : t("companyProfile.adminPasswordHelp")
              }
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title={t("companyProfile.adminGeneratePassword")}>
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => {
                          setUserPassword(generateStrongPassword(16));
                          setShowPassword(true);
                          setPasswordCopied(false);
                        }}
                        disabled={busy}
                      >
                        <RefreshIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip
                      title={
                        showPassword
                          ? t("companyProfile.adminHidePassword")
                          : t("companyProfile.adminShowPassword")
                      }
                    >
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => setShowPassword((v) => !v)}
                        disabled={busy || !userPassword}
                      >
                        {showPassword ? (
                          <VisibilityOffIcon fontSize="small" />
                        ) : (
                          <VisibilityIcon fontSize="small" />
                        )}
                      </IconButton>
                    </Tooltip>
                    <Tooltip
                      title={
                        passwordCopied
                          ? t("companyProfile.copied")
                          : t("companyProfile.copyPassword")
                      }
                    >
                      <span>
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={async () => {
                            if (!userPassword) return;
                            try {
                              await navigator.clipboard.writeText(userPassword);
                              setPasswordCopied(true);
                            } catch {
                              setError(t("companyProfile.copyFailed"));
                            }
                          }}
                          disabled={busy || !userPassword}
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddOpen(false)} disabled={busy}>
            {t("basic.cancel")}
          </Button>
          <Button
            variant="contained"
            onClick={createAdmin}
            disabled={
              busy || !userEmail.trim() || userPassword.trim().length < 6
            }
            sx={{ textTransform: "none" }}
          >
            {t("companyProfile.createAdmin")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={editOpen}
        onClose={() => !busy && setEditOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>{t("companyProfile.adminChangeEmail")}</DialogTitle>
        <DialogContent>
          <TextField
            label={t("companyProfile.adminEmail")}
            type="email"
            value={editEmail}
            onChange={(e) => setEditEmail(e.target.value)}
            autoFocus
            fullWidth
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditOpen(false)} disabled={busy}>
            {t("basic.cancel")}
          </Button>
          <Button
            variant="contained"
            onClick={updateAdminEmail}
            disabled={busy || !editEmail.trim()}
            sx={{ textTransform: "none" }}
          >
            {t("basic.save")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
