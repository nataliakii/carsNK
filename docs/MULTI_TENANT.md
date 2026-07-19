# Multi-tenant owners

Partner firm = `Company` document. Fleet scoping field = `ownerId` (Company `_id`) on:

- `User` — ADMIN must have `ownerId`; SUPERADMIN may be null (sees all)
- `Car` — whose fleet
- `Order` — denormalized from car at create time

## Behaviour

| Role | Cars / calendar / orders |
|------|---------------------------|
| Public | All non-`testingCar` (marketplace) |
| ADMIN | Only `ownerId === session.user.ownerId` |
| SUPERADMIN | Everything |

## Auth

1. Prefer MongoDB `User` (email + bcrypt password)
2. Fallback: `AUTH_ADMIN_*` / `AUTH_SUPERADMIN_*` env (bootstrap)

Session includes `ownerId`.

## Superadmin UI

`/admin/owners` — create company, create ADMIN user, assign cars to owner.

## Seed

```bash
npm run seed:carsnk-company   # if company missing
npm run seed:owners           # backfill ownerId + upsert env users into DB
```

After seed, log in with the same emails/passwords from `.env` — they resolve from DB first.
