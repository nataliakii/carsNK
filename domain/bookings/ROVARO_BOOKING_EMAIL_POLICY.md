# Rovaro booking email policy

Canonical rule for every email a booking can produce.
Machine-readable form: [`bookingEmailPolicy.js`](./bookingEmailPolicy.js).

Related canon that this policy **reuses and never duplicates**:

| Concern | Module |
| --- | --- |
| Stored statuses | `domain/booking/bookingStatus.js` |
| Product stages | `domain/admin/rovaroContractorAdmin.js`, `domain/booking/rovaroMarketplaceWorkflow.js` |
| Supplier actions | `domain/orders/supplierResponse.js`, `app/admin/features/orders/components/SupplierResponseCell.js` |
| Replacement validation | `domain/booking/equivalentReplacement.js`, `domain/booking/alternativeVehicle.js` |
| Platform notification matrix | `domain/mail/` |
| Payment truth | `domain/orders/rentalStripeCheckout.js` |
| Money snapshot | `domain/orders/bookingFinancialSnapshot.js`, `domain/orders/marketplaceBookingFee.js` |
| Email brand tokens | `app/ui/email/theme/nataliCarsEmailTheme.js` |

Two phrases are banned everywhere: **"Confirmed by Rovaro"** and any implication
that Rovaro confirms a booking for either party. Supplier confirmation means
vehicle availability. Customer confirmation means a verified Booking Fee payment.

### Scope

The policy governs `BOOKING_SOURCE.PLATFORM` bookings — the Rovaro marketplace.
`INTERNAL` calendar bookings never produce a marketplace email: the resolver
rejects them with `internal_booking`. The legacy Greece ops mail (offline
orders, official confirmation PDF for a non-platform booking) is not a
marketplace booking and is not routed through the six-event flow; where those
paths touch a platform booking they still pass the gate.

---

## The hard rule

A standard successful booking produces **exactly six communication events**:

1. **Customer request received** — automatic.
2. **Supplier new request** — automatic.
3. **Customer payment-link email after supplier confirmation** — automatic.
4. **Customer reply to Rovaro rejecting a replacement** — inbound only. The
   platform never generates it.
5. **Customer payment confirmation** — automatic, on the verified webhook.
6. **Supplier payment confirmation** — automatic, on the verified webhook.

After payment confirmation there are **no further automatic lifecycle emails**.

Every send site calls `resolveBookingEmail({ event, order, audience, context })`
and sends only when `allowed` is true. Anything that bypasses the resolver is a
bug, not a feature.

---

## 1. Customer submits a request

Stage `AWAITING_SUPPLIER_CONFIRMATION` (stored `PENDING_SUPPLIER_CONFIRMATION`).

### `CUSTOMER_REQUEST_RECEIVED`

Subject: **We received your booking request**

> Thank you — we have received your request for the {vehicle}.
> The booking is not confirmed yet. We are now asking the rental company to confirm that the vehicle is available.
> As soon as the company responds, we will email you the next step.

Shows only: vehicle, short date range, public booking reference.

Never: payment links, admin or login links, Stripe data, internal enums, Mongo
ids, long timestamp order numbers, refund or legal explanations.

### `SUPPLIER_NEW_REQUEST`

Subject: **New booking request — {vehicle}, {shortDateRange}**

Shows: vehicle, pickup and return dates and times, pickup and return location
names, total rental price, public booking reference.

One CTA, **Review booking request**, to `/admin/orders?orderId={internalOrderId}`,
which opens the live order modal.

Never: `/api/booking/partner-confirm`, JWT links, confirm or decline controls in
the email, a second booking link, long visible URLs, customer identity.

---

## 2. Supplier decision

The decision is taken in the live order modal, never by email. Exactly four
actions exist:

