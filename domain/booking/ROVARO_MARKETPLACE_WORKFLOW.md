# Canonical Rovaro marketplace workflow

**This is the domain rule.** Buttons, stored statuses, emails, inbox bells,
contact/licence access and Stripe must follow this document. Do not add a
parallel “Confirmed” path and do not skip a stage.

Applies only to **client marketplace bookings** (`bookingMode = MARKETPLACE_REQUEST`,
`my_order === true`). Internal company-calendar bookings are out of scope:
no Booking Fee, no Stripe, no Rovaro payouts. Contractor admin source, calendar
tones and split totals: `domain/admin/ROVARO_CONTRACTOR_ADMIN.md`.

Machine-readable names: `domain/booking/rovaroMarketplaceWorkflow.js`.
Storage constants: `domain/booking/bookingStatus.js`.
Lifecycle transitions: `domain/booking/rentalBookingState.js`.

---

## Domain rule

The customer first sends a request and required documents. The contractor
confirms that the car is available. **Only after that confirmation** Rovaro
creates a Stripe link for the Booking Fee. The booking is confirmed for the
customer **only after successful payment**. After payment the contractor can
see customer contacts and driving-licence documents.

### Before payment

- No money is taken from the customer.
- The booking is not final.
- Contacts and driving licence are **hidden from the contractor**.
- The contractor may only: confirm availability, decline, or propose an alternative.

### After payment

- The booking is confirmed by the customer (paid).
- Contacts and licence open to the contractor.
- The contractor contacts the customer.
- The remaining rental and the balance are between customer and contractor.

Legacy flag `order.confirmed` on marketplace **must equal** “Stripe webhook
marked this booking paid”. Vehicle available must **not** set `confirmed`.

Stripe webhook is the **only** source of truth for payment. Returning to the
success page must not confirm the booking.

---

## Canonical stages ↔ stored `bookingStatus`

| Canonical stage (product) | Stored `order.bookingStatus` | Notes |
|---|---|---|
| `AWAITING_SUPPLIER_RESPONSE` | `PENDING_SUPPLIER_CONFIRMATION` | Request sent. No charge. |
| `AWAITING_CUSTOMER_PAYMENT` | `PAYMENT_PROCESSING` (after Checkout); brief hold may be `CONFIRMED_AWAITING_PAYMENT` | Stripe link exists. Still not `order.confirmed`. |
| `BOOKING_CONFIRMED` | `BOOKING_CONFIRMED` | Webhook paid only. Also `payment.status = paid`, `order.confirmed = true`. |
| `RENTAL_IN_PROGRESS` | *not stored yet* | After pickup time. |
| `RETURN_EXPECTED` | *not stored yet* | After planned return, before auto-close. |
| `COMPLETED` | `COMPLETED` + `order.status = PAID_AND_CLOSED` | Auto-close after return + grace, unless “Report a problem”. |
| `SUPPLIER_DECLINED` | `SUPPLIER_DECLINED` | No Stripe link. Customer is **not** told the technical reason until Rovaro reviews. |
| `ALTERNATIVE_PROPOSED` | `ALTERNATIVE_PROPOSED` | Customer must Accept alternative. Admin must not accept for them. |
| `REPLACED_BY_ALTERNATIVE` | *not stored yet* | Original request after a new linked order is created. |

Do not persist the strings `AWAITING_SUPPLIER_RESPONSE` or `PAYMENT_PENDING`
on `bookingStatus`.

---

## Happy path

### 1. Customer sends a request

Customer chooses car, dates/times, pickup/return, extras, insurance, contacts.

Before submit they **must**:

- upload driving licence;
- accept Rovaro Customer Booking Terms;
- accept the company’s Rental Terms if the company published them;
- confirm that the data is correct.

No payment at this step.

**Stage:** `AWAITING_SUPPLIER_RESPONSE`

Customer copy:

> Request sent  
> The rental company is checking vehicle availability. You have not been charged yet.

### 2. Notifications — new request

**Superadmin** — subject `New booking request — {orderNumber}`  
Company, car, dates, rental total, Booking Fee, order number, admin deep link.

**Contractor** — subject `New booking request — please confirm vehicle availability`  
Car, dates/times, places, extras, button **Review booking request**.  
No full contacts, no driving licence.

### 3. Contractor reviews — exactly three outcomes

**A. Vehicle available** — company will fulfil the rental.  
**B. Cannot provide** — reason required (car busy / broken / availability error / cannot deliver / other).  
**C. Suggest an alternative** — other car / price / terms, reason, message to Rovaro.

Separate control **Ask Rovaro a question**: does **not** change stage; creates an order message.

### 4. After Vehicle available — Stripe Booking Fee link

