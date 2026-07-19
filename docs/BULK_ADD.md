# Bulk add (admin)

## Cars

- UI: `/admin/cars` → **Bulk add cars**
- API: `POST /api/car/addBulk` `{ cars: [...], ownerId? }`
- Each row gets auto `carNumber`, slug, default pricing tiers, `ownerId` from session (or superadmin override)
- Optional **per-row photo** (JPEG/PNG/WebP) via multipart `image_0`…`image_N`; missing → Cloudinary placeholder
- Catalog suggestions: `config/carCatalog.js` (also used in single Add Car model list)

## Offline orders

- UI: calendar toolbar → **Bulk offline**
- API: `POST /api/order/addBulk` `{ orders: [...] }`
- Each row: `offline: true`, `confirmed: true`, `my_order: false` — no email/Telegram
- Scoped to cars the admin can access (`ownerId`)
