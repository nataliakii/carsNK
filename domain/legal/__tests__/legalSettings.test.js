import {
  BOOKING_PREPAYMENT_PERCENT,
  SUPPLIER_BALANCE_PERCENT,
  DEFAULT_OPERATIONAL_DEADLINES,
  DEFAULT_RETENTION_JOB_SETTINGS,
  COMMERCIAL_AMOUNT_KEYS,
  resolveLegalSettings,
  buildLegalSettingsTokens,
  getMissingCommercialSettings,
  UNCONFIGURED_AMOUNT_TEXT,
  PAYMENT_FEE_BEARER,
  VAT_TREATMENT,
} from "@/domain/legal/legalSettings";

describe("documented default marketplace fee tokens", () => {
  it("keeps the documented default booking prepayment at 10% and the balance at 90%", () => {
    expect(BOOKING_PREPAYMENT_PERCENT).toBe(10);
    expect(SUPPLIER_BALANCE_PERCENT).toBe(90);
  });
});

describe("commercial amounts are never invented", () => {
  it("leaves every commercial amount null by default", () => {
    const settings = resolveLegalSettings(null);
    for (const key of COMMERCIAL_AMOUNT_KEYS) {
      expect(settings[key]).toBeNull();
    }
  });

  it("reports unconfigured amounts for the superadmin panel", () => {
    const settings = resolveLegalSettings({});
    expect(getMissingCommercialSettings(settings).sort()).toEqual(
      [...COMMERCIAL_AMOUNT_KEYS].sort()
    );
  });

  it("renders a pointer to the fee schedule instead of a number", () => {
    const tokens = buildLegalSettingsTokens(resolveLegalSettings(null));
    expect(tokens.supplierCancellationServiceCharge).toBe(UNCONFIGURED_AMOUNT_TEXT);
    expect(tokens.replacementCostDifferenceCap).toBe(UNCONFIGURED_AMOUNT_TEXT);
    expect(tokens.commissionPercent).toBeUndefined();
    expect(tokens.minimumCommissionAmount).toBeUndefined();
    expect(tokens.bookingPrepaymentPercent).toBe("10%");
    expect(tokens.supplierBalancePercent).toBe("90%");
    expect(tokens.bookingFeeDisplayNote).toMatch(
      /displayed to the Customer before payment/
    );
  });

  it("uses Spanish wording for the Spanish documents", () => {
    const tokens = buildLegalSettingsTokens(resolveLegalSettings(null), {
      language: "es",
    });
    expect(tokens.supplierCancellationServiceCharge).toMatch(/cuadro de tarifas/);
    expect(tokens.bookingFeeDisplayNote).toMatch(
      /muestra al Cliente antes del pago/
    );
  });

  it("formats a configured amount with its currency", () => {
    const settings = resolveLegalSettings({
      supplierCancellationServiceCharge: 50,
      replacementCostDifferenceCap: 200,
      commissionCurrency: "eur",
    });
    const tokens = buildLegalSettingsTokens(settings);

    expect(tokens.supplierCancellationServiceCharge).toBe("EUR 50.00");
    expect(tokens.replacementCostDifferenceCap).toBe("EUR 200.00");
    expect(tokens.bookingPrepaymentPercent).toBe("10%");
  });

  it("treats a negative or unparsable amount as unconfigured", () => {
    const settings = resolveLegalSettings({
      supplierCancellationServiceCharge: "abc",
      replacementCostDifferenceCap: -5,
    });
    expect(settings.supplierCancellationServiceCharge).toBeNull();
    expect(settings.replacementCostDifferenceCap).toBeNull();
  });

  it("ignores stored separate commission settings", () => {
    const settings = resolveLegalSettings({
      commissionPercent: 15,
      minimumCommissionAmount: 12,
    });
    expect(settings.commissionPercent).toBeUndefined();
    expect(settings.minimumCommissionAmount).toBeUndefined();
    const tokens = buildLegalSettingsTokens(settings);
    expect(tokens.commissionPercent).toBeUndefined();
    expect(tokens.bookingPrepaymentPercent).toBe("10%");
  });
});

