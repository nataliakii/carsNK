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
  50% { transform: scale(0.94); opacity: 0.88; }
`;

const ringSpin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

export default function Preloader({ loading }) {
  const [visible, setVisible] = useState(true);
  const brand = getActiveBrand();
  const greece = isGreeceSite();

  useLayoutEffect(() => {
    if (!loading) {
      const timeout = setTimeout(() => setVisible(false), 700);
      return () => clearTimeout(timeout);
    }
    setVisible(true);
  }, [loading]);

  const magenta = brand.primary;
  const bg = greece
    ? "rgba(255,255,255,0.94)"
    : "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(227,0,82,0.10) 0%, rgba(255,255,255,0.97) 55%, #fff 100%)";

  return (
    <Fade in={loading || visible} timeout={{ enter: 400, exit: 700 }}>
      <Backdrop
        open={loading || visible}
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 999,
          background: bg,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
          transition: "background 0.6s ease",
        }}
      >
        <Fade in={loading} timeout={400}>
          <Box
            sx={{
              position: "relative",
              width: 108,
              height: 108,
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
                  border: `2px solid transparent`,
                  borderTopColor: magenta,
                  borderRightColor: `${magenta}55`,
                  animation: `${ringSpin} 1.1s cubic-bezier(0.55, 0.15, 0.45, 0.85) infinite`,
                }}
              />
            )}
            <Box
              sx={{
                animation: greece
                  ? `${spin} 1.3s linear infinite`
                  : `${pulse} 1.4s ease-in-out infinite`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                filter: greece
                  ? undefined
                  : "drop-shadow(0 8px 20px rgba(227,0,82,0.28))",
              }}
            >
              <SiteMark size={greece ? 72 : 64} />
            </Box>
          </Box>
        </Fade>
      </Backdrop>
    </Fade>
  );
}
