import mongoose from "mongoose";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { Car } from "./car";
import { PriceBreakdown } from "./PriceBreakdown";
import { getBusinessRentalDaysByMinutes } from "@/domain/orders/numberOfDays";
import { buildDeliveryBreakdownSlice } from "@/domain/delivery/buildDeliveryBreakdownSlice";
import { ORDER_STATUS } from "@/domain/orders/orderStatus";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.utc();

const OrderSchema = new mongoose.Schema({
  rentalStartDate: {
    type: Date,
    required: true,
    set: (value) => dayjs(value).utc().toDate(),
  },
  rentalEndDate: {
    type: Date,
    required: true,
    set: (value) => dayjs(value).utc().toDate(),
  },
  timeIn: {
    type: Date,
    default: function () {
      if (this.rentalStartDate) {
        return dayjs(this.rentalStartDate).hour(12).minute(0).utc().toDate();
      }
      return null;
    },
  },
  timeOut: {
    type: Date,
    default: function () {
      if (this.rentalEndDate) {
        return dayjs(this.rentalEndDate).hour(10).minute(0).utc().toDate();
      }
      return null;
    },
  },
  placeIn: {
    type: String,
    default: "",
  },
  placeOut: {
    type: String,
    default: "",
  },
  placeInDetail: {
    type: String,
    default: "",
  },
  placeOutDetail: {
    type: String,
    default: "",
  },
  pickupMethod: {
    type: String,
    default: "",
    trim: true,
  },
  locationSnapshot: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  returnMethod: {
    type: String,
    default: "",
    trim: true,
  },
  /** If both set, delivery uses these amounts (€); otherwise zones + company €/km */
  deliveryInOverride: {
    type: Number,
    default: null,
    min: 0,
  },
  deliveryOutOverride: {
    type: Number,
    default: null,
    min: 0,
  },
  customerName: {
    type: String,
    default: "",
    // Online bookings require a name; offline/admin stubs may leave it empty.
    required: function requiredCustomerName() {
      return !this.offline;
    },
  },
  carNumber: {
    type: String,
    required: true,
  },
  regNumber: {
    type: String,
    default: "",
  },
  confirmed: {
    type: Boolean,
    default: false,
  },
  /** Partner response from company notification email (not the same as confirmed). */
  companyEmailDecision: {
    type: String,
    enum: ["accepted", "rejected"],
    default: undefined,
  },
  companyEmailDecisionAt: {
    type: Date,
    default: null,
  },
  partnerConfirmedAt: { type: Date, default: null },
  partnerConfirmedByEmail: { type: String, default: "" },
  /** Supplier vehicle confirmation. CONFIRMED or SUPPLIER_DECLINED. Not a Rovaro confirmation. */
  supplierResponse: { type: String, default: "" },
  confirmedAt: { type: Date, default: null },
  confirmedBy: { type: String, default: "" },
  confirmedVehicleId: { type: String, default: "" },
  /** Set only by a verified Stripe Booking Fee webhook. */
  customerConfirmation: { type: String, default: "" },
  bookingFeePaymentStatus: { type: String, default: "" },
  /** SUPPLIER or ROVARO. A problem counts as a company action only when SUPPLIER. */
  problemAssignedTo: { type: String, default: "" },
  pendingReplacementProposal: { type: mongoose.Schema.Types.Mixed, default: null },
  replacementDisclosure: { type: String, default: "" },
  replacementProposalAcceptedChecksum: { type: String, default: "" },
  replacementProposalAcceptedVersion: { type: Number, default: null },
  replacementProposalAcceptedOfferId: { type: String, default: "" },
  replacementProposalAcceptedAt: { type: Date, default: null },
  /**
   * Customer refused the proposed replacement by replying to Rovaro. Recorded
   * by a superadmin; moves the booking into the manual queue and stops every
   * automatic customer email until a new proposal is sent by hand.
   */
  replacementObjection: { type: mongoose.Schema.Types.Mixed, default: null },
  partnerConfirmMeta: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  declineReason: { type: String, default: "" },
  declinedAt: { type: Date, default: null },
  declinedByEmail: { type: String, default: "" },
  declineMeta: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  status: {
    type: String,
    enum: [ORDER_STATUS.ACTIVE, ORDER_STATUS.PAID_AND_CLOSED],
    default: ORDER_STATUS.ACTIVE,
    index: true,
  },
  IsConfirmedEmailSent: {
    type: Boolean,
    default: false,
  },
  confirmationEmailHistory: {
    type: [
      {
        sentAt: {
          type: Date,
          default: Date.now,
        },
        sentTo: {
          type: String,
          default: "",
        },
        cc: {
          type: String,
          default: "",
        },
        locale: {
          type: String,
          default: "en",
        },
        sentBy: {
          id: {
            type: String,
            default: "",
          },
          name: {
            type: String,
            default: "",
          },
          email: {
            type: String,
            default: "",
          },
          role: {
            type: String,
            default: "",
          },
        },
        snapshot: {
          rentalStartDate: {
            type: Date,
            default: null,
          },
          rentalEndDate: {
            type: Date,
            default: null,
          },
          timeIn: {
            type: Date,
            default: null,
          },
          timeOut: {
            type: Date,
            default: null,
          },
          totalPrice: {
            type: Number,
            default: null,
          },
          overridePrice: {
            type: Number,
            default: null,
          },
          effectiveTotalPrice: {
            type: Number,
            default: null,
          },
        },
        changesSincePrevious: {
          hasPrevious: {
            type: Boolean,
            default: false,
          },
          hasChanges: {
            type: Boolean,
            default: false,
          },
          price: {
            changed: {
              type: Boolean,
              default: false,
            },
            old: {
              type: Number,
              default: null,
            },
            new: {
              type: Number,
              default: null,
            },
          },
          dates: {
            changed: {
              type: Boolean,
              default: false,
            },
            oldStartDate: {
              type: Date,
              default: null,
            },
            newStartDate: {
              type: Date,
              default: null,
            },
            oldEndDate: {
              type: Date,
              default: null,
            },
            newEndDate: {
              type: Date,
              default: null,
            },
          },
          times: {
            changed: {
              type: Boolean,
              default: false,
            },
            oldTimeIn: {
              type: Date,
              default: null,
            },
            newTimeIn: {
              type: Date,
              default: null,
            },
            oldTimeOut: {
              type: Date,
              default: null,
            },
            newTimeOut: {
              type: Date,
              default: null,
            },
          },
        },
      },
    ],
    default: [],
  },
  hasConflictDates: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "Order",
    default: [],
  },
  phone: {
    type: String,
    default: "",
    // Online bookings require a phone; offline/admin stubs may leave it empty.
    required: function requiredPhone() {
      return !this.offline;
    },
  },
  email: {
    type: String,
    required: false, // legacy/offline stubs; customer creates require email at the API
  },
  secondDriver: {
    type: Boolean,
    default: false,
  },
  Viber: {
    type: Boolean,
    default: false,
  },
  Whatsapp: {
    type: Boolean,
    default: false,
  },
  Telegram: {
    type: Boolean,
    default: false,
  },
  numberOfDays: {
    type: Number,
  },
  /**
   * totalPrice
   * Auto-calculated rental price based on car, dates, and options.
   * This value is ALWAYS preserved as the real calculated price.
   * Never manually overridden - use OverridePrice for manual pricing.
   */
  totalPrice: {
    type: Number,
    required: true,
  },
  /**
   * OverridePrice
   * Manual price entered by admin/superadmin.
   * If set, it overrides totalPrice in UI and payments.
   * Set to null to return to automatic pricing.
   * 
   * Rules:
   * - OverridePrice NEVER changes automatically
   * - When rental params change, totalPrice recalculates but OverridePrice stays
   * - Admin must explicitly reset OverridePrice to return to auto pricing
   */
  OverridePrice: {
    type: Number,
    default: null,
  },
  carModel: {
    type: String,
    required: true,
  },
  car: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Car",
    required: true,
  },
  /** Partner firm (Company._id) — denormalized from car.ownerId for admin scoping. */
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    default: null,
    index: true,
  },
  date: {
    type: Date,
    default: dayjs().tz("Europe/Athens").toDate(),
  },
  my_order: {
    type: Boolean,
    default: false,
  },
  /**
   * Immutable commercial source. New records must set this explicitly.
   * PLATFORM = public Rovaro booking. INTERNAL = company calendar.
   * Legacy rows may omit it; readers fall back to proven `my_order` only
   * when that flag is a real boolean and does not conflict.
   */
  source: {
    type: String,
    enum: ["PLATFORM", "INTERNAL"],
    index: true,
  },
  /** Internal calendar rows block the car unless this is explicitly false. */
  blocksAvailability: {
    type: Boolean,
    default: true,
  },
  /**
   * Offline booking: reserved outside the website (phone / WhatsApp / etc.).
   * Blocks dates like a confirmed order; shown with a distinct calendar style.
   */
  offline: {
    type: Boolean,
    default: false,
    index: true,
  },
  /**
   * Role of admin who created this order:
   * 0 = regular admin (default)
   * 1 = superadmin
   * 
   * Used for permission control:
   * - If my_order=true OR createdByRole=1, only superadmin can edit/delete
   */
  createdByRole: {
    type: Number,
    enum: [0, 1],
    default: 0,
  },
  /**
   * ID of admin who created this order (optional tracking)
   */
  createdByAdminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  ChildSeats: {
    type: Number,
    default: 0,
  },
  // 🔧 TEMPORARY: Support old field name during migration
  // This will be removed after migration is complete
  childSeats: {
    type: Number,
    default: 0,
    select: false, // Don't include in queries by default
  },
  insurance: {
    type: String,
    default: "TPL", // "TPL", "CDW"
  },
  franchiseOrder: {
    type: Number,
    default: 0,
  },
  orderNumber: {
    type: String,
    required: true,
    unique: true,
  },
  /**
   * Customer-safe booking reference (RVR-XXXXX). Server-generated, immutable,
   * unique. Not derived from _id, orderNumber, or a counter. Absent on
   * historical rows — assigned for new platform orders and lazily when a
   * current order enters the paid-email flow.
   */
  publicReference: { type: String },
  /**
   * Opaque customer booking-page credential. Only the hash is stored.
   * scope is customer_booking_read. Raw tokens are never persisted.
   */
  customerBookingAccess: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  /**
   * Immutable money snapshot: fee rate, total, Booking Fee, supplier balance,
   * currency, calculation version. Paid rows are not repriced from later
   * configuration changes.
   */
  bookingFinancialSnapshot: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  flightNumber: {
    type: String,
    default: "",
  },
  // Client context captured at booking creation time
  clientLang: {
    type: String,
    default: "",
  },
  clientIP: {
    type: String,
    default: "",
  },
  clientCountry: {
    type: String,
    default: "",
  },
  clientRegion: {
    type: String,
    default: "",
  },
  clientCity: {
    type: String,
    default: "",
  },
  /** True if booking was submitted while the site was opened on localhost (dev). Used for [TEST] in emails/Telegram. */
  fromLocalhost: {
    type: Boolean,
    default: false,
  },
  /**
   * Clickwrap at booking: platform (Rovaro) terms + company rental rules.
   * Public orders store the checksum/hash of the text the customer accepted.
   */
  termsAcceptance: {
    type: new mongoose.Schema(
      {
        platform: {
          accepted: { type: Boolean, default: false },
          acceptedAt: { type: Date, default: null },
          documentType: { type: String, default: "" },
          version: { type: Number, default: 0 },
          checksum: { type: String, default: "" },
          language: { type: String, default: "" },
        },
        company: {
          accepted: { type: Boolean, default: false },
          acceptedAt: { type: Date, default: null },
          sourceHash: { type: String, default: "" },
          language: { type: String, default: "" },
          documentId: { type: String, default: "" },
          version: { type: Number, default: 0 },
          checksum: { type: String, default: "" },
        },
        privacy: {
          presented: { type: Boolean, default: false },
          contractualCheckbox: { type: Boolean, default: false },
          presentedAt: { type: Date, default: null },
          documentType: { type: String, default: "" },
          version: { type: Number, default: 0 },
          checksum: { type: String, default: "" },
          language: { type: String, default: "" },
        },
      },
      { _id: false }
    ),
    default: undefined,
  },
  /**
   * Immutable commercial + legal refs for the booking. Prefer version/checksum
   * references over copying full document bodies.
   */
  legalSnapshot: {
    type: mongoose.Schema.Types.Mixed,
    default: undefined,
  },
  /** Secure image URLs (Cloudinary) for customer driving licence photos, optional. */
  drivingLicenceUrls: {
    type: [String],
    default: [],
  },
  /**
   * When the retention job erased the driving licence images. Distinguishes
   * "deleted under the retention policy" from "never uploaded".
   */
  drivingLicencePurgedAt: {
    type: Date,
    default: null,
  },
  /**
   * pricingDrift — tracks pricing-input changes on confirmed orders.
   *
   * When an order is confirmed, its price is frozen (PriceBreakdown gets frozenAt).
   * If pricing-affecting fields are later changed without recalculating,
   * this object records { fieldName: { frozen: <old>, current: <new> } }.
   *
   * null = no drift (price matches inputs).
   * Cleared on unconfirm (price recalculates).
   */
  pricingDrift: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },

  bookingMode: { type: String, default: undefined },
  countryCode: { type: String, default: "", uppercase: true, trim: true },
  currency: { type: String, default: "", uppercase: true, trim: true },
  timezone: { type: String, default: "", trim: true },
  pickupAtUtc: { type: Date, default: null },
  returnAtUtc: { type: Date, default: null },
  localPickup: {
    date: { type: String, default: "" },
    time: { type: String, default: "" },
  },
  localReturn: {
    date: { type: String, default: "" },
    time: { type: String, default: "" },
  },
  /** Future FSM snapshot — optional; see domain/booking/bookingStatus.js */
  bookingStatus: { type: String, default: undefined },
  /** Set when the booking enters COMPLETION_PENDING. The 24h grace starts here. */
  completionPendingAt: { type: Date, default: null },
  /** Company or authorised customer reported a problem. Stops auto-completion. */
  hasProblem: { type: Boolean, default: false },
  problemReportedAt: { type: Date, default: null },
  problemReportedBy: { type: String, default: "" },
  /**
   * Supplier recorded that the customer paid the remaining rental amount
   * to the company. Never set by the Stripe Booking Fee webhook.
   */
  supplierRemainingPaidAt: { type: Date, default: null },
  pricingVersion: { type: Number, default: null },
  priceCalculatedAt: { type: Date, default: null },
  /**
   * Server-authoritative minor-unit breakdown. Complements PriceBreakdown
   * (legacy major-unit doc); does not replace it.
   */
  authoritativePrice: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  /**
   * Online / on-site payment snapshot (Stripe Checkout for prepayment).
   * Uses Mixed for HMR-safe evolution; shape mirrors Transfer.payment.
   */
  payment: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  /** Immutable original marketplace request, captured before an accepted alternative mutates operational fields. */
  originalRequestSnapshot: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  acceptedAlternativeOfferId: { type: String, default: "" },
  /** Append-only marketplace gross revisions. Original paid snapshot is never overwritten. */
  priceRevisions: {
    type: mongoose.Schema.Types.Mixed,
    default: [],
  },
  paidMarketplaceFeeSnapshot: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
});

