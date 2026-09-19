// import mongoose from "mongoose";
import { Schema, model, models } from "mongoose";
import { getSiteCountryCode } from "@config/siteCountry";

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

  /**
   * Rule-based delivery (radius-split). When set with radiusKm, used instead of
   * relying only on named DeliveryZone rows + deliveryPricePerKm.
   */
  deliveryPricing: {
    type: new Schema(
      {
        radiusKm: { type: Number, default: null, min: 0 },
        inside: {
          mode: {
            type: String,
            enum: ["fixed", "free", "perKm"],
            default: "perKm",
          },
          amount: { type: Number, default: 0, min: 0 },
        },
        outside: {
          mode: {
            type: String,
            enum: ["perKm", "fixed", "blocked"],
            default: "perKm",
          },
          amount: { type: Number, default: 0, min: 0 },
        },
        afterHoursSurcharge: { type: Number, default: 0, min: 0 },
      },
      { _id: false }
    ),
    default: undefined,
  },

  /**
   * Max distance (km) from company.coords where pickup/return is allowed.
   * null/undefined = no km limit (only cityIds / locations allowlist).
   */
  orderRadiusKm: { type: Number, default: null, min: 0 },

  /** Public path or URL for transfer-voucher company stamp (per owner). */
  voucherStampSrc: { type: String, default: "", trim: true },

  /** Public storefront URL segment: /{locale}/c/{slug} */
  slug: {
    type: String,
    trim: true,
    lowercase: true,
    unique: true,
    sparse: true,
    index: true,
  },
  /** ISO country of this fleet — set from deployment (NEXT_PUBLIC_SITE_COUNTRY). */
  country: {
    type: String,
    default: () => getSiteCountryCode(),
    uppercase: true,
    trim: true,
    index: true,
  },
  /** Cities this company serves — subset of the superadmin catalog. */
  cityIds: {
    type: [{ type: Schema.Types.ObjectId, ref: "PlatformCity" }],
    default: [],
  },
  /** Public /c/{slug} page. */
  storefrontEnabled: {
    type: Boolean,
    default: true,
  },
  /** When false, cars stay off the main marketplace hub. */
  listedOnMarketplace: {
    type: Boolean,
    default: true,
    index: true,
  },

  /**
   * Rental booking mode for this fleet.
   * Omit for resolver default: GR → OPS_CALENDAR, ES → MARKETPLACE_REQUEST.
   */
  bookingMode: {
    type: String,
    enum: ["OPS_CALENDAR", "MARKETPLACE_REQUEST"],
    default: undefined,
  },
  /** IANA timezone override (e.g. Atlantic/Canary). Empty = country default. */
  timezone: { type: String, default: "", trim: true },
  /** Snapshot currency ISO code. Launch value is EUR. */
  currency: { type: String, default: "", uppercase: true, trim: true },
  /** Future prepayment percent (0–100). Null = resolver default. */
  prepaymentPercent: { type: Number, default: null, min: 0, max: 100 },

  /**
   * Per-company rental payment preferences (Stripe prepayment vs on-site).
   * Timing controls when Checkout is created: before or after admin confirm.
   */
  rentalPayments: {
    type: new Schema(
      {
        /** Charge rental prepayment online via Stripe. */
        stripeEnabled: { type: Boolean, default: false },
        /**
         * before_confirm — pay link on public booking create; confirm blocked until paid
         * after_confirm — pay link after admin confirms the order
         */
        timing: {
          type: String,
          enum: ["before_confirm", "after_confirm"],
          default: "after_confirm",
        },
      },
      { _id: false }
    ),
    default: undefined,
  },

  /**
   * Contacts shown in official order-confirmation email/PDF
   * (“meet / WhatsApp …” block). Per-company, not global env.
   * Legacy single fields mirror contacts[0] for older readers.
   */
  meetingContacts: {
    type: [
      {
        name: { type: String, default: "", trim: true },
        phone: { type: String, default: "", trim: true },
        channel: { type: String, default: "WhatsApp", trim: true },
      },
    ],
    default: [],
  },
  meetingContactPhone: { type: String, default: "", trim: true },
  meetingContactName: { type: String, default: "", trim: true },
  meetingContactChannel: { type: String, default: "WhatsApp", trim: true },

  /**
   * Passenger-transfer supplier capabilities (platform-managed pricing).
   * Suppliers configure service areas / capacity — not customer prices.
   */
  transferServices: {
    type: new Schema(
      {
        enabled: { type: Boolean, default: false },
        suspended: { type: Boolean, default: false },
        blockedByAdmin: { type: Boolean, default: false },
        supplierAgreementAcceptedAt: { type: Date, default: null },
        supplierAgreementVersion: { type: String, default: "", trim: true },
        serviceCountries: { type: [String], default: [] },
        serviceCities: { type: [String], default: [] },
        serviceZoneIds: {
          type: [{ type: Schema.Types.ObjectId, ref: "TransferZone" }],
          default: [],
        },
        airportsServed: { type: [String], default: [] },
        maxOperatingDistanceKm: { type: Number, default: null, min: 0 },
        vehicleCategories: { type: [String], default: ["STANDARD"] },
        maxPassengers: { type: Number, default: 7, min: 1 },
        maxStandardLuggage: { type: Number, default: 6, min: 0 },
        maxCabinBags: { type: Number, default: 6, min: 0 },
        childSeatsAvailable: { type: Number, default: 0, min: 0 },
        boosterSeatsAvailable: { type: Number, default: 0, min: 0 },
        accessibilityOptions: { type: [String], default: [] },
        operatingHours: {
          start: { type: String, default: "00:00" },
          end: { type: String, default: "23:59" },
        },
        blackoutDates: { type: [String], default: [] },
        minimumNoticeHours: { type: Number, default: 2, min: 0 },
        contactEmails: { type: [String], default: [] },
        notifyOnNewTransfer: { type: Boolean, default: true },
        acceptUrgentRequests: { type: Boolean, default: true },
        /**
         * Per-company Stripe / on-site collection preferences for transfers.
         * Independent of global STRIPE_* keys — those must still be set to charge.
         */
        payments: {
          /** Charge platform commission (margin) via Stripe Checkout. */
          stripeForPlatformFee: { type: Boolean, default: false },
          /** Charge the company/supplier amount via Stripe Checkout. */
          stripeForCompanyAmount: { type: Boolean, default: false },
        },
      },
      { _id: false }
    ),
    default: undefined,
  },
});

