"use client";

import { useMemo, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  TextField,
  MenuItem,
  Stack,
  Button,
} from "@mui/material";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "next/navigation";
import { MAIL_TYPE, MAIL_STATUS } from "@/domain/mail/mailTypes";
import MailThreadPanel from "./MailThreadPanel";

function typeLabelKey(type) {
  return `admin.emails.types.${String(type || "generic").replace(/\./g, "_")}`;
}

export default function EmailsSection() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const initialOrderId = searchParams?.get("orderId") || "";
  const initialCompanyId = searchParams?.get("companyId") || "";

  const [orderId, setOrderId] = useState(initialOrderId);
  const [companyId, setCompanyId] = useState(initialCompanyId);
  const [recipientDraft, setRecipientDraft] = useState("");
  const [recipient, setRecipient] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  const typeOptions = useMemo(
    () => ["all", ...Object.values(MAIL_TYPE)],
    []
  );
  const statusOptions = useMemo(
    () => ["all", ...Object.values(MAIL_STATUS)],
    []
  );

  const applyRecipient = () => {
    setPage(1);
    setRecipient(recipientDraft.trim());
  };

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
          <MailOutlineIcon color="primary" />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {t("header.emails")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("admin.emails.subtitle")}
            </Typography>
          </Box>
        </Stack>
        <Button
          startIcon={<RefreshIcon />}
          variant="outlined"
          onClick={() => {
            setRefreshKey((n) => n + 1);
          }}
        >
          {t("admin.emails.refresh")}
        </Button>
      </Stack>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          alignItems={{ md: "center" }}
        >
          <TextField
            size="small"
            label={t("admin.emails.orderId")}
            value={orderId}
            onChange={(e) => {
              setPage(1);
              setOrderId(e.target.value.trim());
            }}
            sx={{ minWidth: 180 }}
          />
          <TextField
            size="small"
            label={t("admin.emails.companyId")}
            value={companyId}
            onChange={(e) => {
              setPage(1);
              setCompanyId(e.target.value.trim());
            }}
            sx={{ minWidth: 180 }}
          />
          <TextField
            size="small"
            label={t("admin.emails.recipient")}
            value={recipientDraft}
            onChange={(e) => setRecipientDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyRecipient();
            }}
            sx={{ flex: 1, minWidth: 180 }}
          />
          <TextField
            select
            size="small"
            label={t("admin.emails.type")}
            value={type}
            onChange={(e) => {
              setPage(1);
              setType(e.target.value);
            }}
            sx={{ minWidth: 180 }}
          >
            {typeOptions.map((value) => (
              <MenuItem key={value} value={value}>
                {value === "all"
                  ? t("admin.emails.allTypes")
                  : t(typeLabelKey(value), { defaultValue: value })}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label={t("admin.emails.status")}
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
            sx={{ minWidth: 140 }}
          >
            {statusOptions.map((value) => (
              <MenuItem key={value} value={value}>
                {value === "all"
                  ? t("admin.emails.allStatuses")
                  : t(`admin.emails.statusValue.${value}`, {
                      defaultValue: value,
                    })}
              </MenuItem>
            ))}
          </TextField>
          <Button variant="contained" onClick={applyRecipient}>
            {t("admin.emails.apply")}
          </Button>
        </Stack>
      </Paper>

      <MailThreadPanel
        key={refreshKey}
        orderId={orderId}
        companyId={companyId}
        recipient={recipient}
        type={type}
        status={status}
        page={page}
        onPageChange={setPage}
      />
    </Box>
  );
}
