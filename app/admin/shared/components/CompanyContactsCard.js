"use client";

import {
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EditIcon from "@mui/icons-material/Edit";
import { useTranslation } from "react-i18next";
import {
  formatMeetingContactsDisplay,
  meetingContactsFromCompany,
} from "@/domain/company/meetingContacts";

export function shortCompanyId(id) {
  const s = String(id || "");
  if (s.length <= 10) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function MetaRow({ label, children }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", lineHeight: 1.2, mb: 0.15 }}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{ wordBreak: "break-word", lineHeight: 1.35 }}
      >
        {children}
      </Typography>
    </Box>
  );
}

export default function CompanyContactsCard({
  company,
  onEdit,
  canEdit = true,
  actions = null,
}) {
  const { t } = useTranslation();

  if (!company) return null;

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(String(text));
    } catch {
      /* ignore */
    }
  };

  const meetingContacts = meetingContactsFromCompany(company).filter(
    (c) => c.name || c.phone
  );
  const meetingDisplay = meetingContacts.length
    ? formatMeetingContactsDisplay(meetingContacts)
    : null;

  return (
    <Box
      sx={{
        p: { xs: 1.5, sm: 2 },
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: "background.paper",
        maxWidth: "100%",
        overflow: "hidden",
      }}
    >
      <Stack gap={1.5}>
        {/* Title + country chip */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={1}
          flexWrap="wrap"
        >
          <Stack direction="row" alignItems="center" gap={1} minWidth={0}>
            <Typography
              variant="h6"
              fontWeight={700}
              sx={{ fontSize: { xs: "1.05rem", sm: "1.25rem" } }}
              noWrap
            >
              {company.name}
            </Typography>
            {company.country ? (
              <Chip
                size="small"
                label={company.country}
                sx={{ height: 22, fontWeight: 600 }}
              />
            ) : null}
          </Stack>
        </Stack>

        {/* Actions — one compact toolbar */}
        {(canEdit && onEdit) || actions ? (
          <Stack
            direction="row"
            gap={1}
            flexWrap="wrap"
            useFlexGap
            sx={{
              "& .MuiButton-root": {
                textTransform: "none",
                flex: { xs: "1 1 calc(50% - 8px)", sm: "0 1 auto" },
                minWidth: { xs: 0, sm: "auto" },
              },
            }}
          >
            {canEdit && onEdit ? (
              <Button
                size="small"
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={onEdit}
              >
                {t("companyProfile.editContacts")}
              </Button>
            ) : null}
            {actions}
          </Stack>
        ) : null}

        {/* Details grid */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: { xs: 1, sm: 1.25 },
            p: 1.25,
            borderRadius: 1.5,
            bgcolor: "action.hover",
          }}
        >
          <MetaRow label={t("companyProfile.email")}>
            {company.email || t("companyProfile.noEmail")}
          </MetaRow>
          <MetaRow label={t("companyProfile.phone")}>
            {company.tel || "—"}
          </MetaRow>
          <MetaRow label={t("companyProfile.emailLang")}>
            {company.langAdmin
              ? String(company.langAdmin).toUpperCase()
              : "—"}
          </MetaRow>
          <MetaRow label={t("companyProfile.baseLocationTitle")}>
            {company?.coords?.lat || company?.coords?.lon
              ? `${company?.coords?.lat || "—"}, ${company?.coords?.lon || "—"}`
              : "—"}
          </MetaRow>
          {meetingDisplay ? (
            <Box sx={{ gridColumn: { xs: "1", sm: "1 / -1" } }}>
              <MetaRow label={t("companyProfile.meetingContactTitle")}>
                {meetingDisplay}
              </MetaRow>
            </Box>
          ) : null}
          <Box sx={{ gridColumn: { xs: "1", sm: "1 / -1" } }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", lineHeight: 1.2, mb: 0.15 }}
            >
              {t("companyProfile.copyId")}
            </Typography>
            <Stack direction="row" alignItems="center" gap={0.5}>
              <Typography
                variant="body2"
                sx={{ fontFamily: "monospace", wordBreak: "break-all" }}
              >
                {shortCompanyId(company._id)}
              </Typography>
              <Tooltip title={t("companyProfile.copyId")}>
                <IconButton
                  size="small"
                  onClick={() => copyText(company._id)}
                  aria-label={t("companyProfile.copyId")}
                >
                  <ContentCopyIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>
        </Box>
      </Stack>
    </Box>
  );
}
