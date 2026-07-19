"use client";

import React, { useState, useEffect, useRef } from "react";
import { Box, Typography, Stack } from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import Image from "next/image";
import Link from "next/link";
import ActionButton from "@/app/components/ui/buttons/ActionButton";
import TransferRequestModal from "@app/components/TransferRequestModal";
import { useTranslation } from "react-i18next";

const AUTO_MS = 6000;
const PHONE_PORTRAIT_QUERY =
  "(max-width: 767px) and (orientation: portrait) and (pointer: coarse)";
const COMPACT_PORTRAIT_PHONE_HERO_TOP_PADDING = "88px";

// Matches Feed mainPt so hero sits under nav with no white stripe
const HERO_TOP_PADDING = { xs: "110px", md: "90px" };
const HERO_NEGATIVE_MARGIN = { xs: "-110px", md: "-90px" };

const BRAND_RED_CTA_SX = {
  textDecoration: "none",
  backgroundColor: "#E53935",
  color: "#ffffff",
  padding: "14px 28px",
  borderRadius: "10px",
  fontWeight: 700,
  letterSpacing: "0.5px",
  boxShadow: "0 4px 18px rgba(229,57,53,0.35)",
  "&:hover": {
    backgroundColor: "#B71C1C",
    color: "#ffffff",
    textDecoration: "none",
    boxShadow: "0 6px 24px rgba(183,28,28,0.45)",
    transform: "translateY(-1px)",
  },
  "&:active": {
    backgroundColor: "#8e1515",
    color: "#ffffff",
    transform: "translateY(0)",
  },
};

const TRANSFER_CTA_SX = {
  textDecoration: "none",
  backgroundColor: "transparent",
  color: "#ffffff",
  padding: "14px 28px",
  borderRadius: "10px",
  fontWeight: 700,
  letterSpacing: "0.5px",
  border: "2px solid rgba(255,255,255,0.92)",
  boxShadow: "0 4px 18px rgba(0,0,0,0.18)",
  "&:hover": {
    backgroundColor: "rgba(255,255,255,0.12)",
    color: "#ffffff",
    borderColor: "#ffffff",
    textDecoration: "none",
    transform: "translateY(-1px)",
  },
  "&:active": {
    backgroundColor: "rgba(255,255,255,0.08)",
    transform: "translateY(0)",
  },
};

