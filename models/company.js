// import mongoose from "mongoose";
import { Schema, model, models } from "mongoose";

const SeasonSchema = new Schema({
  start: { type: String, required: true }, // Use MM/DD format
  end: { type: String, required: true }, // Use MM/DD format
});

const CoordsSchema = new Schema({
  lat: { type: String, required: true },
  lon: { type: String, required: true },
});

const locationsSchema = new Schema({
  name: { type: String },
  coords: CoordsSchema,
});
const WorkingHoursSchema = new Schema({
  start: { type: String, default: "08:00" }, // HH:mm format
  end: { type: String, default: "22:00" }, // HH:mm format
});

const CompanySchema = new Schema({
  name: { type: String, required: true },
  tel: { type: String, required: true },
  tel2: { type: String },
  email: { type: String, required: true },
  email2: { type: String },
  address: { type: String, required: true },
  slogan: { type: String },
  coords: { type: CoordsSchema, required: true },
  hoursDiffForStart: { type: Number, required: true },
  hoursDiffForEnd: { type: Number, required: true },
  bufferTime: { type: Number, required: true, default: 2 }, // Buffer hours between orders
  defaultStart: { type: String, required: true }, // Use HH:mm format
  defaultEnd: { type: String, required: true }, // Use HH:mm format
  seasons: {
    NoSeason: { type: SeasonSchema, required: true },
    LowSeason: { type: SeasonSchema, required: true },
    LowUpSeason: { type: SeasonSchema, required: true },
    MiddleSeason: { type: SeasonSchema, required: true },
    HighSeason: { type: SeasonSchema, required: true },
  },
  /** Включить учёт сезонов (ценовые периоды и т.п.). При false в UI/API можно отключать сезонную логику. */
  useSeasons: { type: Boolean, default: true },
  /** Язык текста уведомлений (email) админу компании: en, ru, uk, … */
  langAdmin: { type: String, default: "en", trim: true },
  /** Язык текста уведомлений суперадмину (Telegram + email на DEVELOPER_EMAIL) */
  langSuperadmin: { type: String, default: "en", trim: true },
  useEmail: { type: Boolean, default: false, required: true },
  locations: [locationsSchema],
  notSendIP1: { type: String, trim: true, default: "" },
  notSendIP2: { type: String, trim: true, default: "" },
  notSendIP3: { type: String, trim: true, default: "" },
  notSendIP4: { type: String, trim: true, default: "" },
  
  // Booking rules (moved from config/bookingRules.js)
  minRentalDuration: { type: Number, default: 1 }, // Minimum rental duration in hours
  workingHours: { type: WorkingHoursSchema, default: () => ({ start: "08:00", end: "22:00" }) },

  // Delivery pricing
  deliveryPricePerKm: { type: Number, default: 1, min: 0 },
});

// В клиентском бандле mongoose.models может быть undefined — не обращаться без проверки
const Company =
  (typeof models !== "undefined" && models.Company) ||
  model("Company", CompanySchema);

export default Company;
