"use client";

import { Box, Typography } from "@mui/material";

/** Readable Latin copy — catalog Nunito tracking otherwise smashes words. */
export const adminReadableTextSx = {
  letterSpacing: "0.01em",
  wordSpacing: "0.16em",
  overflowWrap: "break-word",
  wordBreak: "normal",
};

export const adminCardSx = {
  p: { xs: 2.5, sm: 3 },
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 2,
  bgcolor: "#fff",
  maxWidth: "100%",
  boxSizing: "border-box",
  ...adminReadableTextSx,
};

export const adminFieldSx = {
  width: "100%",
  minWidth: 0,
  "& .MuiInputLabel-root": {
    whiteSpace: "normal",
    overflow: "visible",
    maxWidth: "none",
    lineHeight: 1.35,
    ...adminReadableTextSx,
  },
  "& .MuiFormHelperText-root": {
    whiteSpace: "normal",
    mx: 0,
    mt: 0.75,
    lineHeight: 1.45,
    ...adminReadableTextSx,
  },
  "& .MuiInputBase-input": {
    ...adminReadableTextSx,
  },
};

export default function AdminSettingsSection({
  title,
  description,
  children,
  sx,
}) {
  return (
    <Box sx={{ ...sx }}>
      {title ? (
        <Typography
          variant="subtitle1"
          fontWeight={700}
          sx={{
            mb: description ? 0.5 : 1.5,
            lineHeight: 1.35,
            ...adminReadableTextSx,
          }}
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
            lineHeight: 1.5,
            ...adminReadableTextSx,
          }}
        >
          {description}
        </Typography>
      ) : null}
      {children}
    </Box>
  );
}
