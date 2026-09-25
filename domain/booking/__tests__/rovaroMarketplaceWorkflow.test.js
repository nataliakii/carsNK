/**
 * @jest-environment node
 */
import { BOOKING_STATUS } from "../bookingStatus";
import {
  CANONICAL_STAGE,
  CANONICAL_STAGE_TO_BOOKING_STATUS,
  WORKFLOW_INVARIANTS,
} from "../rovaroMarketplaceWorkflow";

describe("rovaroMarketplaceWorkflow", () => {
  test("every mapped stored status exists on BOOKING_STATUS", () => {
    Object.values(CANONICAL_STAGE_TO_BOOKING_STATUS).forEach((status) => {
      expect(Object.values(BOOKING_STATUS)).toContain(status);
    });
  });

  test("happy-path stored statuses cannot skip supplier or payment", () => {
    expect(
      CANONICAL_STAGE_TO_BOOKING_STATUS[CANONICAL_STAGE.AWAITING_SUPPLIER_RESPONSE]
    ).toBe(BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION);
    expect(
      CANONICAL_STAGE_TO_BOOKING_STATUS[CANONICAL_STAGE.AWAITING_CUSTOMER_PAYMENT]
    ).toBe(BOOKING_STATUS.PAYMENT_PROCESSING);
    expect(
      CANONICAL_STAGE_TO_BOOKING_STATUS[CANONICAL_STAGE.BOOKING_CONFIRMED]
    ).toBe(BOOKING_STATUS.BOOKING_CONFIRMED);
  });

  test("invariants mention webhook-only payment and hidden PII", () => {
    const text = WORKFLOW_INVARIANTS.join(" ");
    expect(text).toMatch(/webhook/i);
    expect(text).toMatch(/contractor cannot see client contacts/i);
    expect(text).toMatch(/only after supplier Vehicle available/i);
  });
});
