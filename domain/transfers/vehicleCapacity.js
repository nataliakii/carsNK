/**
 * Recommend smallest vehicle category that fits passengers + luggage.
 */

/**
 * @param {object} req
 * @param {number} req.adults
 * @param {number} [req.childrenCount]
 * @param {number} [req.standardSuitcases]
 * @param {number} [req.cabinBags]
 * @param {number} [req.oversizedLuggage]
 * @param {string[]} [req.specialLuggageTypes]
 * @param {boolean} [req.needsAccessible]
 * @param {Array<object>} categories — TransferVehicleCategory docs
 */
export function selectVehicleCategory(req, categories) {
  const list = (Array.isArray(categories) ? categories : [])
    .filter((c) => c && c.isActive !== false)
    .slice()
    .sort(
      (a, b) =>
        (a.sort ?? 100) - (b.sort ?? 100) ||
        (a.maxPassengers || 0) - (b.maxPassengers || 0)
    );

  const pax =
    Number(req.adults || 0) +
    Number(req.childrenCount ?? ((req.children || []).length || 0));
  const suits = Number(req.standardSuitcases || 0);
  const cabin = Number(req.cabinBags || 0);
  const oversized = Number(req.oversizedLuggage || 0);
  const special = new Set(req.specialLuggageTypes || []);
  const needsAccessible =
    Boolean(req.needsAccessible) ||
    special.has("wheelchair") ||
    /wheelchair/i.test(String(req.accessibilityRequirements || ""));

  const fits = (cat) => {
    if (needsAccessible && cat.code !== "ACCESSIBLE_VEHICLE") {
      if (!(cat.requiredSupplierCapabilities || []).includes("wheelchair")) {
        return false;
      }
    }
    if ((cat.maxPassengers || 0) < pax) return false;
    if ((cat.standardLuggageCapacity || 0) < suits + oversized) return false;
    if ((cat.cabinLuggageCapacity || 0) < cabin) return false;
    for (const type of special) {
      if (type === "oversized") continue;
      const allowed = cat.allowedSpecialLuggage || [];
      if (allowed.length > 0 && !allowed.includes(type) && !allowed.includes("*")) {
        // empty allowed list = permissive for non-accessible specials
        if (["wheelchair"].includes(type) && cat.code !== "ACCESSIBLE_VEHICLE") {
          return false;
        }
      }
    }
    return true;
  };

  if (needsAccessible) {
    const accessible = list.find(
      (c) =>
        c.code === "ACCESSIBLE_VEHICLE" ||
        (c.requiredSupplierCapabilities || []).includes("wheelchair")
    );
    if (accessible && fits(accessible)) {
      return { ok: true, category: accessible, recommended: true };
    }
  }

  for (const cat of list) {
    if (fits(cat)) {
      return { ok: true, category: cat, recommended: true };
    }
  }

  return {
    ok: false,
    message: "No vehicle category can accommodate the requested passengers and luggage",
    code: "capacity",
  };
}

export function validateCategoryCapacity(category, req) {
  if (!category) {
    return { ok: false, message: "Vehicle category required", code: "category" };
  }
  const result = selectVehicleCategory(req, [category]);
  if (!result.ok) return result;
  return { ok: true, category };
}
