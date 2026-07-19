import React from "react";
import { Box, Button, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";

/**
 * Car photo picker — large preview frame + file button (Add / Edit car modals).
 */
const CarImageUpload = ({
  photoUrl,
  handleChange,
  handleImageChange,
  imagePreview,
}) => {
  const { t } = useTranslation();
  const previewSrc = imagePreview || "/images/carsnk-NO_PHOTO.png";
  const inputId = "car-photo-upload-input";

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
        {t("carPark.addPhoto")}
      </Typography>

      <Box
        sx={{
          position: "relative",
          width: "100%",
          aspectRatio: "3 / 2",
          borderRadius: 2,
          overflow: "hidden",
          bgcolor: "grey.100",
          border: "1px solid",
          borderColor: "divider",
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.04)",
        }}
      >
        <Box
          component="img"
          src={previewSrc}
          alt="Car preview"
          sx={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      </Box>

      <Button
        component="label"
        htmlFor={inputId}
        variant="outlined"
        startIcon={<PhotoCameraOutlinedIcon />}
        sx={{ alignSelf: "flex-start", textTransform: "none" }}
      >
        {t("carPark.carNewPhoto") || "Choose photo"}
        <input
          id={inputId}
          type="file"
          accept="image/*"
          hidden
          onChange={handleImageChange}
        />
      </Button>

      {/* Keep photoUrl in form state if parent still uses handleChange */}
      {typeof handleChange === "function" && (
        <input type="hidden" name="photoUrl" value={photoUrl || ""} readOnly />
      )}
    </Box>
  );
};

export default CarImageUpload;