| Action | Result |
| --- | --- |
| Confirm requested vehicle | `AWAITING_CUSTOMER_PAYMENT`, create Stripe Checkout, send `CUSTOMER_PAYMENT_REQUIRED` |
| Confirm with equivalent replacement | `AWAITING_CUSTOMER_PAYMENT_WITH_REPLACEMENT`, send `CUSTOMER_REPLACEMENT_PAYMENT_REQUIRED` |
| Decline request | `SUPPLIER_DECLINED`, no Stripe Checkout, manual Rovaro task, **no automatic customer email** |
| Ask Rovaro a question | stays at `AWAITING_SUPPLIER_CONFIRMATION`, no customer email |

There is never an independent "confirmed by email" state. Every transition
validates the current stored status atomically through
`assertSupplierDecisionIsCurrent`; a stale browser tab or an old email cannot
overwrite a newer decision.

### Equivalent replacement

The supplier already knows the requested vehicle will not be supplied.
`evaluateEquivalentReplacement` enforces:

- same or higher class;
- identical transmission;
- seats greater than or equal to the original;
- adequate luggage where known;
- same or lower total price;
- unchanged dates;
- unchanged pickup and return conditions;
- no additional charge;
- a supplier comment;
- a specific model, or an "or equivalent" class guarantee.

`buildReplacementProposalSnapshot` persists an immutable proposal snapshot with
a SHA-256 checksum. Payment after disclosure records acceptance of that exact
version and checksum.

### Stage mapping

`AWAITING_CUSTOMER_PAYMENT_WITH_REPLACEMENT` is a **product** name. It is stored
as `BOOKING_STATUS.ALTERNATIVE_PROPOSED`, the enum that already means "a
replacement is pending a customer decision". There is no third vocabulary.

---

## 3. Customer payment email — original vehicle

`CUSTOMER_PAYMENT_REQUIRED`

Subject: **Your vehicle is available — confirm your booking**

Shows: confirmed vehicle, dates, total rental price, amount payable now, amount
payable directly to the supplier.

CTA: **Pay {bookingPayment} and confirm**.

Never: the fee percentage, the word "non-refundable" in the Stripe product
title, technical status, Stripe identifiers, admin links.

---

## 4. Customer payment email — replacement

`CUSTOMER_REPLACEMENT_PAYMENT_REQUIRED`

Subject: **The rental company has offered a replacement vehicle** — the public
booking reference is included in the subject.

Prominently states that the originally requested vehicle is unavailable, then
the replacement description, class guarantee, transmission, seats, the same
total price, and the supplier's comment.

CTA: **Accept replacement and pay {bookingPayment}**.

> If you do not accept, simply reply to this email and tell us what you would
> prefer. You will not be charged.

`Reply-To: bookings@rovaro.es` (override with `ROVARO_BOOKINGS_REPLY_TO`).

---

## 5. Customer rejects by email

There is no account and no other form. The reply goes to Rovaro and the
workflow becomes manual: stage `CUSTOMER_REPLACEMENT_OBJECTION`.

- Do not charge.
- Do not auto-expose a new payment link.
- A superadmin records the objection (`recordReplacementObjection`), may edit or
  create a new proposal, and may resend the customer payment email as a manual
  action (`context.manualTrigger`).
- After Rovaro records the objection, the supplier may receive **one** concise
  exception notice, `SUPPLIER_REPLACEMENT_OBJECTION_NOTICE`:

  > The customer did not accept the proposed replacement. Rovaro is reviewing
  > the request and will contact you if another option is needed.

- The supplier's email address is never exposed to the customer before payment.
- Raw customer emails containing personal information are never auto-forwarded.

---

## 6. Stripe presentation

- Product title: `10% booking payment — {vehicleOrAcceptedReplacement}`
- Description: `Booking {publicReference} · {shortDateRange}`
- "Non-refundable" never appears as the title or the description. The accepted
  Booking Terms remain the legal source for cancellation and refunds.
- Amounts come from the canonical stored financial snapshot
  (`resolveBookingFinancialSnapshot`), never from a template constant.

