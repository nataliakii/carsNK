# Canonical Partner Legal Package

The binding Rovaro partner package is exactly these three published source documents, in this order:

1. `PARTNER_AGREEMENT`
2. `PARTNER_OPERATING_RULES`
3. `DATA_PROTECTION_SCHEDULE`

Each type resolves independently to its latest currently published authoritative-language version. Their numeric versions do not need to match. A material publication of one document forms a new package from that version plus the still-current published versions of the other two. Drafts and archived versions are never part of the package.

## Identity and presentation

Legal package identity is independent of UI language. The ordered manifest contains only type, binding document ID, version, and content checksum. One deterministic SHA-256 checksum of this manifest is shared by acceptance, company status, navbar task calculation, operating gates, and review views. Labels, rendered text, locale, publication dates, database ordering, and drafts do not enter the package checksum.

For presentation, resolve a published requested-language translation when available. Otherwise show the published authoritative source language and label that language. Never turn a missing optional translation into a missing-package state.

## State machine

The shared resolver `resolvePartnerLegalState` returns exactly one state:

- `NOT_PUBLISHED`: one or more required source document types have no current published version; badge count is zero and report missing types.
- `ACCEPTANCE_REQUIRED`: a complete published package exists and no active company acceptance exists; badge count is one.
- `REACCEPTANCE_REQUIRED`: a complete package exists, an active acceptance differs on one or more documents, and at least one differing publication is material; badge count is one.
- `ACCEPTED_CURRENT`: every current binding document matches the latest active acceptance, or all later differing publications were editorial; badge count is zero.

The legal inbox task and Company Legal page use the same server-resolved package/state snapshot. One material package change creates one company task regardless of how many documents changed. Editorial publications remain in history and do not request acceptance. Existing publication records are never silently reclassified.

## Acceptance

Only a real company admin may accept; a Superadmin, including one in company-view mode, cannot sign for the company. Acceptance inserts an immutable record (never updates an older acceptance) with company and signer identity, role, time, IP/user agent where available, package checksum, exact fixed-order manifest, and each binding document's version/checksum/ID plus the presentation language/document snapshot shown to the signer. After acceptance, resolve the shared state again and refresh the navbar task.
