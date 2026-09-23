"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { COMPANY_TERMS_PATH } from "@/domain/legal/companyLegalPage";

/** Legacy agreement screen. Company acceptance lives on the Terms tab. */
export default function PartnerAgreementSection() {
  const router = useRouter();

  useEffect(() => {
    router.replace(COMPANY_TERMS_PATH);
  }, [router]);

  return null;
}