OrderSchema.index(
  { publicReference: 1 },
  {
    unique: true,
    partialFilterExpression: { publicReference: { $type: "string", $gt: "" } },
  }
);

function buildHistoryEntry(breakdown) {
  const entry = { ...breakdown };
  delete entry._id;
  delete entry.__v;
  delete entry.history;
  delete entry.order;
  entry.savedAt = entry.updatedAt || entry.createdAt || new Date();
  delete entry.createdAt;
  delete entry.updatedAt;
  return entry;
}

OrderSchema.pre("save", async function (next) {
  // If childSeats exists but ChildSeats doesn't, copy value
  if (this.childSeats !== undefined && this.ChildSeats === undefined) {
    this.ChildSeats = this.childSeats;
  }
  // Always use ChildSeats for calculations
  const childSeatsValue = this.ChildSeats ?? this.childSeats ?? 0;
  
  const calculationStart = this.timeIn ?? this.rentalStartDate;
  const calculationEnd = this.timeOut ?? this.rentalEndDate;
  this.numberOfDays = getBusinessRentalDaysByMinutes(
    calculationStart,
    calculationEnd,
    this.timezone
  );

  // ─── CONFIRMING (transitioning TO confirmed) ───
  if (this.confirmed === true && this.isModified("confirmed")) {
    try {
      const existingBD = await PriceBreakdown.findOne({ order: this._id }).lean();
      if (existingBD) {
        const historyEntry = buildHistoryEntry(existingBD);
        await PriceBreakdown.findOneAndUpdate(
          { order: this._id },
          {
            $set: { frozenAt: new Date(), source: "confirmation" },
            $push: { history: historyEntry },
          }
        );
      }
    } catch (err) {
      console.error("[Order pre-save] Failed to set frozenAt:", err);
    }
    const car = await Car.findById(this.car);
    if (car) {
      this.carNumber = car.carNumber;
      this.regNumber = car.regNumber || "";
      this.carModel = car.model;
    }
    return next();
  }

  // ─── UNCONFIRMING (transitioning FROM confirmed) ───
  if (this.isModified("confirmed") && this.confirmed === false) {
    this.pricingDrift = null;
  }

  // ─── EXISTING ORDER: NEVER auto-recalculate price ───
  // Price changes only when admin explicitly clicks "Recalculate" (sends new totalPrice).
  // rateChanged on the frontend is just a notification.
  if (!this.isNew && !this.isModified("confirmed")) {
    const car = await Car.findById(this.car);
    if (car) {
      this.carNumber = car.carNumber;
      this.regNumber = car.regNumber || "";
      this.carModel = car.model;
    }

    const deliveryRelatedChanged =
      this.isModified("placeIn") ||
      this.isModified("placeOut") ||
      this.isModified("deliveryInOverride") ||
      this.isModified("deliveryOutOverride");

    // Full breakdown refresh when admin sent a new totalPrice (recalculate).
    if (this.isModified("totalPrice") && car && this._id) {
      try {
        const { breakdown } = await car.calculateTotalRentalPricePerDay(
          calculationStart,
          calculationEnd,
          this.insurance,
          childSeatsValue,
          Boolean(this.secondDriver),
          this.timezone
        );

        let deliveryData = {};
        try {
          deliveryData = await buildDeliveryBreakdownSlice(this);
        } catch (err) {
          console.error("[Order pre-save] delivery calc error:", err);
        }

        const source = this.confirmed ? "admin_edit_confirmed" : "admin_edit";
        const existingBreakdown = await PriceBreakdown.findOne({ order: this._id }).lean();
        const newBreakdownData = {
          order: this._id,
          totalPrice: this.totalPrice,
          ...breakdown,
          ...deliveryData,
          source,
          frozenAt: this.confirmed ? new Date() : null,
        };

        if (existingBreakdown) {
          await PriceBreakdown.findOneAndUpdate(
            { order: this._id },
            {
              $set: newBreakdownData,
              $push: { history: buildHistoryEntry(existingBreakdown) },
            },
            { new: true }
          );
        } else {
          await PriceBreakdown.findOneAndUpdate(
            { order: this._id },
            { $set: { ...newBreakdownData, history: [] } },
            { upsert: true, new: true }
          );
        }
      } catch (err) {
        console.error("[Order pre-save] Failed to save PriceBreakdown:", err);
      }
    } else if (deliveryRelatedChanged && car && this._id) {
      try {
        const existingBreakdown = await PriceBreakdown.findOne({ order: this._id }).lean();
        if (existingBreakdown) {
          const deliveryData = await buildDeliveryBreakdownSlice(this);
          const oldDel =
            (existingBreakdown.deliveryIn || 0) + (existingBreakdown.deliveryOut || 0);
          const newDel = deliveryData.deliveryTotal || 0;
          const same =
            oldDel === newDel &&
            (existingBreakdown.placeIn || "") === (deliveryData.placeIn || "") &&
            (existingBreakdown.placeOut || "") === (deliveryData.placeOut || "");

          if (!same) {
            await PriceBreakdown.findOneAndUpdate(
              { order: this._id },
              {
                $set: {
                  deliveryIn: deliveryData.deliveryIn,
                  deliveryOut: deliveryData.deliveryOut,
                  deliveryTotal: deliveryData.deliveryTotal,
                  deliveryPricePerKm: deliveryData.deliveryPricePerKm,
                  placeIn: deliveryData.placeIn,
                  placeOut: deliveryData.placeOut,
                },
                $push: { history: buildHistoryEntry(existingBreakdown) },
              }
            );

            if (this.OverridePrice == null) {
              this.totalPrice = (this.totalPrice || 0) + (newDel - oldDel);
            }
          }
        }
      } catch (err) {
        console.error("[Order pre-save] delivery-only sync error:", err);
      }
    }

    return next();
  }

  // ─── NEW ORDER: calculate price and create PriceBreakdown ───
  const car = await Car.findById(this.car);

  if (car) {
    this.carNumber = car.carNumber;
    this.regNumber = car.regNumber || "";
    this.carModel = car.model;

    const { total, breakdown } = await car.calculateTotalRentalPricePerDay(
      calculationStart,
      calculationEnd,
      this.insurance,
      childSeatsValue,
      Boolean(this.secondDriver),
      this.timezone
    );

    let deliveryData = {};
    try {
      deliveryData = await buildDeliveryBreakdownSlice(this);
    } catch (err) {
      console.error("[Order pre-save] Failed to calculate delivery:", err);
    }

    const deliveryTotal = Number(deliveryData.deliveryTotal);
    const normalizedDeliveryTotal = Number.isFinite(deliveryTotal)
      ? deliveryTotal
      : 0;
    const grandTotal = Math.round((total + normalizedDeliveryTotal) * 100) / 100;
    if (
      this.authoritativePrice &&
      Number.isFinite(Number(this.authoritativePrice.grossMinor))
    ) {
      this.totalPrice =
        Number(this.authoritativePrice.grossMinor) / 100;
    } else {
      this.totalPrice = grandTotal;
    }

    if (breakdown && this._id) {
      try {
        const source = this.my_order ? "client_booking" : "admin_creation";

        const newBreakdownData = {
          order: this._id,
          totalPrice: grandTotal,
          ...breakdown,
          ...deliveryData,
          source,
          frozenAt: null,
        };

        await PriceBreakdown.findOneAndUpdate(
          { order: this._id },
          { $set: { ...newBreakdownData, history: [] } },
          { upsert: true, new: true }
        );
      } catch (err) {
        console.error("[Order pre-save] Failed to save PriceBreakdown:", err);
      }
    }
  }

  next();
});

