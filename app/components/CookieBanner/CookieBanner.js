"use client";

/**
 * CookieBanner Component
 * 
 * GDPR-compliant cookie consent banner with:
 * - i18n support (EN, EL, RU)
 * - Accept/Reject buttons
 * - Persistent consent in localStorage
 * - No analytics loaded before consent
 */

import React from "react";
import { styled } from "@mui/material/styles";
import { Box, Button, Typography, Link as MuiLink } from "@mui/material";
import Link from "next/link";
import { useCookieConsent } from "./CookieConsentContext";
import { getCookieBannerText } from "./translations";
import { useMainContext } from "@app/Context";

// Styled components
const BannerContainer = styled(Box)(({ theme }) => ({
  position: "fixed",
  bottom: 0,
  left: 0,
  right: 0,
  backgroundColor: theme.palette.background.paper,
  borderTop: `1px solid ${theme.palette.divider}`,
  boxShadow: theme.shadows[8],
  padding: theme.spacing(2, 3),
  zIndex: theme.zIndex.snackbar + 1,
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2),
  [theme.breakpoints.up("md")]: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
}));

const TextContent = styled(Box)(({ theme }) => ({
  flex: 1,
}));

const ButtonGroup = styled(Box)(({ theme }) => ({
  display: "flex",
  gap: theme.spacing(1),
  flexShrink: 0,
}));

const AcceptButton = styled(Button)(({ theme }) => ({
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  "&:hover": {
    backgroundColor: theme.palette.primary.dark,
  },
}));

const RejectButton = styled(Button)(({ theme }) => ({
  borderColor: theme.palette.grey[400],
  color: theme.palette.text.secondary,
  "&:hover": {
    borderColor: theme.palette.grey[600],
    backgroundColor: theme.palette.action.hover,
  },
}));

export default function CookieBanner() {
  const { consent, isLoaded, acceptCookies, rejectCookies } = useCookieConsent();
  const { lang } = useMainContext();

  // Get translations based on current language
  const t = getCookieBannerText(lang || "en");

  // Don't render until localStorage is checked
  if (!isLoaded) {
    return null;
  }

  // Don't render if user has already made a choice
  if (consent !== null) {
    return null;
  }

  return (
    <BannerContainer data-testid="cookie-banner">
      <TextContent>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          {t.title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t.message}{" "}
          <MuiLink
            component={Link}
            href={t.cookieLink}
            underline="hover"
            color="primary"
          >
            {t.learnMore}
          </MuiLink>
        </Typography>
      </TextContent>

      <ButtonGroup>
        <RejectButton
          variant="outlined"
          onClick={rejectCookies}
          data-testid="cookie-reject-btn"
        >
          {t.reject}
        </RejectButton>
        <AcceptButton
          variant="contained"
          onClick={acceptCookies}
          data-testid="cookie-accept-btn"
        >
          {t.accept}
        </AcceptButton>
      </ButtonGroup>
    </BannerContainer>
  );
}
