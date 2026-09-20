/**
 * Single source of truth for how a car's specification rows are labelled,
 * formatted and grouped. Consumed by the catalog card (CarDetails) and by
 * CarDetailsModal so the two can never drift apart.
 *
 * Pure: takes the car document and an i18n `t` function, returns plain data.
 * Deposit is intentionally absent — it was removed from the public card.
 */

const capitalize = (value) => {
  if (typeof value !== "string" || !value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const isPresent = (value) =>
  value !== null && value !== undefined && value !== "";

const isNumeric = (value) => Number.isFinite(Number(value)) && value !== "";

/**
 * Spec group ids, exported so consumers can pick a subset without magic strings.
 */
export const CAR_SPEC_GROUPS = {
  HIGHLIGHTS: "highlights",
  VEHICLE: "vehicle",
  INSURANCE: "insurance",
};

/**
 * Kept deliberately short: this is the only group the catalog card shows
 * before the visitor expands the details, so it holds the four facts people
 * filter on. Doors and air conditioning live in the vehicle group.
 */
function buildHighlightItems(car, t) {
  return [
    {
      key: "class",
      label: t("car.class"),
      icon: "/icons/klass.png",
      value: capitalize(car?.class),
    },
    {
      key: "transmission",
      label: t("car.transmission"),
      icon: "/icons/transmission.png",
      value: capitalize(car?.transmission),
    },
    {
      key: "fueltype",
      label: t("car.fuel"),
      icon: "/icons/fuel.png",
      value: capitalize(car?.fueltype),
    },
    {
      key: "seats",
      label: t("car.seats"),
      icon: "/icons/seat.png",
      value: isPresent(car?.seats) ? String(car.seats) : "",
    },
  ];
}

function buildVehicleItems(car, t) {
  return [
    {
      key: "registration",
      label: t("car.reg-year"),
      icon: "/icons/registration.png",
      value: isPresent(car?.registration) ? String(car.registration) : "",
    },
    {
      key: "engine",
      label: t("car.engine"),
      icon: "/icons/engine.png",
      value: isPresent(car?.engine) ? `${capitalize(car.engine)} c.c.` : "",
    },
    {
      key: "enginePower",
      label: t("car.engine-pow"),
      icon: "/icons/engine_power.png",
      value: isNumeric(car?.enginePower) ? `${car.enginePower} bhp` : "",
    },
    {
      key: "numberOfDoors",
      label: t("car.doors"),
      icon: "/icons/doors2.png",
      value: isPresent(car?.numberOfDoors) ? String(car.numberOfDoors) : "",
    },
    {
      key: "airConditioning",
      label: t("car.air"),
      icon: "/icons/ac.png",
      value: car?.airConditioning ? t("car.yes") : t("car.no"),
    },
    {
      key: "color",
      label: t("car.color"),
      icon: "/icons/color.png",
      value: capitalize(car?.color),
    },
    {
      key: "regNumber",
      label: t("car.reg-numb"),
      icon: "/icons/regnumber.png",
      value: isPresent(car?.regNumber) ? String(car.regNumber) : "",
    },
  ];
}

function buildInsuranceItems(car, t) {
  const perDay = t("order.perDay");
  return [
    {
      // Label-only row: TPL is always included, there is no value to show.
      key: "insuranceTPLFree",
      label: t("car.insuranceTPLFree"),
      icon: "/icons/insurance_tpl.png",
      value: "",
      labelOnly: true,
    },
    {
      key: "PriceKacko",
      label: t("car.KackoPrice"),
      icon: "/icons/insurance_kasko.png",
      value: isNumeric(car?.PriceKacko) ? `${car.PriceKacko} € / ${perDay}` : "",
    },
    {
      key: "franchiseKacko",
      label: t("car.franchiseKacko"),
      icon: "/icons/franchise.png",
      value: isNumeric(car?.franchise) ? `${car.franchise} €` : "",
    },
    {
      key: "PriceChildSeats",
      label: t("car.childSeatsPrice"),
      icon: "/icons/childseat.png",
      value: isNumeric(car?.PriceChildSeats)
        ? `${car.PriceChildSeats} € / ${perDay}`
        : "",
    },
  ];
}

/**
 * @param {object} car   Car document (or lean object) from the API.
 * @param {Function} t   i18n translate function.
 * @returns {Array<{id: string, title: string, items: Array}>}
 *          Groups with empty-valued rows already filtered out. Groups with no
 *          remaining rows are dropped so callers never render an empty caption.
 */
export function buildCarSpecGroups(car, t) {
  const groups = [
    {
      id: CAR_SPEC_GROUPS.HIGHLIGHTS,
      title: t("car.specsAtAGlance"),
      items: buildHighlightItems(car, t),
    },
    {
      id: CAR_SPEC_GROUPS.VEHICLE,
      title: t("car.specsVehicle"),
      items: buildVehicleItems(car, t),
    },
    {
      id: CAR_SPEC_GROUPS.INSURANCE,
      title: t("car.specsInsurance"),
      items: buildInsuranceItems(car, t),
    },
  ];

  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.labelOnly || isPresent(item.value)),
    }))
    .filter((group) => group.items.length > 0);
}

/** Flat list of every spec row, in group order. */
export function buildCarSpecList(car, t) {
  return buildCarSpecGroups(car, t).flatMap((group) => group.items);
}