1. Stage → `AWAITING_CUSTOMER_PAYMENT`.
2. Create Stripe Checkout **only for the Booking Fee** (default 10% of gross).
3. Link has an expiry.
4. Customer email with **Pay Booking Fee** only.
5. Superadmin notice that the car is confirmed and the link exists.

Superadmin must **not** get a second “pay” email they can click by accident. Their mail shows amount, Stripe Session ID, expiry, link status, **safe admin order URL**, and optional **Copy customer payment link**.

### 5. Customer pays — webhook only

Only `checkout.session.completed` / async paid webhook may set:

- `bookingStatus = BOOKING_CONFIRMED`
- `payment.status = paid`
- `order.confirmed = true`
- Stripe Session ID, Payment Intent ID, amount, currency, paidAt
- accepted document versions + checksums
- payment event ID (idempotency)

### Notifications after payment

**Customer** — `Your booking is confirmed — {orderNumber}`  
Fee received; company can now review documents and contact them about collection. Car, dates, pickup, total, paid to Rovaro, remaining to company, company contact, order page link.

**Contractor** — `Customer confirmed the booking — payment received`  
Then they may see: name, email, phone, messengers, driving licence, other required documents, full order details.

**Superadmin** — `Booking Fee paid — booking confirmed`  
Order, customer, company, car, amount, Stripe IDs, paidAt, admin link.

---

## Handover and close

After payment, practical details are between company and customer (documents, meeting time, deposit, remaining balance, company rental contract, pickup, return).

Stages: `BOOKING_CONFIRMED` → `RENTAL_IN_PROGRESS` → `RETURN_EXPECTED` → `COMPLETED`.

If return time has passed and nobody reported a problem, auto-close after a grace period (e.g. 24 hours) → `COMPLETED`.

Company and superadmin need **Report a problem**, which **stops auto-close**.

---

## Decline

Cannot provide + required reason → `SUPPLIER_DECLINED`.

- No Stripe link.
- Customer is not charged.
- Not a confirmed booking.
- Superadmin gets a task.
- Customer does **not** receive the technical decline reason until Rovaro decides.

Superadmin may: offer another car, contact company, contact customer, close the request, publish an alternative.

---

## Alternative

Suggest an alternative → original `ALTERNATIVE_PROPOSED`.

Admin must **not** accept terms or create a payable booking on behalf of the customer.

1. Contractor or superadmin creates the alternative, linked to the original.
2. Customer receives it (after Rovaro publish/review if required).
3. Customer taps **Accept alternative**.
4. Customer sees new car, price, terms and re-confirms.
5. **Only then** is a Stripe link created.

If a new linked order is created:

- original → `REPLACED_BY_ALTERNATIVE`;
- new order stores `originalOrderId`;
- customer accepts themselves;
- documents/consents must not be marked accepted by an administrator.

---

## Notification matrix

| Event | Customer | Contractor | Rovaro |
|---|---|---|---|
| Request submitted | Receipt | New request | New request |
| Vehicle available | Payment link | Action confirmation | Car confirmed + link (admin-safe) |
| Declined | After Rovaro decision | Decline confirmation | Decline + reason + task |
| Alternative proposed | After review/publish | Proposal confirmation | Alternative + task |
| Booking Fee paid | Booking confirmed | Paid; open contacts & licence | Payment received |
| Payment not completed | Reminder | Awaiting payment | Status / expiry |
| Rental started | Info | Info | Status change |
| Completed | Ask for review | Order closed | Order closed |
| Problem reported | As needed | As needed | Urgent task |

---

## Safety invariants

1. Until payment, contractor does not see contacts or driving licence.
2. Superadmin sees data as allowed by access policy.
3. Stripe webhook is the only payment source of truth.
4. Repeat webhook must not resend mail or mutate a paid order again.
5. Email failure must not undo a saved order or a recorded payment.
6. Every action is audit-logged.
7. Stripe link only after Vehicle available.
8. Expired link may be reissued by superadmin.
9. Customer cannot pay a declined or replaced request.
10. After payment, material changes (car, price, terms) need customer consent.
11. Driving licence is required before the first request is sent.

---

## Chain (no skip)

```
Customer submitted request
  → AWAITING_SUPPLIER_RESPONSE
      → Vehicle available → AWAITING_CUSTOMER_PAYMENT (Stripe 10%)
          → Customer paid (webhook) → BOOKING_CONFIRMED
              → contacts & licence open to contractor
              → rental
              → auto-close if no problem → COMPLETED
      → Cannot provide → SUPPLIER_DECLINED → Rovaro manual decision
      → Suggest alternative → ALTERNATIVE_PROPOSED
          → Customer accepts → Stripe link on the accepted alternative
```

Contractor actions at review: Vehicle available | Cannot provide | Suggest an alternative | Ask Rovaro a question (no stage change).
