"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
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
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import SendIcon from "@mui/icons-material/Send";
import { useSession } from "next-auth/react";
import { useTranslation } from "react-i18next";

import { ROLE } from "@models/user";
import { getAvailableUiLocales } from "@/domain/platform/uiLocales";
import { getSiteCountryCode } from "@config/siteCountry";
import {
  ADMIN_STATUS,
  PARTNER_ADMIN_ROLE_OPTIONS,
  adminRowActions,
  canManageCompanyAdmins,
  optimisticInvitedAdmin,
  removeAdminRow,
  upsertAdminRow,
  validateAddAdminInput,
  validateEmailChangeInput,
  wouldLeaveZeroActiveAdmins,
} from "@/domain/admin/companyAdmins";
import { adminReadableTextSx } from "@/app/admin/shared/components/AdminSettingsSection";

const STATUS_CHIP = {
  [ADMIN_STATUS.ACTIVE]: { color: "success", key: "statusActive" },
  [ADMIN_STATUS.PENDING]: { color: "warning", key: "statusPending" },
  [ADMIN_STATUS.DISABLED]: { color: "default", key: "statusDisabled" },
};

const EMPTY_ADD_FORM = {
  name: "",
  email: "",
  role: ROLE.ADMIN,
  notificationLanguage: "en",
};

/** Keep a click on a button, menu or dialog from also opening the row. */
function stopRowClick(event) {
  event.stopPropagation();
}

function useDateFormatter() {
  const { i18n } = useTranslation();
  return useCallback(
    (value) => {
      if (!value) return null;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return null;
      // Compact one-line form — medium+short wraps in narrow columns.
      return new Intl.DateTimeFormat(i18n.language || "en", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    },
    [i18n.language]
  );
}

function DetailRow({ label, children }) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      justifyContent="space-between"
      gap={0.5}
      sx={{ py: 0.75, borderBottom: "1px solid", borderColor: "divider" }}
    >
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Box sx={{ textAlign: { sm: "right" }, fontSize: "0.88rem", fontWeight: 600 }}>
        {children}
      </Box>
    </Stack>
  );
}

/**
 * Company admins for one partner: list, invite, and per-row account actions.
 *
 * Only superadmins get the controls, and every endpoint repeats that check
 * server-side. `superAdminOnly` additionally hides the list itself — the
 * partner Admins tab uses it; the company profile card keeps its read-only
 * roster for company admins.
 */
