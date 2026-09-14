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

const BRAND_NAVY = "#0B1F3A";
const BRAND_CYAN = "#00C8D4";

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

const SectionRoot = styled("section")({
  position: "relative",
  overflow: "hidden",
  color: "#ffffff",
  background: `linear-gradient(165deg, #16345c 0%, ${BRAND_NAVY} 42%, #061222 100%)`,
  "&::before": {
    content: '""',
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    background:
      "radial-gradient(ellipse 65% 50% at 12% -10%, rgba(0,200,212,0.2), transparent 55%), radial-gradient(ellipse 40% 35% at 95% 90%, rgba(0,200,212,0.08), transparent 50%)",
  },
});

const AccentBar = styled("div")({
  height: 3,
  background: `linear-gradient(90deg, #E53935 0%, #E53935 28%, #FFD400 28%, #FFD400 52%, ${BRAND_CYAN} 52%, ${BRAND_CYAN} 100%)`,
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
    borderColor: "rgba(0,200,212,0.35)",
  },
}));

const IconWrap = styled(Box)({
  flexShrink: 0,
  width: 42,
  height: 42,
  borderRadius: 10,
  display: "grid",
  placeItems: "center",
  color: BRAND_CYAN,
  background: "rgba(0,200,212,0.12)",
  border: "1px solid rgba(0,200,212,0.35)",
  "& svg": {
    fontSize: 22,
  },
});

const FEATURES = [
  {
    key: "notifications",
    Icon: NotificationsActiveOutlinedIcon,
  },
  {
    key: "calendar",
    Icon: CalendarMonthOutlinedIcon,
  },
  {
    key: "move",
    Icon: OpenWithOutlinedIcon,
  },
  {
    key: "platform",
    Icon: HubOutlinedIcon,
  },
];

export default function ForBusinessSection() {
  const { t } = useTranslation();
  const { lang } = useMainContext();
  const contactsHref = withLocalePrefix(lang || "en", "/contacts");

  return (
    <SectionRoot id="for-business" aria-labelledby="for-business-heading">
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
                color: BRAND_CYAN,
              }}
            >
              {t("forBusiness.eyebrow")}
            </Typography>
            <Typography
              id="for-business-heading"
              component="h2"
              sx={{
                m: 0,
                mb: 1.5,
                fontWeight: 700,
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
              href={contactsHref}
              variant="contained"
              sx={{
                px: 2.75,
                py: 1.15,
                fontWeight: 700,
                textTransform: "none",
                borderRadius: 1.5,
                backgroundColor: BRAND_CYAN,
                color: BRAND_NAVY,
                boxShadow: "0 6px 22px rgba(0,200,212,0.28)",
                "&:hover": {
                  backgroundColor: "#4DDBE4",
                  boxShadow: "0 8px 26px rgba(0,200,212,0.38)",
                },
              }}
            >
              {t("forBusiness.cta")}
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