// 🔧 MIGRATION SUPPORT: After loading, sync childSeats to ChildSeats if needed
OrderSchema.post("init", function () {
  if (this.childSeats !== undefined && (this.ChildSeats === undefined || this.ChildSeats === 0)) {
    this.ChildSeats = this.childSeats;
  }
});

const Order = mongoose.models?.Order || mongoose.model("Order", OrderSchema);

// HMR/cache safety: ensure secondDriver path exists on cached model schema.
if (Order?.schema && !Order.schema.path("secondDriver")) {
  Order.schema.add({
    secondDriver: {
      type: Boolean,
      default: false,
    },
  });
}

// HMR/cache safety: ensure IsConfirmedEmailSent exists on cached model schema.
if (Order?.schema && !Order.schema.path("IsConfirmedEmailSent")) {
  Order.schema.add({
    IsConfirmedEmailSent: {
      type: Boolean,
      default: false,
    },
  });
}

// HMR/cache safety: ensure confirmationEmailHistory exists on cached model schema.
if (Order?.schema && !Order.schema.path("confirmationEmailHistory")) {
  Order.schema.add({
    confirmationEmailHistory: {
      type: Array,
      default: [],
    },
  });
}

// HMR/cache safety: ensure regNumber exists on cached model schema.
if (Order?.schema && !Order.schema.path("regNumber")) {
  Order.schema.add({
    regNumber: {
      type: String,
      default: "",
    },
  });
}

