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
    default: "Nea Kallikratia",
  },
  placeOut: {
    type: String,
    default: "Nea Kallikratia",
  },
  placeInDetail: {
    type: String,
    default: "",
  },
  placeOutDetail: {
    type: String,
    default: "",
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
    required: true,
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
    required: true,
  },
  email: {
    type: String,
    required: false, // исправлено на false, чтобы email был необязательным
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
  date: {
    type: Date,
    default: dayjs().tz("Europe/Athens").toDate(),
  },
  my_order: {
    type: Boolean,
    default: false,
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
  /** Secure image URLs (Cloudinary) for customer driving licence photos, optional. */
  drivingLicenceUrls: {
    type: [String],
    default: [],
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
});

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
    calculationEnd
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
          Boolean(this.secondDriver)
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
      Boolean(this.secondDriver)
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
    this.totalPrice = grandTotal;

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

export { OrderSchema, Order };
