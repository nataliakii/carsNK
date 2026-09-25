"use client";

import React from "react";
import { styled } from "@mui/material/styles";
import { Box, ButtonBase, Collapse, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

const SectionRoot = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1),
}));

const SectionHeader = styled(ButtonBase)(({ theme }) => ({
  width: "100%",
  justifyContent: "space-between",
  gap: theme.spacing(1),
  padding: theme.spacing(1, 1.5),
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
  color: theme.palette.text.primary,
  "&:hover": {
    backgroundColor: theme.palette.action.hover,
  },
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  fontWeight: theme.typography.fontWeightBold,
  textAlign: "left",
}));

const ExpandChevron = styled(ExpandMoreIcon, {
  shouldForwardProp: (prop) => prop !== "expanded",
})(({ theme, expanded }) => ({
  color: theme.palette.text.secondary,
  transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
  transition: theme.transitions.create("transform", {
    duration: theme.transitions.duration.shortest,
  }),
}));

/**
 * Секция с заголовком-переключателем и сворачиваемым содержимым.
 * Контролируемая: `open` и `onToggle` принадлежат вызывающему коду.
 */
const CollapsibleSection = ({
  title,
  open,
  onToggle,
  toggleLabel,
  contentId,
  children,
}) => {
  const expanded = Boolean(open);

  return (
    <SectionRoot>
      <SectionHeader
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={contentId}
        aria-label={toggleLabel}
      >
        <SectionTitle variant="subtitle2">{title}</SectionTitle>
        <ExpandChevron fontSize="small" expanded={expanded} />
      </SectionHeader>
      <Collapse in={expanded} id={contentId} unmountOnExit>
        {children}
      </Collapse>
    </SectionRoot>
  );
};

export default CollapsibleSection;
