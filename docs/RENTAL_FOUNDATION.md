# Rental foundation (Task #2)

Country-aware timezones, server-authoritative rental pricing, one availability engine, and Greece/Spain booking-mode compatibility. Stripe, payment holds, Places, search UI, and transfer changes are out of scope.

## Booking modes

Resolved once by `resolveBookingMode` / `resolveRentalBookingContext`. Domain code must not infer mode from hostname.

| Mode | Default | Public request | Blocks calendar |
|---|---|---|---|
| `OPS_CALENDAR` | Greece / missing snapshot | `confirmed: false` until superadmin | Confirmed + offline |
| `MARKETPLACE_REQUEST` | New Spain companies | `bookingStatus: PENDING_SUPPLIER_CONFIRMATION` | Pending does **not** hard-block |

Historical orders without `bookingMode` stay `OPS_CALENDAR` even if the company is later marked Spain.

Company field `bookingMode` is optional. PlatformSettings `defaultBookingMode` can override for new orders.

## Timezone resolution

`resolveBusinessTimezone` priority:

1. Order snapshot `order.timezone`
2. Company override `company.timezone`
3. City/region `city.timezone` (Canary later)
4. Country config (`GR` → `Europe/Athens`, `ES` → `Europe/Madrid`)
5. Explicit fallback `Europe/Athens`

Never use the Vercel/server process timezone.

Historical orders without a snapshot use **Europe/Athens**, not the current deployment country.

`Europe/Canary` is accepted as an alias of IANA `Atlantic/Canary`.

### Datetime rules

Customer wall-clock pickup/return → interpret in resolved timezone → store UTC instants (`pickupAtUtc` / `returnAtUtc`) plus local snapshot + timezone.

- DST gap (nonexistent local time): rejected (`NONEXISTENT_LOCAL_TIME`).
- DST overlap (ambiguous): dayjs first occurrence (earlier offset). Deterministic.

## Pricing

`calculateAuthoritativeRentalPrice` wraps existing `Car.calculateTotalRentalPricePerDay` + `calculateDeliveryPrice`. No second formula.

Authoritative values are integer minor units (EUR cents). `Order.totalPrice` remains the major-unit compatibility field. `PriceBreakdown` is unchanged.

Public `POST /api/order/add` ignores client `totalPrice`. A mismatch ≥ €0.50 writes a safe `AuditLog` (`OTHER` / `PRICE_CLIENT_MISMATCH`) without the customer payload.

Currency at launch is ISO `EUR`.

### Prepayment (snapshot only)

Resolution: authorised override → car → company → platform → **10 for `MARKETPLACE_REQUEST` only**. Greece `OPS_CALENDAR` stays 0. No payment link or payment email in this phase.

`POST /api/order/calcTotalPrice` uses the same service and is rate-limited (`RENTAL_QUOTE_RATE_LIMIT_*`).

## Availability

`evaluateRentalAvailability` is the single engine.

Interval: half-open `[pickup, return)`. Buffer expands the **other** interval. Touching endpoints without buffer are allowed. Exact buffer-gap equality is allowed.

Hard-block: `confirmed` or `offline`, or future `bookingStatus` in `HARD_BLOCKING_BOOKING_STATUSES`.

Soft warning: pending unconfirmed / `PENDING_SUPPLIER_CONFIRMATION` overlap. Spain pending overlap does not prevent create.

The old create-path `408` boundary conflict **rejects** the request (`409`) and does not create the order.

Public availability payloads never include customer names or emails.

## Confirmation concurrency

`confirmOrderFlow` reloads the order and all car orders, runs the engine, then `analyzeConfirmationConflicts` for admin copy.

This repo does **not** use MongoDB transactions. Confirmation is check-then-set across Vercel instances — not fully atomic. Do not add an in-memory lock. Payment-hold / occupancy locking belongs to a later phase.

## Compatibility mapping

| Legacy | New |
|---|---|
| `confirmed` / `offline` | still the Greece blockers |
| `totalPrice` (float) | compatibility projection of `authoritativePrice.grossMinor` |
| `PriceBreakdown` | unchanged |
| `timeIn` / `timeOut` | still stored; also `pickupAtUtc` / `returnAtUtc` |
| missing `timezone` | display and interpret as Europe/Athens |
| missing `bookingMode` | OPS_CALENDAR |

No destructive migration. Dry-run script: `node scripts/backfillOrderRentalFoundation.js`.

## Future blocking (holds phase — not implemented)

`CONFIRMED_AWAITING_PAYMENT` and `BOOKING_CONFIRMED` will hard-block. Constants live in `domain/booking/bookingStatus.js`.
