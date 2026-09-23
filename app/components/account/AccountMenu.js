"use client";

import { useRef, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";
import LockResetIcon from "@mui/icons-material/LockReset";
import LogoutIcon from "@mui/icons-material/Logout";
import { useSession, signOut } from "next-auth/react";
import { useTranslation } from "react-i18next";
import { useSnackbar } from "notistack";

import {
  ACCOUNT_LOGOUT_CALLBACK,
  ACCOUNT_TRIGGER_PX,
  accountMenuClosesOnKey,
  beginPasswordReset,
  buildAccountMenuView,
  maskEmail,
  requestOwnPasswordReset,
} from "./accountMenuModel";

const ROLE_KEY = {
  superadmin: "header.superadmin",
  admin: "header.adminRole",
  staff: "header.staff",
};

const rowSx = { minHeight: 36, px: 1, borderRadius: 1 };

/**
 * Compact account actions for every signed-in user.
 * Password reset always goes to the session user. Logout uses signOut.
 */
export default function AccountMenu({
  placement = "navbar",
  companyName = "",
  onNavigate,
}) {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const { enqueueSnackbar } = useSnackbar();
  const view = buildAccountMenuView(session, companyName);
  const [anchor, setAnchor] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resetState, setResetState] = useState({ pending: false, error: "" });
  const pendingRef = useRef(false);

  if (!view) return null;

  const roleLabel = t(ROLE_KEY[view.role] || "header.staff", {
    defaultValue:
      view.role === "superadmin"
        ? "Superadmin"
        : view.role === "admin"
          ? "Admin"
          : "Staff",
  });
  const masked = maskEmail(view.email);

  function closeMenu() {
    setAnchor(null);
  }

  function onMenuKeyDown(event) {
    if (accountMenuClosesOnKey(event.key)) closeMenu();
  }

  async function logout() {
    closeMenu();
    setConfirmOpen(false);
    onNavigate?.();
    await signOut({ callbackUrl: ACCOUNT_LOGOUT_CALLBACK });
  }

  async function sendReset() {
    const next = beginPasswordReset({ pending: pendingRef.current });
    if (!next.started) return;
    pendingRef.current = true;
    setResetState({ pending: true, error: "" });
    try {
      await requestOwnPasswordReset();
      setResetState({ pending: false, error: "" });
      setConfirmOpen(false);
      closeMenu();
      onNavigate?.();
      enqueueSnackbar(t("header.resetPasswordSentShort"), {
        variant: "success",
      });
    } catch {
      setResetState({
        pending: false,
        error: t("header.resetPasswordError"),
      });
    } finally {
      pendingRef.current = false;
    }
  }

  const identity = (
    <Box sx={{ px: placement === "drawer" ? 0 : 2, py: 1, maxWidth: 280 }}>
      <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
        {view.email}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block">
        {roleLabel}
      </Typography>
      {view.companyName ? (
        <Typography variant="caption" color="text.secondary" display="block" noWrap>
          {view.companyName}
        </Typography>
      ) : null}
    </Box>
  );

  const resetControl =
    placement === "drawer" ? (
      <ListItemButton
        disabled={resetState.pending}
        onClick={() => {
          setResetState((state) => ({ ...state, error: "" }));
          setConfirmOpen(true);
        }}
        sx={rowSx}
      >
        <ListItemIcon sx={{ minWidth: 32 }}>
          <LockResetIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary={t("header.resetPassword")} />
      </ListItemButton>
    ) : (
      <MenuItem
        disabled={resetState.pending}
        onClick={() => {
          setResetState((state) => ({ ...state, error: "" }));
          setConfirmOpen(true);
        }}
      >
        <ListItemIcon>
          <LockResetIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{t("header.resetPassword")}</ListItemText>
      </MenuItem>
    );

  const logoutControl =
    placement === "drawer" ? (
      <ListItemButton onClick={logout} sx={rowSx}>
        <ListItemIcon sx={{ minWidth: 32 }}>
          <LogoutIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary={t("header.logout")} />
      </ListItemButton>
    ) : (
      <MenuItem onClick={logout}>
        <ListItemIcon>
          <LogoutIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{t("header.logout")}</ListItemText>
      </MenuItem>
    );

  const confirm = (
    <Dialog
      open={confirmOpen}
      onClose={() => {
        if (!resetState.pending) setConfirmOpen(false);
      }}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle>{t("header.resetPassword")}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {t("header.resetPasswordConfirm", { email: masked })}
        </DialogContentText>
        {resetState.error ? (
          <Typography color="error" variant="body2" sx={{ mt: 1.5 }}>
            {resetState.error}
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => setConfirmOpen(false)}
          disabled={resetState.pending}
        >
          {t("header.accountCancel")}
        </Button>
        <Button
          variant="contained"
          onClick={sendReset}
          disabled={resetState.pending}
        >
          {resetState.pending
            ? t("header.resetPasswordSending")
            : t("header.resetPassword")}
        </Button>
      </DialogActions>
    </Dialog>
  );

  if (placement === "drawer") {
    return (
      <Box
        component="section"
        aria-label={t("header.account")}
        sx={{ px: 2, py: 1.5, borderTop: "1px solid rgba(0,0,0,0.08)" }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontWeight: 700, letterSpacing: "0.04em" }}
        >
          {t("header.account")}
        </Typography>
        {identity}
        <Divider sx={{ my: 1 }} />
        <List dense disablePadding aria-label={t("header.account")}>
          {resetControl}
          {logoutControl}
        </List>
        {confirm}
      </Box>
    );
  }

  return (
    <>
      <Tooltip title={t("header.account")}>
        <IconButton
          size="small"
          aria-label={t("header.account")}
          aria-haspopup="menu"
          aria-expanded={Boolean(anchor)}
          onClick={(event) => setAnchor(event.currentTarget)}
          sx={{
            width: ACCOUNT_TRIGGER_PX,
            height: ACCOUNT_TRIGGER_PX,
            p: 0,
            color: "inherit",
            "&:focus-visible": {
              outline: "2px solid currentColor",
              outlineOffset: 2,
            },
          }}
        >
          <Box
            aria-hidden
            sx={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.5)",
              display: "grid",
              placeItems: "center",
              fontSize: "0.68rem",
              fontWeight: 800,
              letterSpacing: "0.02em",
            }}
          >
            {view.initials}
          </Box>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={closeMenu}
        onKeyDown={onMenuKeyDown}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        MenuListProps={{ dense: true, "aria-label": t("header.account") }}
      >
        {identity}
        <Divider />
        {resetControl}
        {logoutControl}
      </Menu>
      {confirm}
    </>
  );
}
