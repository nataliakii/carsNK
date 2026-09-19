import { Box, Typography, Button } from "@mui/material";
import Link from "next/link";
import { BRAND } from "@config/brand";

export default function TransferPayCancelPage() {
  const brand = BRAND?.name || "Rovaro";

  return (
    <Box
      sx={{
        minHeight: "70vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        px: 3,
        textAlign: "center",
      }}
    >
      <Typography variant="h4" component="h1" fontWeight={700}>
        Payment cancelled
      </Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 480 }}>
        No charge was made. You can pay later from the link in your email, or
        contact {brand} support.
      </Typography>
      <Button component={Link} href="/" variant="contained" sx={{ mt: 1 }}>
        Back to home
      </Button>
    </Box>
  );
}
