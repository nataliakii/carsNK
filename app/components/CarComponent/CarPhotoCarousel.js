"use client";

import React, { useCallback, useRef, useState } from "react";
import { Box } from "@mui/material";
import IconButton from "@mui/material/IconButton";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import CarPhoto from "./CarPhoto";

/**
 * Swipeable gallery over CarPhoto. One image = plain photo, no chrome.
 */
export default function CarPhotoCarousel({
  photos = [],
  alt = "",
  priority = false,
  sizes,
  iconSize,
  contentPaddingBottom = 0,
}) {
  const list = photos.length ? photos : [null];
  const count = list.length;
  const [index, setIndex] = useState(0);
  const touchX = useRef(null);

  const go = useCallback(
    (next) => {
      if (count < 2) return;
      setIndex((current) => (current + next + count) % count);
    },
    [count]
  );

  const safeIndex = Math.min(index, count - 1);

  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
      }}
      onTouchStart={(event) => {
        touchX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const start = touchX.current;
        touchX.current = null;
        if (start == null || count < 2) return;
        const dx = (event.changedTouches[0]?.clientX ?? start) - start;
        if (dx > 40) go(-1);
        if (dx < -40) go(1);
      }}
    >
      <Box
        sx={{
          display: "flex",
          height: "100%",
          width: `${count * 100}%`,
          transform: `translateX(-${(safeIndex * 100) / count}%)`,
          transition: "transform 0.28s ease",
        }}
      >
        {list.map((id, i) => (
          <Box
            key={`${id || "empty"}-${i}`}
            sx={{
              position: "relative",
              width: `${100 / count}%`,
              height: "100%",
              flexShrink: 0,
            }}
          >
            <CarPhoto
              photoUrl={id}
              alt={alt}
              priority={priority && i === 0}
              sizes={sizes}
              iconSize={iconSize}
              contentPaddingBottom={contentPaddingBottom}
            />
          </Box>
        ))}
      </Box>

      {count > 1 ? (
        <>
          <IconButton
            aria-label="Previous photo"
            size="small"
            onClick={(event) => {
              event.stopPropagation();
              go(-1);
            }}
            sx={navBtnSx("left")}
          >
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
          <IconButton
            aria-label="Next photo"
            size="small"
            onClick={(event) => {
              event.stopPropagation();
              go(1);
            }}
            sx={navBtnSx("right")}
          >
            <ChevronRightIcon fontSize="small" />
          </IconButton>
          <Box
            sx={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 8,
              display: "flex",
              justifyContent: "center",
              gap: 0.6,
              pointerEvents: "none",
              zIndex: 2,
            }}
          >
            {list.map((_, i) => (
              <Box
                key={i}
                sx={{
                  width: i === safeIndex ? 8 : 6,
                  height: 6,
                  borderRadius: 99,
                  bgcolor: i === safeIndex ? "primary.main" : "common.white",
                  boxShadow: "0 0 0 1px rgba(0,0,0,0.25)",
                  opacity: i === safeIndex ? 1 : 0.8,
                }}
              />
            ))}
          </Box>
        </>
      ) : null}
    </Box>
  );
}

function navBtnSx(side) {
  return {
    position: "absolute",
    top: "50%",
    [side]: 6,
    transform: "translateY(-50%)",
    zIndex: 2,
    bgcolor: "rgba(255,255,255,0.88)",
    boxShadow: "0 1px 6px rgba(0,0,0,0.18)",
    "&:hover": { bgcolor: "rgba(255,255,255,1)" },
  };
}
