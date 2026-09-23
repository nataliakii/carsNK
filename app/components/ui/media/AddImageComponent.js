import React from "react";
import { Box, Button, IconButton, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import { MAX_CAR_PHOTOS } from "@/domain/cars/carPhotos";

/**
 * Local-file gallery for Add car. Parent holds File[] + preview URLs.
 */
const CarImageUpload = ({
  photoUrl,
  handleChange,
  handleImageChange,
  imagePreview,
  imagePreviews,
}) => {
  const { t } = useTranslation();
  const previews = Array.isArray(imagePreviews)
    ? imagePreviews.filter(Boolean)
    : imagePreview
      ? [imagePreview]
      : [];
  const inputId = "car-photo-upload-input";
  const remaining = Math.max(0, MAX_CAR_PHOTOS - previews.length);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        width: "100%",
      }}
    >
      <Typography variant="subtitle2" color="text.secondary">
        {t("carPark.addPhotos")}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {t("carPark.photosHint", { max: MAX_CAR_PHOTOS })}
      </Typography>

      {previews.length ? (
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {previews.map((src, index) => (
            <Box
              key={`${src}-${index}`}
              sx={{
                position: "relative",
                width: 96,
                height: 72,
                borderRadius: 1,
                overflow: "hidden",
                border: "1px solid",
                borderColor: index === 0 ? "primary.main" : "divider",
              }}
            >
              <Box
                component="img"
                src={src}
                alt=""
                sx={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
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
              ) : null}
            </Box>
          ))}
        </Stack>
      ) : (
        <Box
          sx={{
            position: "relative",
            width: "100%",
            aspectRatio: "3 / 2",
            borderRadius: 2,
            overflow: "hidden",
            bgcolor: "grey.100",
            border: "1px dashed",
            borderColor: "divider",
          }}
        />
      )}

      <Button
        component="label"
        htmlFor={inputId}
        variant="outlined"
        disabled={remaining === 0}
        startIcon={<PhotoCameraOutlinedIcon />}
        sx={{ alignSelf: "flex-start", textTransform: "none" }}
      >
        {t("carPark.carNewPhotos")}
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          multiple
          onChange={handleImageChange}
        />
      </Button>

      {typeof handleChange === "function" && (
        <input type="hidden" name="photoUrl" value={photoUrl || ""} readOnly />
      )}
    </Box>
  );
};

export default CarImageUpload;
