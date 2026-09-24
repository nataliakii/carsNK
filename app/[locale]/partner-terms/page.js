import { notFound } from "next/navigation";

import PublicLegalPageLayout from "@app/(legal)/_components/PublicLegalPageLayout";
import {
  isRoutableLocale,
  normalizeRoutableLocale,
} from "@domain/locationSeo/locationSeoService";
import { absoluteUrl } from "@config/domain";

export const dynamic = "force-dynamic";

const LINKS = [
  { href: "partner-agreement", label: "Partner Agreement" },
  { href: "partner-operating-rules", label: "Partner Operating Rules" },
  { href: "data-protection-schedule", label: "Data Protection Schedule" },
];

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const normalized = normalizeRoutableLocale(locale);
  return {
    title: "Partner terms",
    description:
      "Overview of the Partner Agreement, Partner Operating Rules and Data Protection Schedule.",
    alternates: { canonical: absoluteUrl(`/${normalized}/partner-terms`) },
    robots: { index: true, follow: true },
  };
}

export default async function PartnerTermsOverviewPage({ params }) {
  const { locale } = await params;
  if (!isRoutableLocale(locale)) notFound();
  const normalized = normalizeRoutableLocale(locale);

  return (
    <PublicLegalPageLayout locale={normalized}>
      <article data-testid="partner-terms-overview">
        <h1 style={{ textAlign: "center", marginTop: 0, fontSize: 28, fontWeight: 600 }}>
          Partner terms
        </h1>
        <p style={{ lineHeight: 1.7, color: "#37474f" }}>
          Companies that supply vehicles through Rovaro accept three separate
          documents together: the Partner Agreement, Partner Operating Rules and
          Data Protection Schedule. This page is an overview only and is not an
          additional agreement.
        </p>
        <ul style={{ lineHeight: 1.9, paddingLeft: 20 }}>
          {LINKS.map((link) => (
            <li key={link.href}>
              <a href={`/${normalized}/${link.href}`} style={{ color: "#E9004F" }}>
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </article>
    </PublicLegalPageLayout>
  );
}
