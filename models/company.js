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
  /** Seasonal + duration-tier pricing. When false: one daily rate year-round (NoSeason), no season UI/tiers. Default true (Greece). */
  useSeasons: { type: Boolean, default: true },
  /** Язык текста уведомлений (email) админу компании: en, ru, uk, … */
  langAdmin: { type: String, default: "en", trim: true },
  /** Язык текста уведомлений суперадмину (Telegram + email на DEVELOPER_EMAIL) */
  langSuperadmin: { type: String, default: "en", trim: true },
  useEmail: { type: Boolean, default: false, required: true },
  locations: [locationsSchema],

  /**
   * Pickup / return offices. Street address is the customer-facing base.
   * `_id` is the stable office reference used by cars and order snapshots.
   */
  offices: {
    type: [
      new Schema(
        {
          name: { type: String, default: "", trim: true },
          publicName: { type: String, default: "", trim: true },
          address: { type: String, default: "", trim: true },
          city: { type: String, default: "", trim: true },
          country: { type: String, default: "", trim: true, uppercase: true },
          placeId: { type: String, default: "", trim: true },
          lat: { type: String, default: "", trim: true },
          lon: { type: String, default: "", trim: true },
          locationType: {
            type: String,
            enum: ["office", "airport", "train_station", "port", "hotel", "other"],
            default: "office",
          },
          collectionInstructions: { type: String, default: "", trim: true },
          returnInstructions: { type: String, default: "", trim: true },
          openingHours: {
            start: { type: String, default: "", trim: true },
            end: { type: String, default: "", trim: true },
          },
          showPhone: { type: Boolean, default: false },
          status: {
            type: String,
            enum: ["active", "archived"],
            default: "active",
          },
          freePickup: { type: Boolean, default: true },
          freeReturn: { type: Boolean, default: true },
          carIds: { type: [Schema.Types.ObjectId], default: [] },
          archivedAt: { type: Date, default: null },
        },
        { _id: true, timestamps: true }
      ),
    ],
    default: [],
  },
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
        /**
         * zones — legacy named DeliveryZone rows
         * radius — free/fixed inside radiusKm of office, then outside rule
         * cities — free/fixed inside operatingCities list, €/km outside from office
         */
        strategy: {
          type: String,
          enum: ["zones", "radius", "cities"],
          default: undefined,
        },
        /** Free radius from office (km). Also used as optional free band in cities strategy. */
        radiusKm: { type: Number, default: null, min: 0 },
        /** City names the company operates in (cities strategy). */
        operatingCities: { type: [String], default: [] },
        /** Beyond this distance from office → blocked / contact us. */
        maxDistanceKm: { type: Number, default: null, min: 0 },
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
        /** Monotonic tariff version — live edits bump; order snapshots keep the old value. */
        version: { type: Number, default: 1, min: 1 },
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

  /**
   * Official Spanish coverage (INE codes). Separate from deliveryPricing
   * city lists so booking prices stay unchanged.
   */
  serviceAreas: {
    communityCodes: { type: [String], default: [] },
    provinceCodes: { type: [String], default: [] },
  },

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
  /** Future Greece / ops prepayment percent (0–100). Null = resolver default. */
  prepaymentPercent: { type: Number, default: null, min: 0, max: 100 },
  /**
   * Spain marketplace Rovaro Booking Fee override in basis points (10% = 1000).
   * Null = inherit PlatformSettings.marketplaceBookingFeeBps, else 1000 (10%).
   * SUPERADMIN only. Existing order snapshots never re-read this field.
   */
  marketplaceBookingFeeBps: { type: Number, default: null, min: 100, max: 3000 },

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
        serviceAreas: {
          communityCodes: { type: [String], default: [] },
          provinceCodes: { type: [String], default: [] },
        },
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
        /** When true, use active rental cars instead of manual transfer-vehicle fields. */
        useRentalFleet: { type: Boolean, default: undefined },
        /**
         * Show every request in the saved service area. Does not auto-accept
         * or reserve a vehicle — the company still claims each order.
         */
        acceptAllTransferRequests: { type: Boolean, default: false },
        /** When true, reuse company Coverage cities/airports. */
        transferCoverageFollowsCompany: { type: Boolean, default: undefined },
        /** Optional override of company.email for transfer notifications. */
        transferNotifyEmail: { type: String, default: "", trim: true },
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

