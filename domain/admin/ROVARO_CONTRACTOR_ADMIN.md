# Canonical contractor admin rule

**This is the domain rule for the rental-company admin.** Calendar, orders
table, totals and superadmin queues must follow it.

Platform confirmation and payment: `domain/booking/ROVARO_MARKETPLACE_WORKFLOW.md`.  
Machine-readable source and totals: `domain/admin/rovaroContractorAdmin.js`.

Proven legacy flag: `my_order === true` is a public-site booking (PLATFORM).
`my_order === false` is a company-calendar booking (INTERNAL). A missing
`my_order` is not guessed: old copy scripts set it true, `migrate_my_order_field.js`
would set it false. New records store immutable `source`. Colour is display only.

---

## Two sources

### Platform booking (`BOOKING_SOURCE.PLATFORM`)

Came from the public Rovaro site (`my_order === true`).

Applies:

- contractor availability check;
- Booking Fee (default 10%);
- Stripe Checkout;
- contacts after payment;
- notifications;
- legal snapshots;
- platform stages;
- Rovaro fee totals.

### Internal booking (`BOOKING_SOURCE.INTERNAL`)

Created by the company in its own calendar (`my_order !== true`).

Examples: direct/phone booking, other platform, hold, personal use, repair,
service.

Rovaro does **not**:

- create a Stripe link;
- take 10%;
- include it in platform commission;
- send Rovaro customer emails;
- require Rovaro document acceptance.

The company settles itself. The amount is **internal only**.

The record **must block vehicle availability** by default (`blocksAvailability = true`)
so Rovaro cannot sell those dates to another customer.

Source is **immutable** after create. Internal never auto-converts to platform.
Platform cannot be reclassified as internal to avoid the fee.

---

## What Rovaro may see

Do **not** claim Rovaro cannot see internals. They live on the platform; the
operator may access them for support, security, audit or law.

Correct rule: internals are **outside Rovaro’s commercial process**. They are
not in normal platform order queues, do not create commission, and do not start
Rovaro customer or payment flows.

Superadmin table:

- hide internals by default;
- optional support-only filter;
- not in platform tasks;
- no platform emails;
- not in Rovaro financial reports.

---

## Calendar tones (theme keys, not hex in domain)

| Tone | Type | Meaning |
|---|---|---|
| `NEW_REQUEST` (yellow) | Platform | New request — company has not answered |
| `AWAITING_PAYMENT` (light green) | Platform | Vehicle available, waiting for customer payment |
| `CONFIRMED_PAID` (dark green) | Platform | Booking Fee paid, booking confirmed |
| `INTERNAL` (violet) | Internal | Company calendar record, no Rovaro fee |

Overlays (not a fifth booking type):

| State | Display |
|---|---|
| Declined | Grey, or hidden from the active calendar |
| Payment expired | Light grey + “Payment expired” |
| Cancelled | Grey, struck through |
| Problem | **Red border / indicator only** — never a primary booking colour |
| Completed | Dark green + Completed, or hidden by filter |

Red is a problem signal, not a source colour.

All internals stay violet. Later internal badges (Tentative, Reserved,
Confirmed, Paid, Completed, Cancelled) do not add calendar colours.

---

## Platform cards

**Yellow — `AWAITING_SUPPLIER_RESPONSE`**  
Car, dates/times, places, order number, “New request”, actions: Vehicle
available, Cannot provide, Suggest alternative.

**Light green — `AWAITING_CUSTOMER_PAYMENT`**  
Vehicle confirmed; waiting for customer payment; payment-link expiry;
contacts and licence still hidden.

**Dark green — `BOOKING_CONFIRMED`**  
Customer paid; Booking Fee; amount due to company; contacts; licence;
pickup details; Contact customer; Report a problem.

Flow:

```
NEW_REQUEST → Vehicle available → AWAITING_PAYMENT
  → Booking Fee paid → CONFIRMED_PAID → Completed
NEW_REQUEST → declined | payment expired
```

---

## Internal records (`INTERNAL_BLOCK`)

Company may set: car, dates/times, label or customer name, optional phone/email,
internal amount, notes, origin, whether it blocks the car.

Recommended: `blocksAvailability = true`.

Deleting an internal booking frees the car.

---

## Contractor orders table

Both sources, source column obvious (`Rovaro` / `Internal`).

Columns: Status, Source, Order, Car, Pickup, Return, Customer (name only at
the allowed stage), Rental total, Rovaro Booking Fee (platform only), Due to
company, Actions.

Filters: period, car, status, source All / Rovaro / Internal, active/upcoming,
past, completed, cancelled, search (order number, car, customer).

Toggle: **Hide past and completed bookings**.

---

## Money

Never: `rovaroFee = 10% × all visible orders`.

```
platformBookingValue     = sum(filtered platform rental totals)
rovaroBookingFees        = sum(filtered platform booking fees)
dueToCompanies           = platformBookingValue − rovaroBookingFees
internalBookingValue     = sum(filtered internal amounts)
rovaroFeeFromInternalBookings = 0
allBookingValue          = platformBookingValue + internalBookingValue
```

The invariant `platformBookingValue = rovaroBookingFees + dueToCompanies` uses platform rows only. Internal amounts never enter it. Fee is never `10% × all booking value`.

Labels:

- All booking value.
- Rovaro bookings: Rental value, Rovaro Booking Fee, Due to companies.
- Internal: Internal booking value, Rovaro fee €0.00. Not profit and not a payout.

---

## Constraints

- Internal never auto-becomes platform.
- Changing an internal amount does not create a fee.
- No Rovaro Stripe link or legal click-wrap on internals.
- Internals block the car for those dates (default).
- Platform cannot be painted/converted internal to dodge the fee.
- Source cannot change after create.
- Company admin cannot delete platform payment history.
- Totals follow source fields, not colour or status wording.
