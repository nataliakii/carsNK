"use client";

import { useEffect, useRef } from "react";
import { Box, Button, Stack } from "@mui/material";

import { markdownToHtml, sectionsToPlain } from "@/domain/legal/documentMarkup";

function command(name, value) {
  document.execCommand(name, false, value);
}

/**
 * Content-editable legal editor. The saved value is markdown sections, not raw HTML.
 * The style toolbar stays pinned above the scrolling document body.
 */
export default function LegalRichTextEditor({
  value,
  onChange,
  constrainHeight = true,
}) {
  const ref = useRef(null);
  const text = sectionsToPlain(value?.sections || []);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (document.activeElement === node) return;
    node.innerHTML = markdownToHtml(text);
  }, [text]);

  function emit() {
    const html = ref.current?.innerHTML || "";
    onChange?.(html);
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: constrainHeight ? 500 : 240,
        maxHeight: constrainHeight ? "70vh" : "none",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        overflow: "hidden",
        bgcolor: "background.paper",
      }}
    >
      <Stack
        direction="row"
        spacing={0.5}
        useFlexGap
        flexWrap="wrap"
        sx={{
          flexShrink: 0,
          position: "sticky",
          top: 0,
          zIndex: 2,
          gap: 0.5,
          px: 1,
          py: 0.75,
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "grey.50",
          boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
        }}
      >
        <Button size="small" onClick={() => command("bold")}>
          Bold
        </Button>
        <Button size="small" onClick={() => command("italic")}>
          Italic
        </Button>
        <Button size="small" onClick={() => command("insertUnorderedList")}>
          Bullets
        </Button>
        <Button size="small" onClick={() => command("insertOrderedList")}>
          Numbered
        </Button>
        <Button size="small" onClick={() => command("formatBlock", "H2")}>
          Heading
        </Button>
        <Button
          size="small"
          onClick={() => {
            const url = window.prompt("Link URL (https://)");
            if (url && /^https?:\/\//i.test(url)) command("createLink", url);
          }}
        >
          Link
        </Button>
        <Button
          size="small"
          onClick={() =>
            command(
              "insertHTML",
              "<table><tr><th>Column</th><th>Column</th></tr><tr><td> </td><td> </td></tr></table>"
            )
          }
        >
          Table
        </Button>
        <Button size="small" onClick={() => command("undo")}>
          Undo
        </Button>
        <Button size="small" onClick={() => command("redo")}>
          Redo
        </Button>
      </Stack>
      <Box
        ref={ref}
        contentEditable
        role="textbox"
        aria-label="Legal document editor"
        onInput={emit}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          p: 1.5,
          fontSize: { xs: 15, md: 17 },
          lineHeight: 1.6,
          "& table": { borderCollapse: "collapse", width: "100%" },
          "& td, & th": { border: "1px solid #cfd8dc", p: 0.5 },
        }}
      />
    </Box>
  );
}
