"use client";

import { Box, Button, Stack, Typography } from "@mui/material";
import { styled, keyframes } from "@mui/material/styles";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useMainContext } from "@app/Context";
import { withLocalePrefix } from "@domain/locationSeo/locationSeoService";
import NotificationsActiveOutlinedIcon from "@mui/icons-material/NotificationsActiveOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import OpenWithOutlinedIcon from "@mui/icons-material/OpenWithOutlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import { BRAND, isGreeceSite } from "@config/brand";

const fadeUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const greece = isGreeceSite();
const accentGlow = greece
  ? "radial-gradient(ellipse 65% 50% at 12% -10%, rgba(0,200,212,0.18), transparent 55%), radial-gradient(ellipse 40% 35% at 95% 90%, rgba(0,200,212,0.08), transparent 50%)"
  : "radial-gradient(ellipse 65% 50% at 12% -10%, rgba(227,0,82,0.22), transparent 55%), radial-gradient(ellipse 40% 35% at 95% 90%, rgba(227,0,82,0.08), transparent 50%)";

const SectionRoot = styled("section")({
  position: "relative",
  overflow: "hidden",
  color: "#ffffff",
  background: `linear-gradient(165deg, #1a1a1a 0%, ${BRAND.black} 42%, #000000 100%)`,
  "&::before": {
    content: '""',
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    background: accentGlow,
  },
});

const AccentBar = styled("div")({
  height: 3,
  background: greece
    ? "linear-gradient(90deg, #E53935 0%, #FFD400 50%, #00C8D4 100%)"
    : BRAND.pink,
});

const Inner = styled(Box)(({ theme }) => ({
  position: "relative",
  zIndex: 1,
  maxWidth: 1120,
  marginInline: "auto",
  padding: theme.spacing(5, 3, 5.5),
  [theme.breakpoints.up("md")]: {
    padding: theme.spacing(7, 4, 7),
  },
}));

const FeatureItem = styled(Box)(({ theme }) => ({
  display: "flex",
  gap: theme.spacing(1.75),
  alignItems: "flex-start",
  padding: theme.spacing(1.75, 0),
  borderBottom: "1px solid rgba(255,255,255,0.1)",
  animation: `${fadeUp} 0.55s ease both`,
  transition: "transform 0.2s ease, border-color 0.2s ease",
  "&:last-of-type": {
    borderBottom: "none",
  },
  "&:hover": {
    transform: "translateX(4px)",
    borderColor: "rgba(227,0,82,0.45)",
  },
}));

const IconWrap = styled(Box)({
  flexShrink: 0,
  width: 42,
  height: 42,
  borderRadius: 10,
  display: "grid",
  placeItems: "center",
  color: BRAND.pink,
  background: "rgba(227,0,82,0.12)",
  border: "1px solid rgba(227,0,82,0.4)",
  "& svg": {
    fontSize: 22,
  },
});

const FEATURES = [
  { key: "notifications", Icon: NotificationsActiveOutlinedIcon },
  { key: "calendar", Icon: CalendarMonthOutlinedIcon },
  { key: "move", Icon: OpenWithOutlinedIcon },
  { key: "platform", Icon: HubOutlinedIcon },
];

/**
 * Landing block for /for-business.
 * The CTA goes to contacts: this page is the platform explanation, so the
 * button must not link back to itself.
 */
export default function ForBusinessSection() {
  const { t } = useTranslation();
  const { lang } = useMainContext();
  const locale = lang || "en";
  const ctaHref = withLocalePrefix(locale, "/contacts");
  const ctaLabel = t("forBusiness.contactCta", { defaultValue: "Contact us" });

  return (
    <SectionRoot
      id="for-business"
      aria-labelledby="for-business-heading"
      sx={{ minHeight: { md: "calc(100vh - 64px)" } }}
    >
      <AccentBar />
      <Inner>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={{ xs: 3.5, md: 6 }}
          alignItems={{ md: "flex-start" }}
        >
          <Box
            sx={{
              flex: { md: "0 1 42%" },
              maxWidth: { md: 440 },
              animation: `${fadeUp} 0.5s ease both`,
            }}
          >
            <Typography
              component="p"
              sx={{
                m: 0,
                mb: 1.25,
                fontSize: "0.72rem",
                fontWeight: 700,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: BRAND.pink,
              }}
            >
              {t("forBusiness.eyebrow")}
            </Typography>
            <Typography
              id="for-business-heading"
              component="h1"
              sx={{
                m: 0,
                mb: 1.5,
                fontWeight: 800,
                fontFamily: "Nunito, sans-serif",
                fontSize: { xs: "1.55rem", md: "2rem" },
                lineHeight: 1.2,
                letterSpacing: "-0.02em",
                color: "#fff",
              }}
            >
              {t("forBusiness.title")}
            </Typography>
            <Typography
              sx={{
                m: 0,
                mb: 2.5,
                color: "rgba(255,255,255,0.78)",
                fontSize: { xs: "0.95rem", md: "1.02rem" },
                lineHeight: 1.65,
              }}
            >
              {t("forBusiness.intro")}
            </Typography>
            <Button
              component={Link}
              href={ctaHref}
              variant="contained"
              sx={{
                px: 2.75,
                py: 1.15,
                fontWeight: 800,
                textTransform: "none",
                borderRadius: 1.5,
                backgroundColor: BRAND.pink,
                color: BRAND.white,
                boxShadow: "0 6px 22px rgba(227,0,82,0.32)",
                "&:hover": {
                  backgroundColor: BRAND.pinkLight,
                  boxShadow: "0 8px 26px rgba(227,0,82,0.4)",
                },
              }}
            >
              {ctaLabel}
            </Button>
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            {FEATURES.map(({ key, Icon }, index) => (
              <FeatureItem
                key={key}
                sx={{ animationDelay: `${0.08 + index * 0.07}s` }}
              >
                <IconWrap>
                  <Icon aria-hidden />
                </IconWrap>
                <Box sx={{ minWidth: 0, pt: 0.25 }}>
                  <Typography
                    component="h3"
                    sx={{
                      m: 0,
                      mb: 0.4,
                      fontWeight: 700,
                      fontSize: "1.02rem",
                      color: "#fff",
                    }}
                  >
                    {t(`forBusiness.features.${key}.title`)}
                  </Typography>
                  <Typography
                    sx={{
                      m: 0,
                      color: "rgba(255,255,255,0.72)",
                      fontSize: "0.9rem",
                      lineHeight: 1.55,
                    }}
                  >
                    {t(`forBusiness.features.${key}.text`)}
                  </Typography>
                </Box>
              </FeatureItem>
            ))}
          </Box>
        </Stack>
      </Inner>
    </SectionRoot>
  );
}
