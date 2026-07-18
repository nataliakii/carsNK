const {
  resolveOrderSnapshotForSave,
  prepareApplyQuotedDeliveryGrandSave,
} = require("../applyQuotedDeliveryGrandSave");

const baseOrder = {
  _id: "ord1",
  totalPrice: 100,
  OverridePrice: 999,
};

const breakdownWithRentalAndDelivery = {
  dailyRates: [],
  baseRentalTotal: 200,
  kaskoTotal: 10,
  childSeatsTotal: 5,
  secondDriverTotal: 0,
  deliveryIn: 15,
  deliveryOut: 15,
  deliveryTotal: 30,
};

const permsOk = {
  totalPrice: true,
  deliveryInOverride: true,
};

describe("resolveOrderSnapshotForSave", () => {
  test("returns orderOverride when provided", () => {
    const override = { ...baseOrder, totalPrice: 250 };
    expect(
      resolveOrderSnapshotForSave(baseOrder, { orderOverride: override })
    ).toBe(override);
  });

  test("returns editedOrder when saveOptions empty", () => {
    expect(resolveOrderSnapshotForSave(baseOrder, {})).toBe(baseOrder);
  });

  test("returns editedOrder when first arg is event-like (no orderOverride)", () => {
    const fakeEvent = { type: "click", nativeEvent: {} };
    expect(resolveOrderSnapshotForSave(baseOrder, fakeEvent)).toBe(baseOrder);
  });

  test("returns editedOrder when orderOverride is explicitly undefined", () => {
    expect(
      resolveOrderSnapshotForSave(baseOrder, { orderOverride: undefined })
    ).toBe(baseOrder);
  });
});

describe("prepareApplyQuotedDeliveryGrandSave", () => {
  test("silent when viewOnly", () => {
    expect(
      prepareApplyQuotedDeliveryGrandSave({
        editedOrder: baseOrder,
        manualDeliveryIn: "10",
        manualDeliveryOut: "10",
        priceBreakdown: breakdownWithRentalAndDelivery,
        viewOnly: true,
        fieldPermissions: permsOk,
      })
    ).toEqual({ kind: "silent" });
  });

  test("silent when no editedOrder", () => {
    expect(
      prepareApplyQuotedDeliveryGrandSave({
        editedOrder: null,
        manualDeliveryIn: "10",
        manualDeliveryOut: "10",
        priceBreakdown: breakdownWithRentalAndDelivery,
        viewOnly: false,
        fieldPermissions: permsOk,
      })
    ).toEqual({ kind: "silent" });
  });

  test("error when no totalPrice permission", () => {
    const r = prepareApplyQuotedDeliveryGrandSave({
      editedOrder: baseOrder,
      manualDeliveryIn: "1",
      manualDeliveryOut: "1",
      priceBreakdown: breakdownWithRentalAndDelivery,
      viewOnly: false,
      fieldPermissions: { ...permsOk, totalPrice: false },
    });
    expect(r.kind).toBe("error");
    expect(r.message).toMatch(/сумму заказа/);
  });

  test("error when no delivery permission", () => {
    const r = prepareApplyQuotedDeliveryGrandSave({
      editedOrder: baseOrder,
      manualDeliveryIn: "1",
      manualDeliveryOut: "1",
      priceBreakdown: breakdownWithRentalAndDelivery,
      viewOnly: false,
      fieldPermissions: { ...permsOk, deliveryInOverride: false },
    });
    expect(r.kind).toBe("error");
    expect(r.message).toMatch(/доставку/);
  });

  test("error when one delivery field empty", () => {
    const r = prepareApplyQuotedDeliveryGrandSave({
      editedOrder: baseOrder,
      manualDeliveryIn: "10",
      manualDeliveryOut: "   ",
      priceBreakdown: breakdownWithRentalAndDelivery,
      viewOnly: false,
      fieldPermissions: permsOk,
    });
    expect(r.kind).toBe("error");
    expect(r.message).toMatch(/оба поля/);
  });

  test("error when priceBreakdown missing", () => {
    const r = prepareApplyQuotedDeliveryGrandSave({
      editedOrder: baseOrder,
      manualDeliveryIn: "10",
      manualDeliveryOut: "10",
      priceBreakdown: null,
      viewOnly: false,
      fieldPermissions: permsOk,
    });
    expect(r.kind).toBe("error");
    expect(r.message).toMatch(/разбивки/);
  });

  test("error when rental subtotal is zero", () => {
    const r = prepareApplyQuotedDeliveryGrandSave({
      editedOrder: baseOrder,
      manualDeliveryIn: "10",
      manualDeliveryOut: "10",
      priceBreakdown: {
        ...breakdownWithRentalAndDelivery,
        baseRentalTotal: 0,
        kaskoTotal: 0,
        childSeatsTotal: 0,
        secondDriverTotal: 0,
      },
      viewOnly: false,
      fieldPermissions: permsOk,
    });
    expect(r.kind).toBe("error");
    expect(r.message).toMatch(/аренда/);
  });

  test("ok: grand = rental + delivery, clears OverridePrice", () => {
    const r = prepareApplyQuotedDeliveryGrandSave({
      editedOrder: baseOrder,
      manualDeliveryIn: "15",
      manualDeliveryOut: "15",
      priceBreakdown: breakdownWithRentalAndDelivery,
      viewOnly: false,
      fieldPermissions: permsOk,
    });
    expect(r.kind).toBe("ok");
    expect(r.grand).toBe(200 + 10 + 5 + 30);
    expect(r.orderOverride._id).toBe(baseOrder._id);
    expect(r.orderOverride.totalPrice).toBe(r.grand);
    expect(r.orderOverride.OverridePrice).toBeNull();
  });

  test("manual strings trimmed (whitespace only fails)", () => {
    const r = prepareApplyQuotedDeliveryGrandSave({
      editedOrder: baseOrder,
      manualDeliveryIn: "  1 ",
      manualDeliveryOut: " 2 ",
      priceBreakdown: breakdownWithRentalAndDelivery,
      viewOnly: false,
      fieldPermissions: permsOk,
    });
    expect(r.kind).toBe("ok");
  });
});
