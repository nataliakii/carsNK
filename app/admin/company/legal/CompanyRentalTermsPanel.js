"use client";

import { useState } from "react";
import { Alert, Box, Button, Stack, TextField, Typography } from "@mui/material";

import LegalRichTextEditor from "@/app/admin/legal/LegalRichTextEditor";
import { htmlToSections, sectionsToPlain } from "@/domain/legal/documentMarkup";

/**
 * Optional company rental terms. Not the superadmin legal workspace.
 */
export default function CompanyRentalTermsPanel() {
  const [title, setTitle] = useState("Rental Terms");
  const [language, setLanguage] = useState("en");
  const [html, setHtml] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function send(action, sourceEn) {
    setError("");
    const res = await fetch("/api/partner/legal/customer-rules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        sourceEn,
        title,
        originalLanguage: language,
        format: "editor",
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.message || "Could not save");
    setMessage(
      action === "publish"
        ? "Published for future bookings. Earlier bookings keep their accepted version."
        : action === "remove"
          ? "Future bookings use Rovaro standard rental terms."
          : "Draft saved. Customers still see the published version, or Rovaro standard terms."
    );
  }

  function text() {
    const content = htmlToSections(html, title);
    return sectionsToPlain(content.sections);
  }

  return (
    <Box data-testid="company-rental-terms" sx={{ width: "100%", pb: 1 }}>
      <Typography variant="h6" sx={{ fontWeight: 800 }}>Add your own rental terms</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Upload your own rental conditions, or continue using Rovaro standard rental terms.
      </Typography>
      {error ? <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert> : null}
      {message ? <Alert severity="success" sx={{ mb: 1 }}>{message}</Alert> : null}
      <Stack spacing={1.5}>
        <TextField
          size="small"
          fullWidth
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <TextField
          size="small"
          fullWidth
          label="Source language"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        />
        <LegalRichTextEditor onChange={setHtml} constrainHeight={false} />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button onClick={() => send("draft", text()).catch((err) => setError(err.message))}>Save draft</Button>
          <Button variant="contained" onClick={() => send("publish", text()).catch((err) => setError(err.message))}>Publish</Button>
          <Button color="inherit" onClick={() => send("remove", "").catch((err) => setError(err.message))}>
            Use Rovaro standard rental terms
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
