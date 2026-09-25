"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Alert, Button, Stack, Typography } from "@mui/material";

import { submitCustomerProblemReport } from "./actions";

export default function ReportProblemForm() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setBusy(true);
    setState("");
    const result = await submitCustomerProblemReport(token);
    setState(result.ok ? "saved" : "error");
    setBusy(false);
  }

  return (
    <Stack spacing={2} sx={{ maxWidth: "sm", mx: "auto", py: 6, px: 2 }}>
      <Typography variant="h5">Report a problem</Typography>
      <Typography variant="body1" color="text.secondary">
        This stops automatic completion of the booking. Rovaro will review what you report.
      </Typography>
      {state === "saved" ? (
        <Alert severity="success">The problem has been recorded.</Alert>
      ) : null}
      {state === "error" ? (
        <Alert severity="error">This link could not record a problem.</Alert>
      ) : null}
      <Button
        variant="contained"
        disabled={!token || busy || state === "saved"}
        onClick={onSubmit}
        sx={{ alignSelf: "flex-start", textTransform: "none" }}
      >
        Report a problem
      </Button>
    </Stack>
  );
}
