# Dual domain: carsnk.gr + cars.bbqr.site

One Vercel project, one set of env vars (Mongo, SMTP, Telegram, auth secrets). Both hosts serve the same app.

## Behaviour

| Concern | Rule |
|--------|------|
| Traffic | No 301 from `cars.bbqr.site` → `carsnk.gr`. Peer links open as-is. |
| www | `www.carsnk.gr` → `carsnk.gr`, `www.cars.bbqr.site` → `cars.bbqr.site` only |
| SEO | `rel=canonical`, Open Graph, sitemap always use `https://carsnk.gr` via `getBaseUrl()` |
| Brand | Emails & Telegram: **CarsNK**, links to `https://carsnk.gr` |
| Auth | Host-aware: leave `NEXTAUTH_URL` unset on Vercel so login works on either apex |

Code: `config/domain.js`, `services/seo/domainRedirect.ts`, `lib/authOptions.js`.

## Vercel env (shared)

```bash
NEXT_PUBLIC_SITE_URL=https://carsnk.gr
# Leave NEXTAUTH_URL unset in production (or set per-request via Host).
# Do NOT set NEXTAUTH_URL to *.vercel.app — authOptions strips that.
NEXTAUTH_SECRET=<secret>
AUTH_ADMIN_EMAIL=
AUTH_ADMIN_PASSWORD=
AUTH_SUPERADMIN_EMAIL=
AUTH_SUPERADMIN_PASSWORD=
MONGODB_URI=<same for both hosts>
# SMTP_*, TELEGRAM_* — same project
```

Local:

```bash
NEXTAUTH_URL=http://localhost:3026
NEXT_PUBLIC_SITE_URL=https://carsnk.gr
AUTH_ADMIN_EMAIL=cars@bbqr.site
AUTH_ADMIN_PASSWORD=…
AUTH_SUPERADMIN_EMAIL=admin@bbqr.site
AUTH_SUPERADMIN_PASSWORD=…
```


## Domains in Vercel

Add both apex (+ www if used) to the same project. No rewrite that maps bbqr → carsnk for all traffic.

## Cookies / sessions

Sessions are host-only (`.gr` and `.bbqr.site` do not share cookies). Admin must log in on the host they use. That is expected.