// HMR/cache safety: ensure pricingDrift exists on cached model schema.
if (Order?.schema && !Order.schema.path("pricingDrift")) {
  Order.schema.add({
    pricingDrift: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  });
}

// HMR/cache safety: ensure status exists on cached model schema.
if (Order?.schema && !Order.schema.path("status")) {
  Order.schema.add({
    status: {
      type: String,
      enum: [ORDER_STATUS.ACTIVE, ORDER_STATUS.PAID_AND_CLOSED],
      default: ORDER_STATUS.ACTIVE,
    },
  });
}

// HMR/cache safety: driving licence URLs on cached schema.
if (Order?.schema && !Order.schema.path("drivingLicenceUrls")) {
  Order.schema.add({
    drivingLicenceUrls: {
      type: [String],
      default: [],
    },
  });
}

if (Order?.schema && !Order.schema.path("completionPendingAt")) {
  Order.schema.add({
    completionPendingAt: { type: Date, default: null },
    hasProblem: { type: Boolean, default: false },
    problemReportedAt: { type: Date, default: null },
    problemReportedBy: { type: String, default: "" },
    supplierRemainingPaidAt: { type: Date, default: null },
  });
}

if (Order?.schema && !Order.schema.path("drivingLicencePurgedAt")) {
  Order.schema.add({
    drivingLicencePurgedAt: {
      type: Date,
      default: null,
    },
  });
}

