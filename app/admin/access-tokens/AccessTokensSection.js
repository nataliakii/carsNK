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
      setOk("Link revoked");
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
        vouchers). Token does not unlock the full admin panel.
      </Typography>

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

        {lastCreatedLink ? (
          <Alert
            severity="info"
            sx={{ mt: 2 }}
            action={
              <Button
                color="inherit"
                size="small"
                startIcon={<ContentCopyIcon />}
                onClick={() => copy(lastCreatedLink)}
              >
                Copy
              </Button>
            }
          >
            <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
              {lastCreatedLink}
            </Typography>
          </Alert>
        ) : null}
      </Box>

      <Divider sx={{ mb: 2 }} />
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
        Existing links
      </Typography>
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
          {tokens.map((t) => (
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
                  <Chip size="small" color="default" label="revoked/expired" />
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
          {tokens.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7}>
                <Typography color="text.secondary">No links yet</Typography>
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </Box>
  );
}