export default function SeoHeroSliderCard({
  title,
  paragraphs = [],
  imageUrls = [],
  imageAlt = "",
  ctaHref,
  ctaLabel,
  fullBleedUnderNav = false,
  disableImageOverlays = false,
  ctaPlacement = "inline",
  preserveTitleCase = false,
  stretchContentToEdge = false,
  ctaSx,
  enableTextShadow = false,
  textShadowValue = "",
  heroBenefits = [],
  hideSecondaryContentOnPortraitPhone = false,
  raiseTitleOnPortraitPhone = false,
  alignTitleLeftOnPortraitPhone = false,
  /** Force content to left or right on all breakpoints */
  contentSide,
  /** Single even dim over the image (no side gradients). Good with white text. */
  uniformImageDim = false,
  /** Prefill transfer "from" when Transfer CTA is used */
  transferInitialFrom = "",
  showTransferCta = false,
}) {
  const { t } = useTranslation();
  const [isPortraitPhone, setIsPortraitPhone] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mediaQuery = window.matchMedia(PHONE_PORTRAIT_QUERY);
    const applyMatch = () => setIsPortraitPhone(mediaQuery.matches);
    applyMatch();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", applyMatch);
      return () => mediaQuery.removeEventListener("change", applyMatch);
    }

    mediaQuery.addListener(applyMatch);
    return () => mediaQuery.removeListener(applyMatch);
  }, []);

  const slides =
    Array.isArray(imageUrls) && imageUrls.length > 0
      ? imageUrls
          .map((item) => {
            if (typeof item === "string") {
              return {
                src: item,
                objectPosition: "center center",
              };
            }

            if (!item || typeof item !== "object") {
              return null;
            }

            const src = isPortraitPhone
              ? item.portraitPhoneSrc || item.defaultSrc || ""
              : item.defaultSrc || item.portraitPhoneSrc || "";
            if (!src) return null;

            const objectPosition = isPortraitPhone
              ? item.portraitObjectPosition ||
                item.objectPosition ||
                "center center"
              : item.objectPosition ||
                item.portraitObjectPosition ||
                "center center";

            return { src, objectPosition };
          })
          .filter(Boolean)
      : [];

  const [index, setIndex] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (slides.length <= 1) return;

    intervalRef.current = setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, AUTO_MS);

    return () => clearInterval(intervalRef.current);
  }, [slides.length]);

  const shouldShowBottomRightCta =
    ctaPlacement === "bottomRight" &&
    ((ctaHref && ctaLabel) || showTransferCta);
  const hasHeroBenefits =
    Array.isArray(heroBenefits) && heroBenefits.length > 0;
  const shouldHideSecondaryContent =
    hideSecondaryContentOnPortraitPhone && isPortraitPhone;
  const heroTextShadow = enableTextShadow
    ? textShadowValue ||
      "0 3px 14px rgba(0,0,0,0.65), 0 1px 3px rgba(0,0,0,0.75)"
    : "none";
  const heroTopPadding =
    fullBleedUnderNav && raiseTitleOnPortraitPhone && isPortraitPhone
      ? COMPACT_PORTRAIT_PHONE_HERO_TOP_PADDING
      : HERO_TOP_PADDING;

  const alignLeft =
    contentSide === "left" ||
    (contentSide !== "right" &&
      alignTitleLeftOnPortraitPhone &&
      isPortraitPhone);

  const findCarSx = { ...BRAND_RED_CTA_SX, ...(ctaSx || {}) };

  const ctaButtons = (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1.25}
      alignItems={{ xs: "stretch", sm: "center" }}
      justifyContent={alignLeft ? "flex-start" : "flex-end"}
    >
      {ctaHref && ctaLabel && (
        <ActionButton
          component={Link}
          href={ctaHref}
          label={ctaLabel}
          color="primary"
          variant="contained"
          size="large"
          sx={findCarSx}
        />
      )}
      {showTransferCta && (
        <ActionButton
          label={t("header.transfer")}
          color="primary"
          variant="outlined"
          size="large"
          onClick={() => setTransferOpen(true)}
          sx={TRANSFER_CTA_SX}
        />
      )}
    </Stack>
  );

  return (
    <Box
      component="section"
      sx={{
        position: "relative",
        width: "100%",
        minHeight: { xs: 480, md: 600 },
        overflow: "hidden",
        ...(fullBleedUnderNav && { mt: HERO_NEGATIVE_MARGIN }),
      }}
    >
      {/* SLIDES */}
      {slides.map((slide, i) => (
        <Box
          key={i}
          sx={{
            position: "absolute",
            inset: 0,
            opacity: i === index ? 1 : 0,
            transition: "opacity 1s ease",
          }}
        >
          <Image
            src={slide.src}
            alt={imageAlt}
            fill
            priority={i === 0}
            style={{
              objectFit: "cover",
              objectPosition: slide.objectPosition,
            }}
          />
        </Box>
      ))}

      {!disableImageOverlays && uniformImageDim && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            bgcolor: "rgba(0,0,0,0.38)",
            pointerEvents: "none",
          }}
        />
      )}

      {!disableImageOverlays && !uniformImageDim && (
        <>
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.55))",
              pointerEvents: "none",
            }}
          />
          <Box
            sx={(theme) => ({
              position: "absolute",
              inset: 0,
              background: alignLeft
                ? `linear-gradient(90deg, 
                ${theme.palette.common.black}CC 0%, 
                ${theme.palette.common.black}88 40%, 
                transparent 75%)`
                : `linear-gradient(270deg, 
                ${theme.palette.common.black}CC 0%, 
                ${theme.palette.common.black}88 40%, 
                transparent 75%)`,
              pointerEvents: "none",
            })}
          />
        </>
      )}

      {/* CONTENT */}
      <Box
        sx={{
          position: "relative",
          zIndex: 2,
          maxWidth: stretchContentToEdge ? "100%" : 1200,
          mx: "auto",
          px: 3,
          py: { xs: 6, md: 10 },
          color: "common.white",
          display: "flex",
          justifyContent: alignLeft ? "flex-start" : "flex-end",
          ...(fullBleedUnderNav && { pt: heroTopPadding }),
        }}
      >
        <Box
          sx={{
            maxWidth: 680,
            textAlign: alignLeft ? "left" : "right",
          }}
        >
          {ctaHref && ctaLabel && ctaPlacement !== "bottomRight" && (
            <Box sx={{ mb: 2 }}>{ctaButtons}</Box>
          )}
          <Typography
            component="h1"
            variant="h2"
            sx={{
              fontWeight: 1000,
              lineHeight: 1.2,
              mb: 2,
              color: "common.white",
              textTransform: preserveTitleCase ? "none" : "uppercase",
              letterSpacing: "0.05em",
              fontSize: "clamp(1.5rem, 4vw, 2.5rem)",
              textShadow: heroTextShadow,
              textAlign: alignLeft ? "left" : "right",
            }}
          >
            {title}
          </Typography>

          {!shouldHideSecondaryContent &&
            paragraphs.map((p, i) => (
              <Typography
                key={i}
                variant="body1"
                sx={{
                  opacity: 0.95,
                  lineHeight: 1.7,
                  mb: 1.5,
                  color: "common.white",
                  textShadow: heroTextShadow,
                }}
              >
                {p}
              </Typography>
            ))}

          {!shouldHideSecondaryContent && hasHeroBenefits && (
            <Box
              sx={{
                mt: { xs: 2, md: 2.5 },
                ml: alignLeft ? 0 : "auto",
                mr: alignLeft ? "auto" : 0,
                width: { xs: "100%", md: "min(340px, 100%)" },
                maxWidth: 340,
                px: { xs: 1.35, md: 1.7 },
                py: { xs: 1.1, md: 1.4 },
                borderRadius: { xs: "16px", md: "18px" },
                background:
                  "linear-gradient(180deg, rgba(16,22,38,0.32) 0%, rgba(10,14,26,0.20) 100%)",
                border: "1px solid rgba(255,255,255,0.08)",
                backdropFilter: "blur(9px)",
                boxShadow: "0 14px 30px rgba(0,0,0,0.16)",
              }}
            >
              <Stack spacing={{ xs: 0.7, md: 0.85 }}>
                {heroBenefits.map((item) => (
                  <Box
                    key={item}
                    sx={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: alignLeft ? "flex-start" : "flex-end",
                      gap: 0.75,
                      flexDirection: alignLeft ? "row" : "row-reverse",
                    }}
                  >
                    <Typography
                      variant="body1"
                      sx={{
                        color: "common.white",
                        lineHeight: 1.3,
                        fontWeight: 500,
                        fontSize: { xs: "0.9rem", md: "0.98rem" },
                        textShadow: heroTextShadow,
                      }}
                    >
                      {item}
                    </Typography>
                    <CheckCircleRoundedIcon
                      sx={{
                        color: "#35c759",
                        fontSize: { xs: 20, md: 22 },
                        mt: "1px",
                        flexShrink: 0,
                        filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.35))",
                      }}
                    />
                  </Box>
                ))}
              </Stack>
            </Box>
          )}
        </Box>
      </Box>

      {shouldShowBottomRightCta && (
        <Box
          sx={{
            position: "absolute",
            ...(alignLeft
              ? { left: { xs: 16, md: 32 } }
              : { right: { xs: 16, md: 32 } }),
            bottom: slides.length > 1 ? { xs: 56, md: 72 } : { xs: 24, md: 32 },
            zIndex: 4,
          }}
        >
          {ctaButtons}
        </Box>
      )}

      {/* DOTS */}
      {slides.length > 1 && (
        <Stack
          direction="row"
          justifyContent="center"
          spacing={1}
          sx={{
            position: "absolute",
            bottom: 24,
            left: 0,
            right: 0,
            zIndex: 3,
          }}
        >
          {slides.map((_, i) => (
            <Box
              key={i}
              onClick={() => setIndex(i)}
              sx={(theme) => ({
                width: 10,
                height: 10,
                borderRadius: "50%",
                cursor: "pointer",
                bgcolor:
                  i === index
                    ? theme.palette.primary.main
                    : "rgba(255,255,255,0.5)",
                transition: "all 0.3s ease",
              })}
            />
          ))}
        </Stack>
      )}

      {showTransferCta && (
        <TransferRequestModal
          open={transferOpen}
          onClose={() => setTransferOpen(false)}
          initialFrom={transferInitialFrom}
        />
      )}
    </Box>
  );
}
