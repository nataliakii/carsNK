"use client";

import { useLayoutEffect, useState } from "react";
import Image from "next/image";
import { Backdrop, Fade, Box, keyframes } from "@mui/material";

// 🔁 Вращение через MUI keyframes
const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

export default function Preloader({ loading }) {
  const [visible, setVisible] = useState(true);

  useLayoutEffect(() => {
    if (!loading) {
      const timeout = setTimeout(() => setVisible(false), 700);
      return () => clearTimeout(timeout);
    } else {
      setVisible(true);
    }
  }, [loading]);

  return (
    <Fade in={loading || visible} timeout={{ enter: 400, exit: 700 }}>
      <Backdrop
        open={loading || visible}
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 999,
          backgroundColor: "rgba(255,255,255,0.85)",
          color: "#000",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          transition: "background-color 0.6s ease",
        }}
      >
        {/* Контейнер с плавным появлением и вращением */}
        <Fade in={loading} timeout={400}>
          <Box
            sx={{
              width: 100,
              height: 100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              animation: `${spin} 1.3s linear infinite`,
              filter: "drop-shadow(0 0 6px rgba(0,0,0,0.3))",
            }}
          >
            <Image
              src="/logo-carsnk-icon.png"
              alt="CarsNK"
              width={90}
              height={90}
              priority
            />
          </Box>
        </Fade>
      </Backdrop>
    </Fade>
  );
}
