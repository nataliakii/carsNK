"use client";

import {
  Box,
  Button,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EditIcon from "@mui/icons-material/Edit";
import { useTranslation } from "react-i18next";

export function shortCompanyId(id) {
  const s = String(id || "");
  if (s.length <= 10) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
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

  return (
    <Box
      sx={{
        p: 2,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: "background.paper",
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        gap={1.5}
        alignItems={{ sm: "center" }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" alignItems="center" gap={0.5}>
            <Typography variant="h6" fontWeight={700}>
              {company.name}
            </Typography>
            {canEdit && onEdit ? (
              <Tooltip title={t("companyProfile.editContacts")}>
                <IconButton size="small" onClick={onEdit} aria-label={t("companyProfile.editContacts")}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : null}
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {company.email || t("companyProfile.noEmail")}
            {company.tel ? ` · ${company.tel}` : ""}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
            {t("companyProfile.baseCoordsLabel", {
              lat: company?.coords?.lat || "—",
              lon: company?.coords?.lon || "—",
            })}
          </Typography>
          <Stack direction="row" alignItems="center" gap={0.5} mt={0.5}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontFamily: "monospace" }}
            >
              ID {shortCompanyId(company._id)}
            </Typography>
            <Tooltip title={t("companyProfile.copyId")}>
              <IconButton size="small" onClick={() => copyText(company._id)}>
                <ContentCopyIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
        <Stack direction="row" gap={1} flexWrap="wrap">
          {canEdit && onEdit ? (
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={onEdit}
              sx={{ textTransform: "none" }}
            >
              {t("companyProfile.editContacts")}
            </Button>
          ) : null}
          {actions}
        </Stack>
      </Stack>
    </Box>
  );
}
