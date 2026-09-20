"use client";

import { Box, Typography } from "@mui/material";

export const adminCardSx = {
  p: { xs: 2, sm: 2.5 },
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 2,
  bgcolor: "background.paper",
  maxWidth: "100%",
  boxSizing: "border-box",
  letterSpacing: "normal",
  wordSpacing: "normal",
};

export const adminFieldSx = {
  width: "100%",
  minWidth: 0,
  "& .MuiInputLabel-root": {
    whiteSpace: "normal",
    overflow: "visible",
    maxWidth: "none",
    lineHeight: 1.3,
  },
  "& .MuiFormHelperText-root": {
    whiteSpace: "normal",
    mx: 0,
    mt: 0.75,
    lineHeight: 1.4,
  },
};

export default function AdminSettingsSection({
  title,
  description,
  children,
  sx,
}) {
  return (
    <Box
      sx={{
        p: { xs: 1.75, sm: 2 },
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: "action.hover",
        ...sx,
      }}
    >
      {title ? (
        <Typography
          variant="subtitle1"
          fontWeight={700}
          sx={{ mb: description ? 0.5 : 1.5, letterSpacing: "normal", lineHeight: 1.35 }}
        >
          {title}
        </Typography>
      ) : null}
      {description ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mb: 1.75,
            whiteSpace: "normal",
            letterSpacing: "normal",
            wordSpacing: "normal",
            lineHeight: 1.5,
          }}
        >
          {description}
        </Typography>
      ) : null}
      {children}
    </Box>
  );
}
