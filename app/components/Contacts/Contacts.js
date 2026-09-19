"use client";

import React, { useState } from "react";
import {
  Container,
  Typography,
  Box,
  TextField,
  Alert,
  Link as MuiLink,
  Stack,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { useSnackbar } from "notistack";
import { ActionButton } from "@app/components/ui/buttons";
import { getPublicContactEmail } from "@config/email";

function Contacts() {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const companyEmail = getPublicContactEmail();

  const validateEmail = (value) => {
    if (!value) return true;
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(String(value).toLowerCase());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = {};

    if (!name.trim()) {
      newErrors.name = t("contact.errors.nameRequired", {
        defaultValue: "Name is required",
      });
    }

    if (!email.trim()) {
      newErrors.email = t("contact.errors.emailRequired", {
        defaultValue: "Email is required",
      });
    } else if (!validateEmail(email)) {
      newErrors.email = t("contact.errors.emailInvalid", {
        defaultValue: "Invalid email format",
      });
    }

    if (!subject.trim()) {
      newErrors.subject = t("contact.errors.subjectRequired", {
        defaultValue: "Subject is required",
      });
    }

    if (!message.trim()) {
      newErrors.message = t("contact.errors.messageRequired", {
        defaultValue: "Message is required",
      });
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
            errorData.error ||
            t("contact.errors.sendFailed", {
              defaultValue: "Could not send the message. Please try again later.",
            })
        );
      }

      enqueueSnackbar(
        t("contact.success", {
          defaultValue: "Message sent. We will get back to you soon.",
        }),
        { variant: "success" }
      );

      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch (error) {
      setErrors({
        submit:
          error.message ||
          t("contact.errors.sendFailed", {
            defaultValue: "Could not send the message. Please try again later.",
          }),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldSx = {
    "& .MuiOutlinedInput-root": {
      backgroundColor: "#fff",
    },
  };

  return (
    <Box
      component="section"
      sx={{
        minHeight: { xs: "auto", md: "calc(100vh - 64px)" },
        bgcolor: "#f7f7f8",
        py: { xs: 5, md: 8 },
        px: { xs: 2, sm: 3 },
      }}
    >
      <Container maxWidth="md" disableGutters sx={{ maxWidth: 920 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "minmax(0, 0.9fr) minmax(0, 1.1fr)" },
            gap: { xs: 4, md: 6 },
            alignItems: "start",
          }}
        >
          {/* Intro — left-aligned */}
          <Stack spacing={2} sx={{ pt: { md: 0.5 } }}>
            <Typography
              component="h1"
              sx={{
                fontSize: { xs: "1.75rem", md: "2.125rem" },
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "secondary.main",
                lineHeight: 1.2,
              }}
            >
              {t("contact.title", { defaultValue: "Contact us" })}
            </Typography>

            <Typography
              sx={{
                fontSize: "1.05rem",
                color: "text.secondary",
                lineHeight: 1.55,
                maxWidth: 360,
              }}
            >
              {t("contact.subtitle", {
                defaultValue: "Have questions? We're always happy to help.",
              })}
            </Typography>

            <Typography
              sx={{
                fontSize: "0.95rem",
                color: "text.secondary",
                lineHeight: 1.5,
                maxWidth: 360,
              }}
            >
              {t("contact.description", {
                defaultValue:
                  "Fill out the form and our team will get back to you soon.",
              })}
            </Typography>

            <Box sx={{ pt: 1 }}>
              <Typography
                sx={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "text.secondary",
                  mb: 0.75,
                }}
              >
                {t("contact.emailLabel", { defaultValue: "Support email" })}
              </Typography>
              <MuiLink
                href={`mailto:${companyEmail}`}
                color="primary"
                sx={{
                  fontSize: "1.05rem",
                  fontWeight: 600,
                  textDecoration: "none",
                  wordBreak: "break-all",
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                {companyEmail}
              </MuiLink>
            </Box>
          </Stack>

          {/* Form — left-aligned fields */}
          <Box
            component="form"
            onSubmit={handleSubmit}
            noValidate
            sx={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label={t("order.name", { defaultValue: "Name" })}
                variant="outlined"
                fullWidth
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={!!errors.name}
                helperText={errors.name}
                required
                size="medium"
                sx={fieldSx}
              />
              <TextField
                label={t("order.email", { defaultValue: "Email" })}
                variant="outlined"
                fullWidth
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={!!errors.email}
                helperText={errors.email}
                required
                size="medium"
                sx={fieldSx}
              />
            </Stack>

            <TextField
              label={t("contact.subject", { defaultValue: "Subject" })}
              variant="outlined"
              fullWidth
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              error={!!errors.subject}
              helperText={errors.subject}
              required
              size="medium"
              sx={fieldSx}
            />

            <TextField
              label={t("contact.message", { defaultValue: "Message" })}
              variant="outlined"
              fullWidth
              multiline
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              error={!!errors.message}
              helperText={errors.message}
              required
              size="medium"
              sx={fieldSx}
            />

            {errors.submit && (
              <Alert severity="error">{errors.submit}</Alert>
            )}

            <Box sx={{ pt: 0.5 }}>
              <ActionButton
                onClick={handleSubmit}
                label={t("contact.send", { defaultValue: "Send" })}
                loading={isSubmitting}
                disabled={isSubmitting}
                color="primary"
                variant="contained"
                size="large"
              />
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

export default Contacts;
