# Company email order actions (Accept / Reject / Calendar / Message)

## What was missing

Company got new-order emails **without customer contacts**, but no buttons to respond.

## What exists now

On **CREATE** of an unconfirmed client order, the `COMPANY_EMAIL` HTML includes:

| Button | Effect |
|--------|--------|
| **Accept** | Opens a confirm page. Submitting the form (POST) saves `companyEmailDecision=accepted`, emails + Telegram to superadmin |
| **Reject** | Opens a confirm page. Submitting the form (POST) saves `companyEmailDecision=rejected`, notifies superadmin |
| **View calendar** | Opens `/admin` (login required) |
| **Message superadmins** | GET form → POST free-text email/Telegram to superadmin |

**Important:** Accept does **not** set `order.confirmed`. Confirmation stays SUPERADMIN-only in admin UI.

## GET is read-only

Emailed CTA URLs stay `GET /api/order/company-email-action?token=…`.

- Token is validated on GET.
- `message` → existing HTML form (POST to apply).
- `accept` / `reject` → HTML confirm form (hidden `token`, `intent=accept|reject`). Submit is POST.
- **GET never writes to the database.** Mutation happens only on POST.

## Links

Signed HMAC tokens (`NEXTAUTH_SECRET` or `EMAIL_ACTION_SECRET`), TTL 14 days. Token format is unchanged.

Endpoint: `GET/POST /api/order/company-email-action?token=…`

## Files

- `domain/orders/companyEmailActionToken.js`
- `domain/orders/companyEmailActions.js`
- `domain/orders/buildCompanyEmailOrderActions.js`
- `app/api/order/company-email-action/route.js`
- `app/ui/email/templates/adminOrderNotification.js` (CTA row)
- `models/order.js` — `companyEmailDecision`, `companyEmailDecisionAt`
