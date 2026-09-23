"use client";

import { useRef, useState } from "react";
import { Box, Button, IconButton, Stack, Typography } from "@mui/material";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import CloseIcon from "@mui/icons-material/Close";
import { CldImage } from "next-cloudinary";
import { useTranslation } from "react-i18next";
import { CLOUDINARY_PLACEHOLDER_PUBLIC_ID } from "@config/cloudinary";
import { listCarPhotos, photosForSave, MAX_CAR_PHOTOS } from "@/domain/cars/carPhotos";

async function uploadOne(file) {
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch("/api/order/update/image", {
    method: "POST",
    body: formData,
  });
  const data = await res.json();
  if (!data.success || !data.data) {
    throw new Error(data.message || "Image upload failed");
  }
  return data.data;
}

/**
 * Superadmin/partner gallery on Edit car: add, remove, set cover.
 */
export default function CarPhotosEditor({ car, onChange, disabled }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const photos = listCarPhotos(car);
  const remaining = Math.max(0, MAX_CAR_PHOTOS - photos.length);

  async function addFiles(fileList) {
    const files = Array.from(fileList || []).slice(0, remaining);
    if (!files.length) return;
    setBusy(true);
    try {
      const ids = [];
      for (const file of files) {
        ids.push(await uploadOne(file));
      }
      onChange(photosForSave([...photos, ...ids]));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 700 }}>
        {t("carPark.addPhotos")}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
        {t("carPark.photosHint", { max: MAX_CAR_PHOTOS })}
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 1 }}>
        {photos.map((id, index) => (
          <Box
            key={`${id}-${index}`}
            sx={{
              position: "relative",
              width: 108,
              height: 80,
              borderRadius: 1,
              overflow: "hidden",
              border: "2px solid",
              borderColor: index === 0 ? "primary.main" : "divider",
            }}
          >
            <CldImage
              src={id || CLOUDINARY_PLACEHOLDER_PUBLIC_ID}
              alt=""
              width="108"
              height="80"
              crop="fill"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            <IconButton
              size="small"
              disabled={disabled || busy}
              onClick={() =>
                onChange(photosForSave(photos.filter((_, i) => i !== index)))
              }
              sx={{
                position: "absolute",
                top: 2,
                right: 2,
                bgcolor: "rgba(255,255,255,0.9)",
                p: 0.25,
              }}
            >
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
            {index === 0 ? (
              <Box
                sx={{
                  position: "absolute",
                  left: 4,
                  bottom: 4,
                  px: 0.5,
                  borderRadius: 0.5,
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  fontSize: "0.62rem",
                  fontWeight: 700,
                }}
              >
                {t("carPark.coverPhoto")}
              </Box>
            ) : (
              <Button
                size="small"
                disabled={disabled || busy}
                onClick={() =>
                  onChange(photosForSave([id, ...photos.filter((p) => p !== id)]))
                }
                sx={{
                  position: "absolute",
                  left: 4,
                  bottom: 4,
                  minWidth: 0,
                  px: 0.5,
                  py: 0,
                  fontSize: "0.58rem",
                  bgcolor: "rgba(255,255,255,0.9)",
                  textTransform: "none",
                }}
              >
                {t("carPark.setCover")}
              </Button>
            )}
          </Box>
        ))}
      </Stack>
      <Button
        variant="outlined"
        size="small"
        disabled={disabled || busy || remaining === 0}
        startIcon={<PhotoCameraOutlinedIcon />}
        onClick={() => inputRef.current?.click()}
        sx={{ textTransform: "none" }}
      >
        {busy ? t("basic.loading") : t("carPark.carNewPhotos")}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        multiple
        onChange={(event) => {
          addFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </Box>
  );
}
