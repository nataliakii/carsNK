const {
  sumRentalSubtotalFromPriceBreakdown,
  grandTotalFromPriceBreakdown,
} = require("../orderPriceHelpers");

describe("orderPriceHelpers (delivery + rental totals)", () => {
  const bd = {
    baseRentalTotal: 100,
    kaskoTotal: 20,
    childSeatsTotal: 5,
    secondDriverTotal: 3,
    deliveryIn: 10,
    deliveryOut: 12,
    deliveryTotal: 22,
  };

  test("sumRentalSubtotalFromPriceBreakdown sums rental line items only", () => {
    expect(sumRentalSubtotalFromPriceBreakdown(bd)).toBe(128);
  });

  test("grandTotalFromPriceBreakdown adds deliveryTotal", () => {
    expect(grandTotalFromPriceBreakdown(bd)).toBe(150);
  });

  test("null breakdown: sum rental is 0, grand is null", () => {
    expect(sumRentalSubtotalFromPriceBreakdown(null)).toBe(0);
    expect(grandTotalFromPriceBreakdown(null)).toBeNull();
  });

  test("coerces string numbers and missing fields to 0", () => {
    expect(
      sumRentalSubtotalFromPriceBreakdown({
        baseRentalTotal: "50",
        kaskoTotal: undefined,
        childSeatsTotal: null,
        secondDriverTotal: 0,
      })
    ).toBe(50);
    expect(
      grandTotalFromPriceBreakdown({
        baseRentalTotal: 40,
        kaskoTotal: 0,
        childSeatsTotal: 0,
        secondDriverTotal: 0,
        deliveryTotal: "15",
      })
    ).toBe(55);
  });

  test("quote-only shape: rental 0 yields grand = delivery only (caller may reject)", () => {
    const onlyDelivery = {
      baseRentalTotal: 0,
      kaskoTotal: 0,
      childSeatsTotal: 0,
      secondDriverTotal: 0,
      deliveryTotal: 40,
    };
    expect(grandTotalFromPriceBreakdown(onlyDelivery)).toBe(40);
    expect(sumRentalSubtotalFromPriceBreakdown(onlyDelivery)).toBe(0);
  });
});
