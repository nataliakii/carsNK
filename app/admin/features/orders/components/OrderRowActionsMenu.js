"use client";

import { useState } from "react";
import { IconButton, Menu, MenuItem, Tooltip } from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { useTranslation } from "react-i18next";

/**
 * Every row-scoped entry point that is not the primary decision.
 *
 * The Orders table used to grow a full-width button for each of them, which is
 * what made one pending row taller than the rest of the table put together.
 * They are the same actions, behind one button that costs a single line.
 *
 * This component decides nothing: the caller passes items it has already gated,
 * so an action the capabilities or the server refuse is simply not in the list.
 *
 * @param {{ items: Array<{ id: string, label: string, onSelect: Function, disabled?: boolean }|null> }} props
 */
export default function OrderRowActionsMenu({ items }) {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState(null);
  const available = (items || []).filter((item) => item && item.onSelect);

  if (available.length === 0) return null;

  const close = () => setAnchorEl(null);

  return (
    <>
      <Tooltip title={t("table.rowActions", { defaultValue: "Row actions" })}>
        <IconButton
          size="small"
          aria-label={t("table.rowActions", { defaultValue: "Row actions" })}
          onClick={(event) => setAnchorEl(event.currentTarget)}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={close}>
        {available.map((item) => (
          <MenuItem
            key={item.id}
            disabled={item.disabled === true}
            onClick={() => {
              close();
              item.onSelect();
            }}
          >
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
