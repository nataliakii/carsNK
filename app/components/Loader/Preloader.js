"use client";

import { useLayoutEffect, useState } from "react";
import { Backdrop, Fade, Box, keyframes } from "@mui/material";
import { SiteMark } from "@app/components/brand/RovaroLogo";
import { getActiveBrand, isGreeceSite } from "@config/brand";

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const pulse = keyframes`
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(0.96); opacity: 0.92; }
`;

const ringSpin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const EXIT_MS = 280;

/**
 * Clean page gate: solid white + brand mark.
 * Avoids milky radial fog / long blurry fades on exit.
 */
export default function Preloader({ loading }) {
  const [visible, setVisible] = useState(true);
  const brand = getActiveBrand();
  const greece = isGreeceSite();

  useLayoutEffect(() => {
    if (!loading) {
      const timeout = setTimeout(() => setVisible(false), EXIT_MS);
      return () => clearTimeout(timeout);
    }
    setVisible(true);
  }, [loading]);

  const magenta = brand.primary;

  return (
    <Fade
      in={loading || visible}
      timeout={{ enter: 180, exit: EXIT_MS }}
      unmountOnExit
    >
      <Backdrop
        open
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 999,
          // Solid cover — no radial haze that reads as blur while fading out
          backgroundColor: "#ffffff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
        }}
      >
        <Box
          sx={{
            position: "relative",
            width: 96,
            height: 96,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {!greece && (
            <Box
              aria-hidden
              sx={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                border: "2px solid transparent",
                borderTopColor: magenta,
                borderRightColor: `${magenta}40`,
                animation: `${ringSpin} 1s linear infinite`,
              }}
            />
          )}
          <Box
            sx={{
              animation: greece
                ? `${spin} 1.2s linear infinite`
                : `${pulse} 1.35s ease-in-out infinite`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SiteMark size={greece ? 68 : 56} />
          </Box>
        </Box>
      </Backdrop>
    </Fade>
  );
}