if (Company?.schema && !Company.schema.path("offices")) {
  Company.schema.add({
    offices: {
      type: [
        new Schema(
          {
            name: { type: String, default: "", trim: true },
            address: { type: String, default: "", trim: true },
            lat: { type: String, default: "", trim: true },
            lon: { type: String, default: "", trim: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
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
          strategy: {
            type: String,
            enum: ["zones", "radius", "cities"],
            default: undefined,
          },
          radiusKm: { type: Number, default: null, min: 0 },
          operatingCities: { type: [String], default: [] },
          maxDistanceKm: { type: Number, default: null, min: 0 },
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
} else if (Company?.schema?.path("deliveryPricing")) {
  const dp = Company.schema.path("deliveryPricing");
  if (dp?.schema && !dp.schema.path("strategy")) {
    dp.schema.add({
      strategy: {
        type: String,
        enum: ["zones", "radius", "cities"],
        default: undefined,
      },
      operatingCities: { type: [String], default: [] },
      maxDistanceKm: { type: Number, default: null, min: 0 },
    });
  }
  if (dp?.schema && !dp.schema.path("version")) {
    dp.schema.add({
      version: { type: Number, default: 1, min: 1 },
    });
  }
  if (dp?.schema && !dp.schema.path("afterHoursSurcharge")) {
    dp.schema.add({
      afterHoursSurcharge: { type: Number, default: 0, min: 0 },
    });
  }
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
          serviceAreas: {
            communityCodes: { type: [String], default: [] },
            provinceCodes: { type: [String], default: [] },
          },
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
          useRentalFleet: { type: Boolean, default: undefined },
          acceptAllTransferRequests: { type: Boolean, default: false },
          transferCoverageFollowsCompany: { type: Boolean, default: undefined },
          transferNotifyEmail: { type: String, default: "", trim: true },
          payments: {
            stripeForPlatformFee: { type: Boolean, default: false },
            stripeForCompanyAmount: { type: Boolean, default: false },
          },
        },
        { _id: false }
      ),
      default: undefined,
    },

    /**
     * Customer-facing rental rules. English is authored by the company;
     * other languages are Google Translate copies filled on save.
     */
    customerRentalTerms: {
      type: new Schema(
        {
          documentId: { type: String, default: "", trim: true },
          title: { type: String, default: "", trim: true },
          originalLanguage: { type: String, default: "en" },
          format: { type: String, default: "text" },
          effectiveFrom: { type: Date, default: null },
          versions: { type: Schema.Types.Mixed, default: [] },
          sourceEn: { type: String, default: "" },
          translations: { type: Schema.Types.Mixed, default: {} },
          sourceHash: { type: String, default: "", trim: true },
          publishedVersion: { type: Number, default: 0, min: 0 },
          status: {
            type: String,
            default: "removed",
            enum: ["draft", "published", "removed", "archived"],
          },
          translatedAt: { type: Date, default: null },
          updatedAt: { type: Date, default: null },
          updatedByEmail: { type: String, default: "", trim: true },
        },
        { _id: false }
      ),
      default: undefined,
    },
  });
}

if (Company?.schema && !Company.schema.path("serviceAreas")) {
  Company.schema.add({
    serviceAreas: {
      communityCodes: { type: [String], default: [] },
      provinceCodes: { type: [String], default: [] },
    },
  });
}

if (Company?.schema && !Company.schema.path("marketplaceBookingFeeBps")) {
  Company.schema.add({
    marketplaceBookingFeeBps: {
      type: Number,
      default: null,
      min: 100,
      max: 3000,
    },
  });
}

if (Company?.schema && !Company.schema.path("emailPreferences")) {
  Company.schema.add({
    emailPreferences: {
      type: new Schema(
        {
          primaryOperationalEmail: { type: String, default: "", trim: true },
          additionalRecipients: {
            type: [
              new Schema(
                {
                  email: { type: String, trim: true, lowercase: true },
                  bookingEmailsEnabled: { type: Boolean, default: true },
                  transferEmailsEnabled: { type: Boolean, default: true },
                },
                { _id: false }
              ),
            ],
            default: [],
          },
        },
        { _id: false }
      ),
      default: undefined,
    },
  });
}

const transferServicesPath = Company?.schema?.path("transferServices");
if (transferServicesPath?.schema && !transferServicesPath.schema.path("useRentalFleet")) {
  transferServicesPath.schema.add({
    useRentalFleet: { type: Boolean, default: undefined },
    acceptAllTransferRequests: { type: Boolean, default: false },
    transferCoverageFollowsCompany: { type: Boolean, default: undefined },
    transferNotifyEmail: { type: String, default: "", trim: true },
  });
}
if (transferServicesPath?.schema && !transferServicesPath.schema.path("serviceAreas")) {
  transferServicesPath.schema.add({
    serviceAreas: {
      communityCodes: { type: [String], default: [] },
      provinceCodes: { type: [String], default: [] },
    },
  });
}

export default Company;
