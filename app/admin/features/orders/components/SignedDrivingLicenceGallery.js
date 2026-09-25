"use client";

import { useEffect, useState } from "react";
import { Typography } from "@mui/material";

import DrivingLicenceImageGallery from "@/app/components/ui/inputs/DrivingLicenceImageGallery";
import { loadSignedDrivingLicence } from "@/app/admin/features/orders/actions/drivingLicenceDocuments";

export default function SignedDrivingLicenceGallery({ orderId, label }) {
  const [urls, setUrls] = useState([]);

  useEffect(() => {
    let cancelled = false;
    loadSignedDrivingLicence(orderId).then((next) => {
      if (!cancelled) setUrls(next);
    });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (!urls.length) return null;

  return (
    <>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
        {label}
      </Typography>
      <DrivingLicenceImageGallery showPreviewHint={false} urls={urls} />
    </>
  );
}
