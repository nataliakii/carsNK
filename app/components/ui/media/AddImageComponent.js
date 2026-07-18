import React from "react";
import { TextField, InputAdornment, Box } from "@mui/material";
import { useTranslation } from "react-i18next";

const CarImageUpload = ({
  photoUrl,
  handleChange,
  handleImageChange,
  imagePreview,
}) => {
  const { t } = useTranslation(); // ✅ Вызов внутри компонента

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <TextField
        fullWidth
        label={t("carPark.addPhoto")} // ✅ Использование перевода
        name="photoUrl"
        value={photoUrl}
        onChange={handleChange}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Box
                component="img"
                src={imagePreview || "/images/NO_PHOTO_h2klff.jpg"}
                alt="Uploaded Preview"
                sx={{
                  width: 34,
                  height: 34,
                  objectFit: "cover",
                }}
              />
            </InputAdornment>
          ),
        }}
      />

      <input
        type="file"
        accept="image/*"
        onChange={handleImageChange}
        style={{ marginTop: -11, marginBottom: -1 }}
      />
    </Box>
  );
};

export default CarImageUpload;