export default function CompanyAdminsPanel({
  companyId,
  companyName = "",
  superAdminOnly = true,
}) {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const formatDate = useDateFormatter();

  const canManage = canManageCompanyAdmins(session?.user);
  const currentUserId = session?.user?.id || null;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(Boolean(companyId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_ADD_FORM);
  const [addErrors, setAddErrors] = useState({});

  const [emailTarget, setEmailTarget] = useState(null);
  const [emailForm, setEmailForm] = useState({ email: "", confirmEmail: "" });
  const [emailErrors, setEmailErrors] = useState({});

  const [detailRow, setDetailRow] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [disableTarget, setDisableTarget] = useState(null);
  const [menu, setMenu] = useState({ anchor: null, row: null });

  const load = useCallback(async () => {
    if (!companyId) {
      setRows([]);
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
        throw new Error(body.message || t("admin.partnerAdmins.loadFailed"));
      }
      setRows(Array.isArray(body.users) ? body.users : []);
    } catch (err) {
      setError(err.message || t("admin.partnerAdmins.loadFailed"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const localeOptions = useMemo(
    () => getAvailableUiLocales(getSiteCountryCode()),
    []
  );

  const closeMenu = () => setMenu({ anchor: null, row: null });

  /** Shared fetch wrapper: one busy flag, one error banner, one success note. */
  const run = async (request, onSuccess) => {
    setBusy(true);
    setError("");
    setOk("");
    try {
      const res = await request();
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        const key =
          body?.errors?.email ||
          body?.errors?.access ||
          body?.errors?.reset;
        throw new Error(
          (key && t(key)) ||
            body?.message ||
            t("admin.partnerAdmins.errors.generic")
        );
      }
      await onSuccess(body);
      return true;
    } catch (err) {
      setError(err.message || t("admin.partnerAdmins.errors.generic"));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const inviteAdmin = async () => {
    const { valid, errors, value } = validateAddAdminInput(addForm);
    setAddErrors(errors);
    if (!valid) return;

    // Show the pending row straight away; swap it for the server row on 201.
    const pending = optimisticInvitedAdmin({ ...value, ownerId: companyId });
    setRows((prev) => upsertAdminRow(prev, pending));
    setAddOpen(false);

    const done = await run(
      () =>
        fetch("/api/admin/owners/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...value, ownerId: companyId }),
        }),
      (body) => {
        setRows((prev) =>
          upsertAdminRow(removeAdminRow(prev, pending._id), body.user)
        );
        setOk(
          body.inviteSent === false
            ? body.message
            : t("admin.partnerAdmins.inviteSent", { email: body.user.email })
        );
        setAddForm(EMPTY_ADD_FORM);
        setAddErrors({});
      }
    );

    if (!done) {
      setRows((prev) => removeAdminRow(prev, pending._id));
      setAddOpen(true);
    }
  };

  const changeEmail = async () => {
    if (!emailTarget) return;
    const { valid, errors, value } = validateEmailChangeInput({
      ...emailForm,
      currentEmail: emailTarget.email,
    });
    setEmailErrors(errors);
    if (!valid) return;

    await run(
      () =>
        fetch(`/api/admin/owners/users/${emailTarget._id}/email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: value.email,
            confirmEmail: value.email,
          }),
        }),
      (body) => {
        setRows((prev) => upsertAdminRow(prev, body.user));
        setDetailRow((prev) =>
          prev && prev._id === body.user._id ? body.user : prev
        );
        setEmailTarget(null);
        setEmailErrors({});
        setOk(
          t("admin.partnerAdmins.emailChanged", { email: body.user.email })
        );
      }
    );
  };

  const sendPasswordReset = (row) =>
    run(
      () =>
        fetch(`/api/admin/owners/users/${row._id}/reset-password`, {
          method: "POST",
        }),
      (body) => {
        setOk(
          t("admin.partnerAdmins.resetSent", { email: body.email || row.email })
        );
      }
    );

  const resendInvite = (row) =>
    run(
      () =>
        fetch(`/api/admin/owners/users/${row._id}/invite`, { method: "POST" }),
      (body) => {
        if (body.user) setRows((prev) => upsertAdminRow(prev, body.user));
        setOk(
          t("admin.partnerAdmins.inviteSent", { email: body.email || row.email })
        );
      }
    );

  const setAccess = (row, disabled) =>
    run(
      () =>
        fetch(`/api/admin/owners/users/${row._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ disabled }),
        }),
      (body) => {
        setRows((prev) => upsertAdminRow(prev, body.user));
        setDetailRow((prev) =>
          prev && prev._id === body.user._id ? body.user : prev
        );
        setDisableTarget(null);
        setOk(
          t(
            disabled
              ? "admin.partnerAdmins.accessDisabled"
              : "admin.partnerAdmins.accessEnabled",
            { email: row.email }
          )
        );
      }
    );

  const removeAdmin = (row) =>
    run(
      () =>
        fetch(`/api/admin/owners/users/${row._id}`, { method: "DELETE" }),
      () => {
        setRows((prev) => removeAdminRow(prev, row._id));
        setRemoveTarget(null);
        setDetailRow(null);
        setOk(t("admin.partnerAdmins.adminRemoved", { email: row.email }));
      }
    );

  if (!companyId) return null;

  if (!canManage && superAdminOnly) {
    return (
      <Alert severity="info" sx={adminReadableTextSx}>
        {t("admin.partnerAdmins.superadminOnly")}
      </Alert>
    );
  }

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="flex-start"
        justifyContent="space-between"
        gap={1}
        flexWrap="wrap"
        sx={{ mb: 1.5 }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="h6" fontWeight={700} sx={adminReadableTextSx}>
            {t("admin.partnerAdmins.title")}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.5, ...adminReadableTextSx }}
          >
            {t("admin.partnerAdmins.subtitle")}
          </Typography>
        </Box>
        {canManage ? (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setAddForm(EMPTY_ADD_FORM);
              setAddErrors({});
              setAddOpen(true);
            }}
            disabled={busy}
            sx={{ textTransform: "none", flexShrink: 0 }}
          >
            {t("admin.partnerAdmins.addAdmin")}
          </Button>
        ) : null}
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
      ) : rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={adminReadableTextSx}>
          {t("admin.partnerAdmins.empty")}
        </Typography>
      ) : (
        <Box sx={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <Table
            size="small"
            sx={{
              "& .MuiTableCell-root": {
                py: 0.75,
                px: 1,
                verticalAlign: "middle",
                ...adminReadableTextSx,
              },
            }}
          >
            <TableHead>
              <TableRow>
                {canManage ? (
                  <TableCell sx={{ width: 108, whiteSpace: "nowrap" }}>
                    {t("admin.partnerAdmins.colActions")}
                  </TableCell>
                ) : null}
                <TableCell>{t("admin.partnerAdmins.colName")}</TableCell>
                <TableCell>{t("admin.partnerAdmins.colRole")}</TableCell>
                <TableCell>{t("admin.partnerAdmins.colStatus")}</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  {t("admin.partnerAdmins.colLastLogin")}
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  {t("admin.partnerAdmins.colInviteReset")}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => {
                const actions = adminRowActions(row, {
                  currentUserId,
                  lastUsableAdmin: wouldLeaveZeroActiveAdmins(rows, row._id),
                });
                const chip = STATUS_CHIP[row.status] || STATUS_CHIP.active;
                const inviteLabel = row.invitePending
                  ? t("admin.partnerAdmins.inviteOutstanding")
                  : row.resetPending
                    ? t("admin.partnerAdmins.resetOutstanding")
                    : t("admin.partnerAdmins.resetNone");
                return (
                  <TableRow
                    key={row._id}
                    hover
                    onClick={() => setDetailRow(row)}
                    sx={{ cursor: "pointer" }}
                  >
                    {canManage ? (
                      <TableCell onClick={stopRowClick} sx={{ whiteSpace: "nowrap" }}>
                        <Stack direction="row" gap={0.25} alignItems="center">
                          <Tooltip title={t("admin.partnerAdmins.changeEmail")}>
                            <IconButton
                              size="small"
                              disabled={busy}
                              onClick={() => {
                                setEmailTarget(row);
                                setEmailForm({ email: "", confirmEmail: "" });
                                setEmailErrors({});
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {actions.sendPasswordReset ? (
                            <Tooltip
                              title={t("admin.partnerAdmins.sendPasswordReset")}
                            >
                              <IconButton
                                size="small"
                                disabled={busy}
                                onClick={() => sendPasswordReset(row)}
                              >
                                <MailOutlineIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          ) : null}
                          <Tooltip title={t("admin.partnerAdmins.moreActions")}>
                            <IconButton
                              size="small"
                              aria-label={t("admin.partnerAdmins.moreActions")}
                              disabled={busy}
                              onClick={(event) =>
                                setMenu({ anchor: event.currentTarget, row })
                              }
                            >
                              <MoreVertIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    ) : null}
                    <TableCell>
                      <Typography variant="body2" fontWeight={600} noWrap>
                        {row.name || "—"}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        noWrap
                        display="block"
                      >
                        {row.email}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      <Chip
                        size="small"
                        variant="outlined"
                        color="primary"
                        label={t(
                          row.role === ROLE.SUPERADMIN
                            ? "admin.partnerAdmins.roleSuperadmin"
                            : "admin.partnerAdmins.roleAdmin"
                        )}
                      />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      <Chip
                        size="small"
                        color={chip.color}
                        label={t(`admin.partnerAdmins.${chip.key}`)}
                      />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      {formatDate(row.lastLoginAt) ||
                        t("admin.partnerAdmins.never")}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      <Chip
                        size="small"
                        variant="outlined"
                        color={
                          row.invitePending || row.resetPending
                            ? "warning"
                            : "default"
                        }
                        label={inviteLabel}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}

      <Menu
        anchorEl={menu.anchor}
        open={Boolean(menu.anchor)}
        onClose={closeMenu}
        onClick={stopRowClick}
      >
        {(() => {
          const actions = menu.row
            ? adminRowActions(menu.row, {
                currentUserId,
                lastUsableAdmin: wouldLeaveZeroActiveAdmins(rows, menu.row._id),
              })
            : null;
          if (!actions) return null;
          return [
            actions.resendInvite ? (
              <MenuItem
                key="resend"
                onClick={() => {
                  resendInvite(menu.row);
                  closeMenu();
                }}
              >
                <ListItemIcon>
                  <SendIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>
                  {t("admin.partnerAdmins.resendInvite")}
                </ListItemText>
              </MenuItem>
            ) : null,
            actions.disableAccess ? (
              <MenuItem
                key="disable"
                onClick={() => {
                  setDisableTarget(menu.row);
                  closeMenu();
                }}
              >
                <ListItemIcon>
                  <BlockIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>
                  {t("admin.partnerAdmins.disableAccess")}
                </ListItemText>
              </MenuItem>
            ) : null,
            actions.enableAccess ? (
              <MenuItem
                key="restore"
                onClick={() => {
                  setAccess(menu.row, false);
                  closeMenu();
                }}
              >
                <ListItemIcon>
                  <CheckCircleOutlineIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>
                  {t("admin.partnerAdmins.enableAccess")}
                </ListItemText>
              </MenuItem>
            ) : null,
            actions.removeAccess ? (
              <MenuItem
                key="remove"
                onClick={() => {
                  setRemoveTarget(menu.row);
                  closeMenu();
                }}
              >
                <ListItemIcon>
                  <DeleteIcon fontSize="small" color="error" />
                </ListItemIcon>
                <ListItemText primaryTypographyProps={{ color: "error" }}>
                  {t("admin.partnerAdmins.removeAccess")}
                </ListItemText>
              </MenuItem>
            ) : null,
          ];
        })()}
      </Menu>

      {/* Add admin — invitation only, no password field anywhere. */}
      <Dialog
        open={addOpen}
        onClose={() => !busy && setAddOpen(false)}
        onClick={stopRowClick}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          {t("admin.partnerAdmins.addTitle")}
          {companyName ? ` — ${companyName}` : ""}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {t("admin.partnerAdmins.addHelp")}
          </Typography>
          <Stack gap={1.5} sx={{ pt: 0.5 }}>
            <TextField
              label={t("admin.partnerAdmins.nameLabel")}
              value={addForm.name}
              onChange={(e) =>
                setAddForm((prev) => ({ ...prev, name: e.target.value }))
              }
              error={Boolean(addErrors.name)}
              helperText={addErrors.name ? t(addErrors.name) : ""}
              autoFocus
              fullWidth
            />
            <TextField
              label={t("admin.partnerAdmins.emailLabel")}
              type="email"
              value={addForm.email}
              onChange={(e) =>
                setAddForm((prev) => ({ ...prev, email: e.target.value }))
              }
              error={Boolean(addErrors.email)}
              helperText={addErrors.email ? t(addErrors.email) : ""}
              fullWidth
            />
            <TextField
              select
              label={t("admin.partnerAdmins.roleLabel")}
              value={addForm.role}
              onChange={(e) =>
                setAddForm((prev) => ({ ...prev, role: Number(e.target.value) }))
              }
              helperText={t("admin.partnerAdmins.roleHelp")}
              fullWidth
            >
              {PARTNER_ADMIN_ROLE_OPTIONS.map((role) => (
                <MenuItem key={role} value={role}>
                  {t(
                    role === ROLE.SUPERADMIN
                      ? "admin.partnerAdmins.roleSuperadmin"
                      : "admin.partnerAdmins.roleAdmin"
                  )}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={t("admin.partnerAdmins.languageLabel")}
              value={addForm.notificationLanguage}
              onChange={(e) =>
                setAddForm((prev) => ({
                  ...prev,
                  notificationLanguage: e.target.value,
                }))
              }
              fullWidth
            >
              {localeOptions.map((locale) => (
                <MenuItem key={locale.code} value={locale.code}>
                  {locale.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddOpen(false)} disabled={busy}>
            {t("basic.cancel")}
          </Button>
          <Button
            variant="contained"
            onClick={inviteAdmin}
            disabled={busy}
            sx={{ textTransform: "none" }}
          >
            {t("admin.partnerAdmins.sendInvitation")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Change login email — typed twice, checked for uniqueness server-side. */}
      <Dialog
        open={Boolean(emailTarget)}
        onClose={() => !busy && setEmailTarget(null)}
        onClick={stopRowClick}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>{t("admin.partnerAdmins.changeEmailTitle")}</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 1.5 }}>
            {t("admin.partnerAdmins.changeEmailWarning", {
              name: emailTarget?.name || emailTarget?.email || "",
            })}
          </Alert>
          <Stack gap={1.5} sx={{ pt: 0.5 }}>
            <TextField
              label={t("admin.partnerAdmins.currentEmailLabel")}
              value={emailTarget?.email || ""}
              InputProps={{ readOnly: true }}
              fullWidth
            />
            <TextField
              label={t("admin.partnerAdmins.newEmailLabel")}
              type="email"
              value={emailForm.email}
              onChange={(e) =>
                setEmailForm((prev) => ({ ...prev, email: e.target.value }))
              }
              error={Boolean(emailErrors.email)}
              helperText={emailErrors.email ? t(emailErrors.email) : ""}
              autoFocus
              fullWidth
            />
            <TextField
              label={t("admin.partnerAdmins.confirmEmailLabel")}
              type="email"
              value={emailForm.confirmEmail}
              onChange={(e) =>
                setEmailForm((prev) => ({
                  ...prev,
                  confirmEmail: e.target.value,
                }))
              }
              error={Boolean(emailErrors.confirmEmail)}
              helperText={
                emailErrors.confirmEmail ? t(emailErrors.confirmEmail) : ""
              }
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEmailTarget(null)} disabled={busy}>
            {t("basic.cancel")}
          </Button>
          <Button
            variant="contained"
            onClick={changeEmail}
            disabled={busy}
            sx={{ textTransform: "none" }}
          >
            {t("basic.save")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Row detail */}
      <Dialog
        open={Boolean(detailRow)}
        onClose={() => setDetailRow(null)}
        onClick={stopRowClick}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>{t("admin.partnerAdmins.detailTitle")}</DialogTitle>
        <DialogContent>
          {detailRow ? (
            <Box sx={{ pt: 0.5 }}>
              <DetailRow label={t("admin.partnerAdmins.colName")}>
                {detailRow.name || "—"}
              </DetailRow>
              <DetailRow label={t("admin.partnerAdmins.colEmail")}>
                {detailRow.email}
              </DetailRow>
              <DetailRow label={t("admin.partnerAdmins.colUsername")}>
                {detailRow.username || "—"}
              </DetailRow>
              <DetailRow label={t("admin.partnerAdmins.colStatus")}>
                <Chip
                  size="small"
                  color={(STATUS_CHIP[detailRow.status] || STATUS_CHIP.active).color}
                  label={t(
                    `admin.partnerAdmins.${
                      (STATUS_CHIP[detailRow.status] || STATUS_CHIP.active).key
                    }`
                  )}
                />
              </DetailRow>
              <DetailRow label={t("admin.partnerAdmins.colLastLogin")}>
                {formatDate(detailRow.lastLoginAt) ||
                  t("admin.partnerAdmins.never")}
              </DetailRow>
              <DetailRow label={t("admin.partnerAdmins.detailInviteStatus")}>
                {detailRow.invitePending
                  ? t("admin.partnerAdmins.inviteOutstanding")
                  : t("admin.partnerAdmins.inviteAccepted")}
              </DetailRow>
              <DetailRow label={t("admin.partnerAdmins.detailResetStatus")}>
                {detailRow.resetPending
                  ? t("admin.partnerAdmins.resetOutstanding")
                  : t("admin.partnerAdmins.resetNone")}
              </DetailRow>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDetailRow(null)}>{t("basic.close")}</Button>
        </DialogActions>
      </Dialog>

      {/* Disable access — confirmed */}
      <Dialog
        open={Boolean(disableTarget)}
        onClose={() => !busy && setDisableTarget(null)}
        onClick={stopRowClick}
        maxWidth="xs"
      >
        <DialogTitle>{t("admin.partnerAdmins.disableAccess")}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("admin.partnerAdmins.disableConfirm", {
              email: disableTarget?.email || "",
            })}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDisableTarget(null)} disabled={busy}>
            {t("basic.cancel")}
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => setAccess(disableTarget, true)}
            disabled={busy}
            sx={{ textTransform: "none" }}
          >
            {t("admin.partnerAdmins.disableAccess")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Remove access — secondary and confirmed */}
      <Dialog
        open={Boolean(removeTarget)}
        onClose={() => !busy && setRemoveTarget(null)}
        onClick={stopRowClick}
        maxWidth="xs"
      >
        <DialogTitle>{t("admin.partnerAdmins.removeAccess")}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("admin.partnerAdmins.removeConfirm", {
              email: removeTarget?.email || "",
            })}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRemoveTarget(null)} disabled={busy}>
            {t("basic.cancel")}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => removeAdmin(removeTarget)}
            disabled={busy}
            sx={{ textTransform: "none" }}
          >
            {t("admin.partnerAdmins.removeAccess")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
