"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Box, CircularProgress, Typography } from "@mui/material";

/**
 * Superadmin-issued 7-day company login:
 * /access/[token]/admin
 */
export default function AccessAdminLoginPage() {
  const params = useParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const raw = decodeURIComponent(String(params?.token || "").trim());
    if (!raw) {
      setError("Missing login link");
      return;
    }
    let cancelled = false;
    (async () => {
      const result = await signIn("credentials", {
        loginToken: raw,
        email: "",
        password: "",
        redirect: false,
      });
      if (cancelled) return;
      if (result?.ok) {
        window.location.href = "/admin";
        return;
      }
      setError(
        "This login link is invalid, expired, or has been revoked. Ask Rovaro for a new one."
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        px: 2,
      }}
    >
      {error ? (
        <Typography color="error" role="alert" textAlign="center">
          {error}
        </Typography>
      ) : (
        <>
          <CircularProgress />
          <Typography color="text.secondary">Signing you in…</Typography>
        </>
      )}
    </Box>
  );
}
