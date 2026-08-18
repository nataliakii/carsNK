"use client";

import React from "react";
import { Typography, Stack, Link as MuiLink, Box } from "@mui/material";
import { styled } from "@mui/material/styles";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { useMainContext } from "@app/Context";
import { withLocalePrefix } from "@domain/locationSeo/locationSeoService";

const CallIcon = dynamic(() => import("@mui/icons-material/Call"), {
  ssr: false,
});
const EmailIcon = dynamic(() => import("@mui/icons-material/Email"), {
  ssr: false,
});
const QrCode2Icon = dynamic(() => import("@mui/icons-material/QrCode2"), {
  ssr: false,
});
const CodeIcon = dynamic(() => import("@mui/icons-material/Code"), {
  ssr: false,
});
const LinkedInIcon = dynamic(() => import("@mui/icons-material/LinkedIn"), {
  ssr: false,
});
const ArrowOutwardIcon = dynamic(
  () => import("@mui/icons-material/ArrowOutward"),
  { ssr: false }
);

const BRAND_NAVY = "#0B1F3A";
const BRAND_CYAN = "#00C8D4";
const BRAND_RED = "#E53935";
const BRAND_YELLOW = "#FFD400";

const FooterRoot = styled("footer")({
  position: "relative",
  overflow: "hidden",
  color: "#ffffff",
  background: `linear-gradient(165deg, #16345c 0%, ${BRAND_NAVY} 38%, #061222 100%)`,
  "&::before": {
    content: '""',
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    background:
      "radial-gradient(ellipse 70% 55% at 8% -8%, rgba(0,200,212,0.22), transparent 58%), radial-gradient(ellipse 45% 40% at 100% 100%, rgba(229,57,53,0.12), transparent 50%)",
  },
});

const BrandBar = styled("div")({
  height: 4,
  background: `linear-gradient(90deg, ${BRAND_RED} 0%, ${BRAND_RED} 28%, ${BRAND_YELLOW} 28%, ${BRAND_YELLOW} 52%, ${BRAND_CYAN} 52%, ${BRAND_CYAN} 100%)`,
});

const Inner = styled(Box)(({ theme }) => ({
  position: "relative",
  zIndex: 1,
  maxWidth: 1120,
  marginInline: "auto",
  padding: theme.spacing(5, 3, 3),
  [theme.breakpoints.up("md")]: {
    padding: theme.spacing(6, 4, 3.5),
  },
}));

const SectionTitle = styled(Typography)({
  fontSize: "0.68rem",
  fontWeight: 700,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: BRAND_CYAN,
  marginBottom: 12,
});

const FooterLink = styled(Link)({
  color: "rgba(255,255,255,0.82)",
  textDecoration: "none",
  fontSize: "0.86rem",
  lineHeight: 1.45,
  transition: "color 0.18s ease",
  "&:hover": {
    color: BRAND_CYAN,
  },
});

const ContactAnchor = styled("a")({
  color: "rgba(255,255,255,0.9)",
  textDecoration: "none",
  fontSize: "0.9rem",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  transition: "color 0.18s ease",
  "&:hover": {
    color: BRAND_CYAN,
  },
  "& svg": {
    fontSize: "1.05rem",
    color: BRAND_CYAN,
  },
});

const CreditLink = styled(MuiLink)({
  color: "rgba(255,255,255,0.55)",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: "0.72rem",
  transition: "color 0.18s ease",
  "&:hover": {
    color: "#ffffff",
  },
});

