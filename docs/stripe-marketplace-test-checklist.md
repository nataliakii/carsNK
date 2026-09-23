# Spain marketplace Stripe test-mode checklist

Use Stripe **test mode only**. Do not create live charges. Do not send real
customer email from a production mailbox — use a catch-all or disable SMTP.

## 1. Prerequisites

- `STRIPE_MODE=test`
- `STRIPE_SECRET_KEY_TEST` and `STRIPE_WEBHOOK_SECRET_TEST` set locally
- Stripe CLI: `stripe listen --forward-to localhost:3026/api/payments/stripe/webhook`
- A Spain marketplace car with an owner company email you control
- Superadmin login for `/admin`

## 2. Request created (no Stripe)

1. Book the car as a customer (marketplace request).
2. Confirm the order is `PENDING_SUPPLIER_CONFIRMATION`.
3. Confirm no Checkout Session exists and no customer payment email was sent.

## 3. Partner confirm → session created

1. Open the partner confirmation link from the owner-company email.
2. Confirm availability.
3. Confirm a hold is `active` and booking status is `PAYMENT_PROCESSING`.
4. Customer receives one payment-request email with the 10% amount and expiry.

## 4. Pay in test mode

1. Open the Checkout URL.
2. Pay with card `4242 4242 4242 4242`.
3. Stripe CLI should show `checkout.session.completed`.
4. Order becomes `BOOKING_CONFIRMED`. Hold is `finalized`.
5. Customer + partner paid emails send **once**.

## 5. Duplicate webhook

1. Replay the same `checkout.session.completed` event (`stripe events resend evt_...`).
2. Booking stays confirmed. No second paid email.

## 6. Expired hold (no webhook)

1. Create a new request and confirm it so a payment link exists.
2. Do **not** pay. Wait until `holdExpiresAt` (or POST
   `/api/internal/booking-holds/cleanup` with `Authorization: Bearer $CRON_SECRET`).
   Cleanup does not create or sync Mongo indexes; apply those once with
   `node scripts/migrateBookingHoldIndexes.js --apply`
   (see `docs/booking-hold-indexes.md`).
3. Hold is `released` (row still exists). Booking is `PAYMENT_EXPIRED`.
4. Customer expired email sends once. Rerun cleanup does not mail again.

## 7. Reissue

1. As superadmin, open the booking in Edit order.
2. Confirm you cannot issue a new link while the old session is still active
   (use Resend existing email instead).
3. After expiry, **Issue new payment link** with reason “Payment link expired”.
4. New session id differs; price snapshot checksum is unchanged.
5. Customer email contains the new URL.
6. Paying the **old** session must not confirm the booking (stale/ignored, HTTP 2xx).
7. Paying the **new** session confirms the booking.

## 8. Security mismatch

1. In Stripe test dashboard, complete a session whose amount was altered, or
   replay a fixture with a wrong `amount_total`.
2. Webhook returns `{ received: true }`.
3. Order is **not** marked paid. Audit log has `RENTAL_PAYMENT_MISMATCH`.

## 9. Refund / dispute

1. Refund part of the test charge. Order stays confirmed; `refundStatus=partial`.
2. Refund the rest. `refundStatus=full`, payment status `refunded`, original
   paid amount kept. Superadmin is notified. Booking is **not** auto-cancelled.
3. Replay the refund event — no double-count.
4. Create a test dispute; status moves created → updated → closed.

## 10. Metadata

On the Checkout Session **and** the PaymentIntent, confirm metadata includes
`kind`, `orderId`, `bookingReference`, `companyId`, `carId`,
`expectedAmountMinor`, `currency`, `priceSnapshotChecksum`, `environment`.
