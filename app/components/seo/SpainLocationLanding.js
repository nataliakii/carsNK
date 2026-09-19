"use client";

import Link from "next/link";
import { Box, Button, Stack, Typography } from "@mui/material";
import { BRAND } from "@config/brand";

/**
 * Lightweight Spain SEO location landing (Barcelona / Costa Brava).
 */
export default function SpainLocationLanding({
  h1,
  intro,
  whyTitle,
  whyItems,
  tipsTitle,
  tips,
  ctaLabel,
  ctaHref,
  nearbyLabel,
  nearbyHref,
}) {
  return (
    <Box
      component="main"
      sx={{
        bgcolor: "#f7f7f8",
        color: "text.primary",
        minHeight: "60vh",
        py: { xs: 4, md: 6 },
        px: { xs: 2, md: 3 },
      }}
    >
      <Box sx={{ maxWidth: 820, mx: "auto" }}>
        <Typography
          component="h1"
          sx={{
            fontSize: { xs: "1.75rem", md: "2.35rem" },
            fontWeight: 750,
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
            mb: 2,
          }}
        >
          {h1}
        </Typography>

        <Typography
          sx={{
            fontSize: "1.05rem",
            lineHeight: 1.65,
            color: "text.secondary",
            mb: 3.5,
            maxWidth: 640,
          }}
        >
          {intro}
        </Typography>

        <Button
          component={Link}
          href={ctaHref}
          variant="contained"
          sx={{
            textTransform: "none",
            fontWeight: 700,
            px: 3,
            py: 1.25,
            bgcolor: BRAND.pink,
            "&:hover": { bgcolor: BRAND.pinkDark || BRAND.pink },
            mb: 5,
          }}
        >
          {ctaLabel}
        </Button>

        <Stack spacing={3.5}>
          <Box>
            <Typography
              component="h2"
              sx={{ fontSize: "1.2rem", fontWeight: 700, mb: 1.25 }}
            >
              {whyTitle}
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {(whyItems || []).map((item) => (
                <Typography
                  key={item}
                  component="li"
                  sx={{ mb: 0.75, color: "text.secondary", lineHeight: 1.55 }}
                >
                  {item}
                </Typography>
              ))}
            </Box>
          </Box>

          <Box>
            <Typography
              component="h2"
              sx={{ fontSize: "1.2rem", fontWeight: 700, mb: 1.25 }}
            >
              {tipsTitle}
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {(tips || []).map((item) => (
                <Typography
                  key={item}
                  component="li"
                  sx={{ mb: 0.75, color: "text.secondary", lineHeight: 1.55 }}
                >
                  {item}
                </Typography>
              ))}
            </Box>
          </Box>

          {nearbyHref && nearbyLabel ? (
            <Typography sx={{ color: "text.secondary" }}>
              <Link
                href={nearbyHref}
                style={{ color: BRAND.pink, fontWeight: 600 }}
              >
                {nearbyLabel}
              </Link>
            </Typography>
          ) : null}
        </Stack>
      </Box>
    </Box>
  );
}