function Footer() {
  const { company, lang } = useMainContext();
  const currentYear = new Date().getFullYear();
  const { t } = useTranslation();

  const name = "CarsNK";
  const slogan = company?.slogan || "Car rental aggregator in Greece";
  const tel = company?.tel || "+380 68 100 3771";
  const tel2 = company?.tel2 || "+353 85 270 96 05";
  const email = company?.email || "admin@bbqr.site";

  const localeLink = (path) => withLocalePrefix(lang || "en", path);
  const guideHref = `https://kalikratia.bbqr.site/${lang || "en"}`;

  const legalLinks = [
    { href: localeLink("/privacy-policy"), label: t("footer.privacyPolicy") },
    { href: localeLink("/terms-of-service"), label: t("footer.termsOfService") },
    { href: localeLink("/cookie-policy"), label: t("footer.cookiePolicy") },
    { href: localeLink("/rental-terms"), label: t("footer.rentalTerms") },
    { href: "/login", label: t("footer.adminLogin") },
  ];

  return (
    <FooterRoot>
      <BrandBar />
      <Inner>
        <Box
          sx={{
            display: "grid",
            gap: { xs: 4, md: 5 },
            gridTemplateColumns: {
              xs: "1fr",
              sm: "1fr 1fr",
              md: "1.35fr 0.95fr 0.95fr 1.15fr",
            },
            alignItems: "start",
          }}
        >
          <Stack spacing={1.25} sx={{ textAlign: { xs: "center", md: "left" } }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: { xs: "center", md: "flex-start" },
              }}
            >
              <Image
                src="/logo-hor-transparent-l.png"
                width={280}
                height={126}
                alt="CarsNK"
                style={{
                  width: "min(280px, 78vw)",
                  height: "auto",
                  objectFit: "contain",
                }}
              />
            </Box>
            <Typography
              sx={{
                fontSize: "0.78rem",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.72)",
                maxWidth: 320,
                mx: { xs: "auto", md: 0 },
              }}
            >
              {slogan}
            </Typography>
          </Stack>

          <Box sx={{ textAlign: { xs: "center", sm: "left" } }}>
            <SectionTitle>{t("footer.contactUs")}</SectionTitle>
            <Stack spacing={1.15} alignItems={{ xs: "center", sm: "flex-start" }}>
              <ContactAnchor href={`tel:${tel}`}>
                <CallIcon />
                {tel}
              </ContactAnchor>
              {tel2 ? (
                <ContactAnchor href={`tel:${tel2}`}>
                  <CallIcon />
                  {tel2}
                </ContactAnchor>
              ) : null}
              <ContactAnchor href={`mailto:${email}`}>
                <EmailIcon />
                {email}
              </ContactAnchor>
            </Stack>
          </Box>

          <Box sx={{ textAlign: { xs: "center", sm: "left" } }}>
            <SectionTitle>{t("footer.explore")}</SectionTitle>
            <Stack
              component="nav"
              aria-label={t("footer.explore")}
              spacing={0.85}
              alignItems={{ xs: "center", sm: "flex-start" }}
            >
              {legalLinks.map((item) => (
                <FooterLink key={item.href} href={item.href}>
                  {item.label}
                </FooterLink>
              ))}
            </Stack>
          </Box>

          <Box
            component="a"
            href={guideHref}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 1.25,
              p: 2,
              borderRadius: "14px",
              textDecoration: "none",
              color: "#fff",
              background:
                "linear-gradient(160deg, rgba(0,200,212,0.16) 0%, rgba(255,255,255,0.05) 100%)",
              border: "1px solid rgba(0,200,212,0.32)",
              boxShadow: "0 10px 28px rgba(0,0,0,0.22)",
              transition:
                "transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease",
              "&:hover": {
                transform: "translateY(-2px)",
                borderColor: "rgba(0,200,212,0.7)",
                boxShadow: "0 14px 32px rgba(0,200,212,0.18)",
              },
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: "10px",
                  overflow: "hidden",
                  flexShrink: 0,
                  border: "1px solid rgba(255,255,255,0.18)",
                }}
              >
                <Image
                  src="/nk/9.png"
                  alt="Nea Kallikratia Guide"
                  width={48}
                  height={48}
                  style={{ objectFit: "cover", width: 48, height: 48 }}
                />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  sx={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    color: BRAND_CYAN,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  {t("footer.kallikratiaBannerLink")}
                </Typography>
                <Typography
                  sx={{
                    mt: 0.35,
                    fontSize: "0.82rem",
                    lineHeight: 1.35,
                    color: "rgba(255,255,255,0.88)",
                  }}
                >
                  {t("footer.kallikratiaBanner")}
                </Typography>
              </Box>
            </Stack>
            <Typography
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                fontSize: "0.78rem",
                fontWeight: 600,
                color: "#fff",
              }}
            >
              {t("footer.kallikratiaCta")}
              <ArrowOutwardIcon sx={{ fontSize: 16, color: BRAND_CYAN }} />
            </Typography>
          </Box>
        </Box>

        <Box
          sx={{
            mt: { xs: 4, md: 5 },
            pt: 2.25,
            borderTop: "1px solid rgba(255,255,255,0.12)",
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1.5,
          }}
        >
          <Typography
            sx={{
              fontSize: "0.72rem",
              color: "rgba(255,255,255,0.5)",
              letterSpacing: "0.04em",
            }}
          >
            © {currentYear} {name}. {t("footer.rights")}
          </Typography>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={{ xs: 1, sm: 2.5 }}
            alignItems="center"
          >
            <CreditLink
              href="https://www.bbqr.site"
              target="_blank"
              rel="noopener noreferrer"
            >
              <QrCode2Icon sx={{ fontSize: 16 }} />
              BBQR
            </CreditLink>
            <CreditLink
              href="https://www.linkedin.com/in/natalia-kirejeva/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <CodeIcon sx={{ fontSize: 16 }} />
              {t("footer.developedBy")}
              <LinkedInIcon sx={{ fontSize: 15 }} />
            </CreditLink>
          </Stack>
        </Box>
      </Inner>
    </FooterRoot>
  );
}

export default Footer;
