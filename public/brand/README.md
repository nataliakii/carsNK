# Brand assets

Switched by `NEXT_PUBLIC_SITE_COUNTRY` (`config/siteCountry.js` → `config/brand.js`).

| Country | Brand   | Folder                 |
|---------|---------|------------------------|
| `GR` (default) | CarsNK  | `public/brand/carsnk/` |
| `ES` (etc.)    | rovaro  | `public/brand/rovaro/` |

## CarsNK (`brand/carsnk/`)

PNG wordmarks + mark used via `next/image` in `SiteLogo` / `SiteMark`.

## rovaro (`brand/rovaro/`)

- UI logos are **vector React SVGs** (`app/components/brand/RovaroBrandSvg.js`) — crisp at any size.
- Static `.svg` / `.png` here are for favicon, Apple touch icon, OG, emails.

### Colors (rovaro)

- Magenta `#E30052`
- Black `#0A0A0A`
- White `#FFFFFF`

Do not drop new logos in `public/` root — put them under the correct brand folder and wire paths in `config/brand.js`.
