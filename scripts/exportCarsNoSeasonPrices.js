/**
 * Экспорт из MongoDB: модель, год, трансмиссия + 3 цены NoSeason (ключи 4, 7, 14;
 * для устаревших записей первая цена подставляется с ключа «1», если «4» нет).
 *
 * Пишет:
 *   exports/cars-noseason-prices.xlsx
 *   exports/cars-noseason-prices.json
 *   exports/cars-noseason-prices.csv
 *
 * Usage:
 *   npm run export:cars-noseason
 */

const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");
const { loadEnvConfig } = require("@next/env");
const XLSX = require("xlsx");

loadEnvConfig(process.cwd());

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "Car";
const OUT_DIR = path.join(process.cwd(), "exports");
const JSON_FILE = path.join(OUT_DIR, "cars-noseason-prices.json");
const CSV_FILE = path.join(OUT_DIR, "cars-noseason-prices.csv");
const XLSX_FILE = path.join(OUT_DIR, "cars-noseason-prices.xlsx");

/** Ключи тарифов в pricingTiers (как в UI: 1–4 дн., 5–14, 14+) */
const DAY_KEYS = ["4", "7", "14"];
/** Если в БД остались старые документы с ключом 1 вместо 4 */
const DAY_KEY_FALLBACKS = { 4: ["1"], 7: [], 14: [] };

function daysToObject(days) {
  if (!days || typeof days !== "object") return {};
  const out = {};
  if (days instanceof Map) {
    for (const [k, v] of days) {
      const num = typeof v === "number" ? v : Number(v);
      out[String(k)] = Number.isFinite(num) ? num : null;
    }
    return out;
  }
  for (const [k, v] of Object.entries(days)) {
    const num = typeof v === "number" ? v : Number(v);
    out[String(k)] = Number.isFinite(num) ? num : null;
  }
  return out;
}

function pickPrice(daysObj, key) {
  const v = daysObj[key];
  if (v == null || v === "") return null;
  return typeof v === "number" ? v : Number(v);
}

function pickPriceWithFallbacks(daysObj, key) {
  const fallbacks = DAY_KEY_FALLBACKS[key] || [];
  const direct = pickPrice(daysObj, key);
  if (direct != null) return direct;
  for (const alt of fallbacks) {
    const v = pickPrice(daysObj, alt);
    if (v != null) return v;
  }
  return null;
}

function escapeCsvCell(val) {
  if (val == null) return "";
  const s = String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function strTransmission(car) {
  const t = car.transmission;
  if (t == null || t === "") return "";
  return typeof t === "string" ? t : String(t);
}

function numRegistration(car) {
  const r = car.registration;
  if (r == null || r === "") return "";
  const n = typeof r === "number" ? r : Number(r);
  return Number.isFinite(n) ? n : String(r);
}

async function main() {
  if (!MONGODB_URI) {
    console.error("Missing MONGODB_URI. Set it in .env.local or the environment.");
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  console.log("Connected to MongoDB");

  const db = client.db(MONGODB_DB_NAME);
  const cars = await db.collection("cars").find({}).sort({ sort: 1, carNumber: 1 }).toArray();
  console.log(`Cars found: ${cars.length} (db: ${MONGODB_DB_NAME})`);

  const exportedAt = new Date().toISOString();
  const carsOut = cars.map((car) => {
    const tiers = car.pricingTiers || {};
    const no = tiers.NoSeason || tiers.noseason || null;
    const days = no && no.days != null ? daysToObject(no.days) : {};
    return {
      model: car.model ?? "",
      registration: numRegistration(car),
      transmission: strTransmission(car),
      [DAY_KEYS[0]]: pickPriceWithFallbacks(days, DAY_KEYS[0]),
      [DAY_KEYS[1]]: pickPriceWithFallbacks(days, DAY_KEYS[1]),
      [DAY_KEYS[2]]: pickPriceWithFallbacks(days, DAY_KEYS[2]),
    };
  });

  const payload = {
    exportedAt,
    season: "NoSeason",
    note:
      "Модель, год (registration), трансмиссия; цены за сутки (€) для интервалов 1–4 дн., 5–14 дн., 14+ дн. — ключи 4, 7, 14 в БД (при отсутствии 4 используется ключ 1).",
    cars: carsOut,
  };

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  fs.writeFileSync(JSON_FILE, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote ${JSON_FILE}`);

  const csvHeader = ["model", "registration", "transmission", ...DAY_KEYS];
  const lines = [csvHeader.map(escapeCsvCell).join(",")];
  for (const r of carsOut) {
    lines.push(
      [r.model, r.registration, r.transmission, r[DAY_KEYS[0]], r[DAY_KEYS[1]], r[DAY_KEYS[2]]]
        .map(escapeCsvCell)
        .join(",")
    );
  }
  fs.writeFileSync(CSV_FILE, lines.join("\n"), "utf8");
  console.log(`Wrote ${CSV_FILE}`);

  const excelRows = carsOut.map((r) => ({
    "Название": r.model,
    "Год выпуска": r.registration === "" ? "" : r.registration,
    "Трансмиссия": r.transmission,
    "NoSeason 1–4 дн., €": r[DAY_KEYS[0]] ?? "",
    "NoSeason 5–14 дн., €": r[DAY_KEYS[1]] ?? "",
    "NoSeason 14+ дн., €": r[DAY_KEYS[2]] ?? "",
  }));
  const ws = XLSX.utils.json_to_sheet(excelRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "NoSeason");
  XLSX.writeFile(wb, XLSX_FILE);
  console.log(`Wrote ${XLSX_FILE}`);

  await client.close();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