if (Order?.schema && !Order.schema.path("companyEmailDecision")) {
  Order.schema.add({
    companyEmailDecision: {
      type: String,
      enum: ["accepted", "rejected"],
    },
    companyEmailDecisionAt: {
      type: Date,
      default: null,
    },
  });
}

if (Order?.schema && !Order.schema.path("supplierResponse")) {
  Order.schema.add({
    supplierResponse: { type: String, default: "" },
    confirmedAt: { type: Date, default: null },
    confirmedBy: { type: String, default: "" },
    confirmedVehicleId: { type: String, default: "" },
    customerConfirmation: { type: String, default: "" },
    bookingFeePaymentStatus: { type: String, default: "" },
    problemAssignedTo: { type: String, default: "" },
    pendingReplacementProposal: { type: mongoose.Schema.Types.Mixed, default: null },
    replacementDisclosure: { type: String, default: "" },
    replacementProposalAcceptedChecksum: { type: String, default: "" },
    replacementProposalAcceptedVersion: { type: Number, default: null },
    replacementProposalAcceptedOfferId: { type: String, default: "" },
    replacementProposalAcceptedAt: { type: Date, default: null },
    replacementObjection: { type: mongoose.Schema.Types.Mixed, default: null },
  });
}

if (Order?.schema && !Order.schema.path("partnerConfirmedAt")) {
  Order.schema.add({
    partnerConfirmedAt: { type: Date, default: null },
    partnerConfirmedByEmail: { type: String, default: "" },
    partnerConfirmMeta: { type: mongoose.Schema.Types.Mixed, default: null },
    declineReason: { type: String, default: "" },
    declinedAt: { type: Date, default: null },
    declinedByEmail: { type: String, default: "" },
    declineMeta: { type: mongoose.Schema.Types.Mixed, default: null },
  });
}

