"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
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
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import LinkOffIcon from "@mui/icons-material/LinkOff";

export default function AccessTokensSection() {
  const [companies, setCompanies] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [scopes, setScopes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const [ownerId, setOwnerId] = useState("");
  const [scope, setScope] = useState("vouchers.transfer");
  const [label, setLabel] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("90");
  const [lastCreatedLink, setLastCreatedLink] = useState("");
  const [showRevoked, setShowRevoked] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [tokensRes, ownersRes] = await Promise.all([
        fetch("/api/admin/access-tokens"),
        fetch("/api/admin/owners"),
      ]);
      const tokensBody = await tokensRes.json();
      if (!tokensRes.ok || !tokensBody.success) {
        throw new Error(tokensBody.message || "Failed to load tokens");
      }
      setTokens(tokensBody.tokens || []);
      setScopes(tokensBody.scopes || []);

      const ownersBody = await ownersRes.json();
      if (ownersRes.ok && ownersBody.success) {
        const list = ownersBody.companies || [];
        setCompanies(list);
        setOwnerId((prev) => {
          if (prev) return prev;
          const natali =
            list.find((c) =>
              String(c.name || "")
                .toLowerCase()
                .includes("natali")
            ) || list[0];
          return natali ? String(natali._id) : "";
        });
      }
    } catch (err) {
      setError(err.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async () => {
    setBusy(true);
    setError("");
    setOk("");
    setLastCreatedLink("");
    try {
      const res = await fetch("/api/admin/access-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId,
          scopes: [scope],
          label,
          expiresInDays: expiresInDays === "" ? null : Number(expiresInDays),
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.message || "Create failed");
      }
      setLastCreatedLink(body.link || "");
      setOk(body.warning || "Link created — copy it now.");
      await load();
    } catch (err) {
      setError(err.message || "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (id) => {
    if (!window.confirm("Revoke this link? It will stop working immediately.")) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/access-tokens/${id}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.message || "Revoke failed");
      }
      setOk(
        "Link revoked — old URL no longer works. Click Generate below to create a new link you can copy."
      );
      await load();
    } catch (err) {
      setError(err.message || "Revoke failed");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setOk("Copied to clipboard");
    } catch {
      setError("Could not copy");
    }
  };

  const visibleTokens = tokens.filter((t) => showRevoked || t.active);
  const revokedCount = tokens.filter((t) => !t.active).length;

  if (loading) {
    return (
      <Box sx={{ p: 3, display: "flex", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 1100, mx: "auto" }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Access links
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Generate passwordless links for a company page only (e.g. Natali Cars
        vouchers). After Generate, copy the full URL immediately — it is shown
        only once and cannot be recovered later (only revoke / create a new
        one).
      </Typography>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      ) : null}
      {ok && !lastCreatedLink ? (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setOk("")}>
          {ok}
        </Alert>
      ) : null}

      {lastCreatedLink ? (
        <Alert
          severity="success"
          sx={{
            mb: 3,
            border: "2px solid",
            borderColor: "success.main",
            "& .MuiAlert-message": { width: "100%" },
          }}
          onClose={() => {
            setLastCreatedLink("");
            setOk("");
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.75 }}>
            Copy this link now — it will not be shown again
          </Typography>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            alignItems={{ sm: "center" }}
          >
            <Box
              sx={{
                flex: 1,
                p: 1.25,
                borderRadius: 1,
                bgcolor: "background.paper",
                border: "1px solid",
                borderColor: "divider",
                fontFamily: "monospace",
                fontSize: 13,
                wordBreak: "break-all",
              }}
            >
              {lastCreatedLink}
            </Box>
            <Button
              variant="contained"
              color="success"
              startIcon={<ContentCopyIcon />}
              onClick={() => copy(lastCreatedLink)}
              sx={{ flexShrink: 0, textTransform: "none", whiteSpace: "nowrap" }}
            >
              Copy link
            </Button>
          </Stack>
        </Alert>
      ) : null}

      <Box
        sx={{
          p: 2,
          mb: 3,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          bgcolor: "background.paper",
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
          Create link
        </Typography>
        <Stack spacing={1.5} direction={{ xs: "column", md: "row" }}>
          <TextField
            select
            size="small"
            label="Company"
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            sx={{ minWidth: 220, flex: 1 }}
          >
            {companies.map((c) => (
              <MenuItem key={String(c._id)} value={String(c._id)}>
                {c.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Scope (page)"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            sx={{ minWidth: 220 }}
          >
            {(scopes.length
              ? scopes
              : [{ id: "vouchers.transfer", label: "Transfer vouchers only" }]
            ).map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="Label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Natali summer staff"
            sx={{ minWidth: 180, flex: 1 }}
          />
          <TextField
            size="small"
            label="Expires (days)"
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(e.target.value)}
            placeholder="empty = never"
            sx={{ width: 140 }}
          />
          <Button
            variant="contained"
            disabled={busy || !ownerId}
            onClick={handleCreate}
          >
            Generate
          </Button>
        </Stack>
      </Box>

      <Divider sx={{ mb: 2 }} />
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ sm: "center" }}
        gap={1}
        mb={1}
      >
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Existing links
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Full URLs are not stored. Need a link again? Generate a new one and
            copy it from the green box.
          </Typography>
        </Box>
        {revokedCount > 0 ? (
          <Button
            size="small"
            onClick={() => setShowRevoked((v) => !v)}
            sx={{ textTransform: "none", flexShrink: 0 }}
          >
            {showRevoked
              ? "Hide revoked"
              : `Show revoked (${revokedCount})`}
          </Button>
        ) : null}
      </Stack>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Company</TableCell>
            <TableCell>Label</TableCell>
            <TableCell>Scope</TableCell>
            <TableCell>Prefix</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Expires</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {visibleTokens.map((t) => (
            <TableRow key={String(t._id)}>
              <TableCell>{t.companyName}</TableCell>
              <TableCell>{t.label || "—"}</TableCell>
              <TableCell>
                {(t.scopes || []).map((s) => (
                  <Chip key={s} size="small" label={s} sx={{ mr: 0.5 }} />
                ))}
              </TableCell>
              <TableCell>
                <code>{t.tokenPrefix}…</code>
              </TableCell>
              <TableCell>
                {t.active ? (
                  <Chip size="small" color="success" label="active" />
                ) : (
                  <Chip size="small" color="default" label="revoked" />
                )}
              </TableCell>
              <TableCell>
                {t.expiresAt
                  ? new Date(t.expiresAt).toLocaleDateString()
                  : "never"}
              </TableCell>
              <TableCell align="right">
                {t.active ? (
                  <Button
                    size="small"
                    color="warning"
                    startIcon={<LinkOffIcon />}
                    disabled={busy}
                    onClick={() => handleRevoke(t._id)}
                  >
                    Revoke
                  </Button>
                ) : (
                  "—"
                )}
              </TableCell>
            </TableRow>
          ))}
          {visibleTokens.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7}>
                <Typography color="text.secondary">
                  {tokens.length === 0
                    ? "No links yet — click Generate above."
                    : "No active links. Click Generate to create one you can copy."}
                </Typography>
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </Box>
  );
}