// В клиентском бандле mongoose.models может быть undefined — не обращаться без проверки
const Company =
  (typeof models !== "undefined" && models.Company) ||
  model("Company", CompanySchema);

if (Company?.schema && !Company.schema.path("slug")) {
  Company.schema.add({
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
    },
    country: { type: String, default: "GR", uppercase: true, trim: true },
    cityIds: { type: [Schema.Types.ObjectId], default: [] },
    storefrontEnabled: { type: Boolean, default: true },
    listedOnMarketplace: { type: Boolean, default: true },
  });
}

if (Company?.schema && !Company.schema.path("meetingContacts")) {
  Company.schema.add({
    meetingContacts: {
      type: [
        {
          name: { type: String, default: "", trim: true },
          phone: { type: String, default: "", trim: true },
          channel: { type: String, default: "WhatsApp", trim: true },
        },
      ],
      default: [],
    },
  });
}

if (Company?.schema && !Company.schema.path("meetingContactPhone")) {
  Company.schema.add({
    meetingContactPhone: { type: String, default: "", trim: true },
    meetingContactName: { type: String, default: "", trim: true },
    meetingContactChannel: { type: String, default: "WhatsApp", trim: true },
  });
}

if (Company?.schema && !Company.schema.path("orderRadiusKm")) {
  Company.schema.add({
    orderRadiusKm: { type: Number, default: null, min: 0 },
  });
}

if (Company?.schema && !Company.schema.path("deliveryPricing")) {
  Company.schema.add({
    deliveryPricing: {
      type: new Schema(
        {
          radiusKm: { type: Number, default: null, min: 0 },
          inside: {
            mode: { type: String, enum: ["fixed", "free", "perKm"], default: "perKm" },
            amount: { type: Number, default: 0, min: 0 },
          },
          outside: {
            mode: {
              type: String,
              enum: ["perKm", "fixed", "blocked"],
              default: "perKm",
            },
            amount: { type: Number, default: 0, min: 0 },
          },
          afterHoursSurcharge: { type: Number, default: 0, min: 0 },
        },
        { _id: false }
      ),
      default: undefined,
    },
  });
}

if (Company?.schema && !Company.schema.path("bookingMode")) {
  Company.schema.add({
    bookingMode: {
      type: String,
      enum: ["OPS_CALENDAR", "MARKETPLACE_REQUEST"],
    },
    timezone: { type: String, default: "", trim: true },
    currency: { type: String, default: "", uppercase: true, trim: true },
    prepaymentPercent: { type: Number, default: null, min: 0, max: 100 },
    rentalPayments: {
      type: new Schema(
        {
          stripeEnabled: { type: Boolean, default: false },
          timing: {
            type: String,
            enum: ["before_confirm", "after_confirm"],
            default: "after_confirm",
          },
        },
        { _id: false }
      ),
      default: undefined,
    },
  });
}

if (Company?.schema && !Company.schema.path("transferServices")) {
  Company.schema.add({
    transferServices: {
      type: new Schema(
        {
          enabled: { type: Boolean, default: false },
          suspended: { type: Boolean, default: false },
          blockedByAdmin: { type: Boolean, default: false },
          supplierAgreementAcceptedAt: { type: Date, default: null },
          supplierAgreementVersion: { type: String, default: "", trim: true },
          serviceCountries: { type: [String], default: [] },
          serviceCities: { type: [String], default: [] },
          serviceZoneIds: { type: [Schema.Types.ObjectId], default: [] },
          airportsServed: { type: [String], default: [] },
          maxOperatingDistanceKm: { type: Number, default: null, min: 0 },
          vehicleCategories: { type: [String], default: ["STANDARD"] },
          maxPassengers: { type: Number, default: 7, min: 1 },
          maxStandardLuggage: { type: Number, default: 6, min: 0 },
          maxCabinBags: { type: Number, default: 6, min: 0 },
          childSeatsAvailable: { type: Number, default: 0, min: 0 },
          boosterSeatsAvailable: { type: Number, default: 0, min: 0 },
          accessibilityOptions: { type: [String], default: [] },
          operatingHours: {
            start: { type: String, default: "00:00" },
            end: { type: String, default: "23:59" },
          },
          blackoutDates: { type: [String], default: [] },
          minimumNoticeHours: { type: Number, default: 2, min: 0 },
          contactEmails: { type: [String], default: [] },
          notifyOnNewTransfer: { type: Boolean, default: true },
          acceptUrgentRequests: { type: Boolean, default: true },
          payments: {
            stripeForPlatformFee: { type: Boolean, default: false },
            stripeForCompanyAmount: { type: Boolean, default: false },
          },
        },
        { _id: false }
      ),
      default: undefined,
    },
  });
}

export default Company;
