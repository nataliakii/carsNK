/* eslint-disable react/no-array-index-key */
import React from "react";
import {
  List as MuiList,
  ListItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import { styled } from "@mui/system";

const Icon = styled("img")(({ theme }) => ({
  width: "15px",
  bottom: 0,
  p: 0,

  position: "relative",
  "&:hover": {
    animation: "none",
    transform: "rotate(360deg)",
    transition: "transform 0.5s",
  },
}));

function ListSimple({ items = [], icon = null, fontSize = null }) {
  const iconUrl = icon || "./icons/arrow3.png";

  if (!Array.isArray(items)) {
    return null;
  }

  return (
    <MuiList>
      {items.map((item, index) => (
        <ListItem key={index} sx={{ p: 0.5, m: 0.5 }}>
          <ListItemIcon sx={{ pl: 2 }}>
            <Icon src={iconUrl} alt="icon" />
          </ListItemIcon>
          <ListItemText
            primary={item}
            sx={{ fontSize: fontSize || "1rem", color: "text.dark" }}
          />
        </ListItem>
      ))}
    </MuiList>
  );
}

export default ListSimple;