describe("operational deadlines", () => {
  it("ships documented proposed defaults", () => {
    const settings = resolveLegalSettings(null);
    for (const [key, value] of Object.entries(DEFAULT_OPERATIONAL_DEADLINES)) {
      expect(settings[key]).toBe(value);
    }
  });

  it("exposes booking retention as 7 years for legal copy", () => {
    const tokens = buildLegalSettingsTokens(resolveLegalSettings(null));
    expect(tokens.bookingRetentionDays).toBe(7 * 365);
    expect(tokens.bookingRetentionYears).toBe(7);
  });

  it("lets superadmin override a deadline", () => {
    const settings = resolveLegalSettings({ standardRequestResponseHours: 6 });
    expect(settings.standardRequestResponseHours).toBe(6);
    expect(settings.urgentRequestResponseMinutes).toBe(
      DEFAULT_OPERATIONAL_DEADLINES.urgentRequestResponseMinutes
    );
  });

  it("falls back to the default for an invalid override", () => {
    const settings = resolveLegalSettings({ standardRequestResponseHours: "soon" });
    expect(settings.standardRequestResponseHours).toBe(
      DEFAULT_OPERATIONAL_DEADLINES.standardRequestResponseHours
    );
  });

  it("splits supplier forward-complaint and operator appeal SLAs", () => {
    const tokens = buildLegalSettingsTokens(resolveLegalSettings(null));
    expect(tokens.customerComplaintForwardResponseHours).toBe(48);
    expect(tokens.partnerAppealResponseHours).toBe(48);
    expect(tokens.customerComplaintResponseHours).toBe(48);
    expect(tokens.partnerComplaintResponseHours).toBeUndefined();
  });

  it("migrates legacy partnerComplaintResponseHours into both new SLAs", () => {
    const settings = resolveLegalSettings({
      partnerComplaintResponseHours: 36,
    });
    expect(settings.customerComplaintForwardResponseHours).toBe(36);
    expect(settings.partnerAppealResponseHours).toBe(36);
  });

  it("lets each new complaint SLA be set independently", () => {
    const settings = resolveLegalSettings({
      customerComplaintForwardResponseHours: 24,
      partnerAppealResponseHours: 72,
      partnerComplaintResponseHours: 36,
    });
    expect(settings.customerComplaintForwardResponseHours).toBe(24);
    expect(settings.partnerAppealResponseHours).toBe(72);
  });
});

describe("driving licence retention job parameters", () => {
  it("ships defaults and accepts an override", () => {
    expect(resolveLegalSettings(null).documentRetentionBatchSize).toBe(
      DEFAULT_RETENTION_JOB_SETTINGS.documentRetentionBatchSize
    );
    expect(
      resolveLegalSettings({ documentRetentionBatchSize: 25 })
        .documentRetentionBatchSize
    ).toBe(25);
  });

  it("refuses a page size of zero, which would stall the job", () => {
    for (const bad of [0, -5, "many", null]) {
      expect(
        resolveLegalSettings({ documentRetentionBatchSize: bad })
          .documentRetentionBatchSize
      ).toBe(DEFAULT_RETENTION_JOB_SETTINGS.documentRetentionBatchSize);
    }
  });

  it("stays out of the document token map — it is a runtime knob, not a promise", () => {
    const tokens = buildLegalSettingsTokens(resolveLegalSettings(null));
    expect(tokens.documentRetentionBatchSize).toBeUndefined();
    expect(tokens.documentRetentionDays).toBe(
      DEFAULT_OPERATIONAL_DEADLINES.documentRetentionDays
    );
  });
});

describe("marketplace split and fee handling", () => {
  it("does not expose a configurable commission base", () => {
    const settings = resolveLegalSettings(null);
    expect(settings.commissionBase).toBeUndefined();
    expect(settings.commissionPercent).toBeUndefined();
    expect(settings.minimumCommissionAmount).toBeUndefined();
  });

  it("ignores a stored commission-base override", () => {
    const settings = resolveLegalSettings({
      commissionBase: { includeDelivery: false, includeExtras: false },
    });
    expect(settings.commissionBase).toBeUndefined();
  });

  it("leaves VAT treatment unconfigured until decided", () => {
    expect(resolveLegalSettings(null).vatTreatment).toBe(
      VAT_TREATMENT.NOT_CONFIGURED
    );
  });

  it("defaults payment processing fees to the platform", () => {
    expect(resolveLegalSettings(null).paymentFeeBearer).toBe(
      PAYMENT_FEE_BEARER.PLATFORM
    );
  });
});
