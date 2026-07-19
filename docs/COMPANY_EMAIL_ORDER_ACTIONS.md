# Company email order actions (Accept / Reject / Calendar / Message)

## What was missing

Company got new-order emails **without customer contacts**, but no buttons to respond.

## What exists now

On **CREATE** of an unconfirmed client order, the `COMPANY_EMAIL` HTML includes:

| Button | Effect |
|--------|--------|
| **Accept** | Saves `companyEmailDecision=accepted`, emails + Telegram to superadmin |
| **Reject** | Saves `companyEmailDecision=rejected`, notifies superadmin |
| **View calendar** | Opens `/admin` (login required) |
| **Message superadmins** | Form → free-text email/Telegram to superadmin |

**Important:** Accept does **not** set `order.confirmed`. Confirmation stays SUPERADMIN-only in admin UI.

## Links

Signed HMAC tokens (`NEXTAUTH_SECRET` or `EMAIL_ACTION_SECRET`), TTL 14 days.

Endpoint: `GET/POST /api/order/company-email-action?token=…`

## Files

- `domain/orders/companyEmailActionToken.js`
- `domain/orders/companyEmailActions.js`
- `domain/orders/buildCompanyEmailOrderActions.js`
- `app/api/order/company-email-action/route.js`
- `app/ui/email/templates/adminOrderNotification.js` (CTA row)
- `models/order.js` — `companyEmailDecision`, `companyEmailDecisionAt`
