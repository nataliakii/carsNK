# Экспорт данных

Файлы **`cars-noseason-prices.json`**, **`cars-noseason-prices.csv`** и **`cars-noseason-prices.xlsx`** создаются скриптом из актуальной MongoDB (они не коммитятся как источник истины — при необходимости запустите экспорт снова).

## Все автомобили с ценами NoSeason

Из корня проекта:

```bash
npm run export:cars-noseason
```

Нужны переменные окружения (как у приложения), в т.ч.:

- `MONGODB_URI`
- опционально `MONGODB_DB_NAME` (по умолчанию `Car`, как в `lib/database.js`)

Результат:

- **`cars-noseason-prices.xlsx`** — Excel, лист `NoSeason`: название, год выпуска, трансмиссия, три цены NoSeason (€ за сутки для интервалов 1–4 / 5–14 / 14+ дн., ключи в БД `4`, `7`, `14`; если для первого интервала нет ключа `4`, подставляется `1`).
- **`cars-noseason-prices.json`** — `{ "cars": [ { "model", "registration", "transmission", "4", "7", "14" }, ... ] }`
- **`cars-noseason-prices.csv`** — колонки: `model`, `registration`, `transmission`, `4`, `7`, `14`

Перед первым запуском: `npm install` (нужен пакет `xlsx` в devDependencies).