if (Order?.schema && !Order.schema.path("publicReference")) {
  Order.schema.add({
    publicReference: { type: String },
    customerBookingAccess: { type: mongoose.Schema.Types.Mixed, default: null },
    bookingFinancialSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
  });
  Order.schema.index(
    { publicReference: 1 },
    {
      unique: true,
      partialFilterExpression: { publicReference: { $type: "string", $gt: "" } },
    }
  );
}

if (Order?.schema && !Order.schema.path("pickupMethod")) {
  Order.schema.add({
    pickupMethod: { type: String, default: "", trim: true },
    returnMethod: { type: String, default: "", trim: true },
  });
}

if (Order?.schema && !Order.schema.path("authoritativePrice")) {
  Order.schema.add({
    bookingMode: { type: String },
    countryCode: { type: String, default: "", uppercase: true, trim: true },
    currency: { type: String, default: "", uppercase: true, trim: true },
    timezone: { type: String, default: "", trim: true },
    pickupAtUtc: { type: Date, default: null },
    returnAtUtc: { type: Date, default: null },
    localPickup: {
      date: { type: String, default: "" },
      time: { type: String, default: "" },
    },
    localReturn: {
      date: { type: String, default: "" },
      time: { type: String, default: "" },
    },
    bookingStatus: { type: String },
    pricingVersion: { type: Number, default: null },
    priceCalculatedAt: { type: Date, default: null },
    authoritativePrice: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    payment: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    originalRequestSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    acceptedAlternativeOfferId: { type: String, default: "" },
  });
}

