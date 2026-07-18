"use client";

import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  IconButton,
  Typography,
  CircularProgress,
  useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

/**
 * Reusable Dialog Layout component
 * 
 * Unified close behavior contract:
 * - By default, modals cannot be closed by backdrop click or Escape key
 *   (prevents accidental closure of transactional/destructive dialogs)
 * - Close button (X) always closes the modal
 * - Enable closeOnBackdropClick/closeOnEscape only for informational/confirmation dialogs
 * 
 * @param {boolean} open - is dialog open
 * @param {function} onClose - close handler
 * @param {string} title - dialog title (optional)
 * @param {string} maxWidth - MUI maxWidth: "xs" | "sm" | "md" | "lg" | "xl"
 * @param {boolean} fullWidth - use full width
 * @param {boolean} showCloseButton - show close button in title (default: true)
 * @param {boolean} closeOnBackdropClick - allow closing by clicking outside (default: false)
 * @param {boolean} closeOnEscape - allow closing by Escape key (default: false)
 * @param {boolean} loading - show loading state
 * @param {ReactNode} stickyHeader - content for sticky header (optional)
 * @param {ReactNode} actions - content for DialogActions (optional)
 * @param {object} contentSx - additional styles for DialogContent
 * @param {object} sx - additional styles for Dialog
 * @param {ReactNode} children - content
 */
const DialogLayout = ({
  open,
  onClose,
  title,
  maxWidth = "sm",
  fullWidth = true,
  showCloseButton = true,
  closeOnBackdropClick = false,
  closeOnEscape = false,
  loading = false,
  stickyHeader,
  actions,
  contentSx,
  sx,
  children,
  ...props
}) => {
  const theme = useTheme();

  // Unified close handler that respects the close behavior contract
  // MUI Dialog calls onClose(event, reason) where reason can be:
  // - "backdropClick" - user clicked outside
  // - "escapeKeyDown" - user pressed Escape
  // - other values for programmatic close (X button, etc.)
  const handleClose = (event, reason) => {
    // X button and programmatic closes always work
    if (reason === "backdropClick" && !closeOnBackdropClick) {
      return; // Ignore backdrop clicks when disabled
    }
    if (reason === "escapeKeyDown" && !closeOnEscape) {
      return; // Ignore Escape key when disabled
    }
    // All other reasons (including undefined for X button) are allowed
    onClose(event, reason);
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth={fullWidth}
      maxWidth={maxWidth}
      disableEscapeKeyDown={!closeOnEscape}
      sx={{
        "& .MuiDialog-paper": {
          borderRadius: 2,
        },
        ...sx,
      }}
      {...props}
    >
      {loading ? (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 2,
            p: 8,
          }}
        >
          <CircularProgress sx={{ color: "primary.main" }} />
          <CircularProgress sx={{ color: "secondary.main" }} />
          <CircularProgress sx={{ color: "triadic.green" }} />
        </Box>
      ) : (
        <>
          {/* Title with optional close button */}
          {(title || showCloseButton) && (
            <DialogTitle
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                py: 1.5,
                px: 3,
                borderBottom: "1px solid",
                borderColor: "divider",
              }}
            >
              {title && (
                <Typography
                  variant="h6"
                  component="span"
                  sx={{
                    fontWeight: 600,
                    textAlign: "center",
                    flex: 1,
                  }}
                >
                  {title}
                </Typography>
              )}
              {showCloseButton && (
                <IconButton
                  onClick={(e) => handleClose(e, "buttonClick")}
                  size="small"
                  sx={{
                    position: "absolute",
                    right: 8,
                    top: 8,
                    color: "text.secondary",
                    "&:hover": { color: "primary.main" },
                  }}
                  aria-label="close"
                >
                  <CloseIcon />
                </IconButton>
              )}
            </DialogTitle>
          )}

          {/* Optional sticky header below title */}
          {stickyHeader && (
            <Box
              sx={{
                position: "sticky",
                top: 0,
                zIndex: 10,
                backgroundColor: "background.paper",
                borderBottom: "1px solid",
                borderColor: "divider",
                py: 1.5,
                px: 3,
                textAlign: "center",
              }}
            >
              {stickyHeader}
            </Box>
          )}

          {/* Main content */}
          <DialogContent
            sx={{
              px: 3,
              py: 2,
              ...contentSx,
            }}
          >
            {children}
          </DialogContent>

          {/* Optional actions */}
          {actions && (
            <DialogActions
              sx={{
                px: 3,
                py: 2,
                borderTop: "1px solid",
                borderColor: "divider",
                justifyContent: "center",
                gap: 2,
              }}
            >
              {actions}
            </DialogActions>
          )}
        </>
      )}
    </Dialog>
  );
};

export default DialogLayout;

