"use client";

import React, { useState, useCallback } from "react";
import {
  Box,
  Dialog,
  DialogContent,
  IconButton,
  Typography,
  Stack,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useTranslation } from "react-i18next";

const THUMB_SIZE = 96;
const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.25;

/**
 * Превью фото прав + полноэкранный просмотр с масштабом.
 *
 * @param {{
 *   urls: string[];
 *   onRemove?: (index: number) => void;
 *   removeDisabled?: boolean;
 *   showPreviewHint?: boolean;
 * }} props
 */
export default function DrivingLicenceImageGallery({
  urls = [],
  onRemove,
  removeDisabled = false,
  showPreviewHint = false,
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoom, setZoom] = useState(ZOOM_MIN);

  const openAt = useCallback((index) => {
    setActiveIndex(index);
    setZoom(ZOOM_MIN);
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setZoom(ZOOM_MIN);
  }, []);

  const canRemove = typeof onRemove === "function" && !removeDisabled;

  if (!urls.length) return null;

  return (
    <>
      {showPreviewHint ? (
        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          sx={{ mb: 0.75 }}
        >
          {t("order.drivingLicencePreviewHint")}
        </Typography>
      ) : null}
      <Stack
        direction="row"
        flexWrap="wrap"
        gap={1.25}
        sx={{ mt: showPreviewHint ? 0.5 : 0 }}
      >
        {urls.map((url, i) => (
          <Box
            key={`${url}-${i}`}
            sx={{
              position: "relative",
              width: THUMB_SIZE,
              flexShrink: 0,
            }}
          >
            <Box
              component="button"
              type="button"
              onClick={() => openAt(i)}
              sx={{
                display: "block",
                p: 0,
                m: 0,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                overflow: "hidden",
                cursor: "pointer",
                bgcolor: "grey.100",
                width: THUMB_SIZE,
                height: THUMB_SIZE,
                "&:hover": { borderColor: "primary.main", opacity: 0.95 },
              }}
              aria-label={`${t("order.drivingLicencePhoto")} ${i + 1} — ${t("order.drivingLicenceOpenPreview")}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                loading="lazy"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                  verticalAlign: "top",
                }}
              />
            </Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: "block",
                mt: 0.25,
                textAlign: "center",
                lineHeight: 1.2,
                maxWidth: THUMB_SIZE,
              }}
            >
              {t("order.drivingLicencePhoto")} {i + 1}
            </Typography>
            {canRemove ? (
              <IconButton
                size="small"
                aria-label={t("order.drivingLicenceRemove")}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(i);
                }}
                sx={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  bgcolor: "background.paper",
                  boxShadow: 1,
                  "&:hover": { bgcolor: "error.lighter" },
                }}
              >
                <DeleteOutlineIcon fontSize="small" color="error" />
              </IconButton>
            ) : null}
          </Box>
        ))}
      </Stack>

      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            m: { xs: 1, sm: 2 },
            maxWidth: "min(96vw, 1200px)",
            bgcolor: "grey.900",
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 1,
            py: 0.5,
            borderBottom: "1px solid",
            borderColor: "divider",
            bgcolor: "grey.900",
          }}
        >
          <Typography variant="body2" sx={{ color: "grey.100", pl: 1 }}>
            {t("order.drivingLicencePhoto")} {activeIndex + 1} / {urls.length}
          </Typography>
          <Stack direction="row" alignItems="center">
            <IconButton
              aria-label={t("order.drivingLicenceZoomOut")}
              onClick={() =>
                setZoom((z) =>
                  Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 100) / 100)
                )
              }
              disabled={zoom <= ZOOM_MIN}
              sx={{ color: "grey.100" }}
            >
              <ZoomOutIcon />
            </IconButton>
            <IconButton
              aria-label={t("order.drivingLicenceZoomIn")}
              onClick={() =>
                setZoom((z) =>
                  Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 100) / 100)
                )
              }
              disabled={zoom >= ZOOM_MAX}
              sx={{ color: "grey.100" }}
            >
              <ZoomInIcon />
            </IconButton>
            <IconButton
              aria-label={t("order.drivingLicenceZoomReset")}
              onClick={() => setZoom(ZOOM_MIN)}
              sx={{ color: "grey.100" }}
            >
              <RestartAltIcon />
            </IconButton>
            <IconButton
              aria-label={t("order.drivingLicenceClosePreview")}
              onClick={handleClose}
              sx={{ color: "grey.100" }}
            >
              <CloseIcon />
            </IconButton>
          </Stack>
        </Box>
        <DialogContent
          sx={{
            p: 2,
            overflow: "auto",
            maxHeight: { xs: "75vh", sm: "82vh" },
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "grey.900",
          }}
        >
          {urls[activeIndex] ? (
            <Box
              sx={{
                transform: `scale(${zoom})`,
                transformOrigin: "center center",
                transition: "transform 0.15s ease-out",
                maxWidth: "100%",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={urls[activeIndex]}
                alt=""
                style={{
                  maxWidth: "100%",
                  width: "auto",
                  height: "auto",
                  display: "block",
                  objectFit: "contain",
                }}
              />
            </Box>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
