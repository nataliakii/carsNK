"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { COMPANY_AGREEMENT_PATH } from "@/domain/legal/companyLegalPage";

/** Legacy agreement screen. Company acceptance lives on Company details. */
export default function PartnerAgreementSection() {
  const router = useRouter();

  useEffect(() => {
    router.replace(COMPANY_AGREEMENT_PATH);
  }, [router]);

  return null;
}