Configured fee is **10%** (`DEFAULT_MARKETPLACE_BOOKING_FEE_BPS = 1000`).
€165 → pay now €16.50, pay the supplier €148.50. The old 11% calculation is
wrong and must not reappear.

---

## 7. Verified Stripe payment

Only the verified, idempotent webhook sets `BOOKING_CONFIRMED`. It then sends
exactly two marketplace emails.

### `CUSTOMER_BOOKING_CONFIRMED`

Subject: **Booking confirmed — {vehicle}, {shortDateRange}**

Shows: a friendly confirmation, the vehicle or accepted replacement, dates,
pickup and return, total, paid now, payable to the supplier, supplier name and
contacts, the public booking reference, and one **View booking details** button
to the secure public read-only booking page.

Never: admin links, Mongo ids, Stripe ids, internal enums.

### `SUPPLIER_BOOKING_PAID`

Subject: **Booking confirmed — customer payment received**

Shows: vehicle, dates, total, the amount the supplier collects, confirmation
that the customer paid, notice that customer contacts and driving documents are
now available, and one **Open confirmed booking** button to the authenticated
live order modal.

There is no separate "contacts revealed" email.

---

## 8. Silence after confirmation

After those two emails the platform sends nothing automatically. Specifically
forbidden: status-change mail, contact-reveal mail, rental reminders, start
reminders, completion mail, closure mail, internal enum notifications,
payment-operation mail to customers, and **any** email for `INTERNAL` bookings.

Later contact happens only for disputes, security, support, or a message a
human at Rovaro writes.

`RETIRED_AUTOMATIC_MAIL_TYPES` lists the mail types that must never fire
automatically again. `MANUAL_ONLY_MAIL_TYPES` lists sends that remain
legitimate but require `context.manualTrigger`.

---

## 9. Superadmin observability

A customer-facing technical template is never sent to a superadmin, and a
superadmin template is never sent to a customer or supplier; the resolver
rejects an audience mismatch.

These operational events are visible in the superadmin dashboard and audit log
rather than by email: request created, supplier response, payment link created,
payment completed, email delivery status, replacement objection, dispute or
problem. Logging replaces lifecycle email.

`SUPERADMIN_BOOKING_PAYMENT_RECEIVED` stays isolated and configurable
(`context.superadminEmailEnabled === false` switches it off). It is never
required for the customer flow to complete.

---

## 10. Idempotency and failure

- Deterministic notification key: `{orderId}:{event}:{audience}:{proposalVersion?}`
  via `bookingEmailNotificationKey`. Retries and duplicated webhooks collide on
  the same key.
- Email failure must never roll back order creation, a supplier decision,
  Stripe Checkout creation, a successful payment, or booking confirmation.
- A delivery failure is recorded and a manual superadmin resend is exposed.
- A resend renders the current valid event snapshot and creates no new state
  transition (`planBookingEmailResend`).

---

## 11. Test checklist — to be written later

The proving suite is deliberately **not** written yet. When it is, it must cover:

- [ ] Creating a request produces exactly two emails.
- [ ] The supplier email has one admin CTA and no action token.
- [ ] A stale supplier action cannot overwrite the current state.
- [ ] A replacement produces the replacement-specific email, not the ordinary one.
- [ ] A replacement with a different transmission is rejected.
- [ ] The replacement email sets `Reply-To` and carries the refusal instructions.
- [ ] Rejecting a replacement charges nothing.
- [ ] A verified payment creates exactly two emails.
- [ ] No customer email contains an admin link.
- [ ] A duplicate webhook does not duplicate emails.
- [ ] No automatic email is sent after payment.
- [ ] `INTERNAL` bookings send nothing.
- [ ] Customer, supplier and superadmin templates cannot be mixed.
- [ ] €165 at 10% is €16.50 now and €148.50 to the supplier.