if (Order?.schema && !Order.schema.path("priceRevisions")) {
  Order.schema.add({
    priceRevisions: { type: mongoose.Schema.Types.Mixed, default: [] },
    paidMarketplaceFeeSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
  });
}

// Mirror mutations for cars that live on the old Natali cluster.
function attachOldDbMirrorHooks(schema) {
  if (!schema || schema.__oldDbMirrorAttached) return;
  schema.__oldDbMirrorAttached = true;

  const mirrorUpsert = (doc) => {
    if (!doc) return;
    import("@/domain/sync/oldOrdersSync")
      .then(({ mirrorOrderToOldDb }) => mirrorOrderToOldDb(doc))
      .catch((err) => {
        console.error("[Order mirror] upsert:", err?.message || err);
      });
  };

  const mirrorDelete = (doc) => {
    if (!doc?._id) return;
    import("@/domain/sync/oldOrdersSync")
      .then(({ mirrorOrderDeleteToOldDb }) =>
        mirrorOrderDeleteToOldDb(doc._id, doc.car)
      )
      .catch((err) => {
        console.error("[Order mirror] delete:", err?.message || err);
      });
  };

  schema.post("save", function (doc) {
    mirrorUpsert(doc);
  });

  schema.post("findOneAndUpdate", function (doc) {
    mirrorUpsert(doc);
  });

  schema.post("findOneAndDelete", function (doc) {
    mirrorDelete(doc);
  });
}

attachOldDbMirrorHooks(OrderSchema);
if (Order?.schema) attachOldDbMirrorHooks(Order.schema);

export { OrderSchema, Order };
