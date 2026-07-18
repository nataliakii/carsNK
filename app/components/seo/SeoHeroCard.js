"use client";

import React from "react";
import { Box, Typography, Chip, Stack } from "@mui/material";
import Image from "next/image";

/**
 * Premium SEO hero block: H1, paragraphs, optional chips, optional image.
 * Image (when provided) has a subtle hover-reveal on desktop; on mobile it is static or hidden.
 * Uses MUI theme only; respects prefers-reduced-motion.
 */
export default function SeoHeroCard({
  title,
  introText,
  paragraphs,
  chips = [],
  imageUrl = null,
}) {
  const intro = introText ?? "";
  const texts = Array.isArray(paragraphs) && paragraphs.length > 0
    ? paragraphs
    : intro
      ? [intro]
      : [];

  return (
    <Box
      component="section"
      sx={{
        maxWidth: 980,
        mx: "auto",
        px: 2,
        py: { xs: 3, md: 4 },
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: imageUrl ? "1fr minmax(200px, 320px)" : "1fr" },
          gap: { xs: 2, md: 3 },
          alignItems: "center",
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            component="h1"
            variant="h1"
            sx={{
              mb: 1.5,
              color: "text.primary",
            }}
          >
            {title}
          </Typography>
          {texts.map((p, i) => (
            <Typography
              key={i}
              component="p"
              variant="body1"
              sx={{
                mt: i > 0 ? 1.5 : 0,
                lineHeight: 1.7,
                color: "text.secondary",
              }}
            >
              {p}
            </Typography>
          ))}
          {chips?.length > 0 && (
            <Stack
              direction="row"
              flexWrap="wrap"
              gap={1}
              sx={{ mt: 2 }}
            >
              {chips.map((label, i) => (
                <Chip
                  key={i}
                  label={label}
                  size="small"
                  variant="outlined"
                  sx={{
                    borderColor: "divider",
                    color: "text.secondary",
                    fontWeight: 500,
                  }}
                />
              ))}
            </Stack>
          )}
        </Box>

        {imageUrl && (
          <Box
            sx={{
              position: "relative",
              borderRadius: 2,
              overflow: "hidden",
              aspectRatio: "16/10",
              minHeight: { xs: 120, md: 180 },
              maxHeight: { md: 220 },
              // On mobile: static image
              opacity: { xs: 0.95, md: 1 },
              // Desktop: subtle hover-reveal (opacity/scale). Disabled when reduced motion.
              "@media (hover: hover) and (pointer: fine)": {
                "& .seo-hero-image": {
                  transition: "opacity 0.4s ease, transform 0.4s ease",
                },
                "&:hover .seo-hero-image": {
                  opacity: 1,
                  transform: "scale(1.02)",
                },
              },
              "@media (prefers-reduced-motion: reduce)": {
                "& .seo-hero-image": {
                  transition: "none",
                },
                "&:hover .seo-hero-image": {
                  transform: "none",
                },
              },
            }}
          >
            <Image
              src={imageUrl}
              alt=""
              aria-hidden="true"
              fill
              className="seo-hero-image"
              sizes="(max-width: 768px) 100vw, 320px"
              style={{
                objectFit: "cover",
                opacity: 0.92,
              }}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}
