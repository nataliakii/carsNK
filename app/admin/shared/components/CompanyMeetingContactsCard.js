"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Button,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useTranslation } from "react-i18next";
import {
  emptyMeetingContact,
  meetingContactsFromCompany,
  meetingContactsUpdatePayload,
} from "@/domain/company/meetingContacts";
import {
  adminReadableTextSx,
  adminSurfaceSx,
} from "@/app/admin/shared/components/AdminSettingsSection";

export default function CompanyMeetingContactsCard({
  company,
  onSaved,
  disabled = false,
  embedded = false,
}) {
  const { t } = useTranslation();
  const [contacts, setContacts] = useState(() =>
    meetingContactsFromCompany(company)
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setContacts(meetingContactsFromCompany(company));
  }, [company]);

  const rows =
    Array.isArray(contacts) && contacts.length > 0
      ? contacts
      : [emptyMeetingContact()];

  const updateContact = (index, field, value) => {
    setContacts(
      rows.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  };

  const addContact = () => {
    if (rows.length >= 10) return;
    setContacts([...rows, emptyMeetingContact()]);
  };

  const removeContact = (index) => {
    if (rows.length <= 1) {
      setContacts([emptyMeetingContact()]);
      return;
    }
    setContacts(rows.filter((_, i) => i !== index));
  };

  const save = async () => {
    if (!company?._id) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/company/${company._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(meetingContactsUpdatePayload(rows)),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || body.message || "Failed");
      setContacts(meetingContactsFromCompany(body));
      onSaved?.(body);
    } catch (err) {
      setError(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (!company) return null;

  return (
    <Box sx={adminSurfaceSx(embedded)}>
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
            {t("companyProfile.meetingContactTitle")}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.5, whiteSpace: "normal", lineHeight: 1.5, ...adminReadableTextSx }}
          >
            {t("companyProfile.meetingContactsHelp")}
          </Typography>
        </Box>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={addContact}
          disabled={disabled || busy || rows.length >= 10}
          sx={{ textTransform: "none", flexShrink: 0 }}
        >
          {t("companyProfile.addMeetingContact")}
        </Button>
      </Stack>

      <Stack gap={1.5}>
        {rows.map((contact, index) => (
          <Box
            key={`meeting-contact-${index}`}
            sx={{
              p: 1.25,
              borderRadius: 1.5,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "action.hover",
            }}
          >
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mb: 1 }}
            >
              <Typography variant="caption" fontWeight={700} color="text.secondary">
                {t("companyProfile.meetingContactN", { n: index + 1 })}
              </Typography>
              <IconButton
                size="small"
                aria-label={t("companyProfile.removeMeetingContact")}
                onClick={() => removeContact(index)}
                disabled={disabled || busy}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Stack>
            <Stack gap={1}>
              <TextField
                size="small"
                label={t("companyProfile.meetingContactName")}
                value={contact.name || ""}
                onChange={(e) => updateContact(index, "name", e.target.value)}
                fullWidth
                disabled={disabled}
              />
              <TextField
                size="small"
                label={t("companyProfile.meetingContactPhone")}
                value={contact.phone || ""}
                onChange={(e) => updateContact(index, "phone", e.target.value)}
                fullWidth
                disabled={disabled}
              />
              <TextField
                size="small"
                label={t("companyProfile.meetingContactChannel")}
                value={contact.channel || ""}
                onChange={(e) => updateContact(index, "channel", e.target.value)}
                fullWidth
                placeholder="WhatsApp"
                disabled={disabled}
                helperText={
                  index === rows.length - 1
                    ? t("companyProfile.meetingContactChannelHelp")
                    : undefined
                }
              />
            </Stack>
          </Box>
        ))}
      </Stack>

      {error ? (
        <Typography
          color="error"
          variant="body2"
          sx={{ mt: 2, whiteSpace: "normal", ...adminReadableTextSx }}
        >
          {error}
        </Typography>
      ) : null}

      <Button
        variant="contained"
        onClick={save}
        disabled={disabled || busy}
        sx={{
          mt: 2.5,
          textTransform: "none",
          minWidth: { sm: 220 },
          ...adminReadableTextSx,
        }}
      >
        {t("companyProfile.savePeople")}
      </Button>
    </Box>
  );
}
