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

describe("fixed product rules", () => {
  it("fixes the booking prepayment at 10% and the balance at 90%", () => {
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
    expect(tokens.minimumCommissionAmount).toBe(UNCONFIGURED_AMOUNT_TEXT);
    expect(tokens.supplierCancellationServiceCharge).toBe(UNCONFIGURED_AMOUNT_TEXT);
    expect(tokens.commissionPercent).toBe(UNCONFIGURED_AMOUNT_TEXT);
    expect(String(tokens.minimumCommissionAmount)).not.toMatch(/\d/);
  });

  it("uses Spanish wording for the Spanish documents", () => {
    const tokens = buildLegalSettingsTokens(resolveLegalSettings(null), {
      language: "es",
    });
    expect(tokens.minimumCommissionAmount).toMatch(/cuadro de tarifas/);
  });

  it("formats a configured amount with its currency", () => {
    const settings = resolveLegalSettings({
      minimumCommissionAmount: 12,
      commissionPercent: 15,
      commissionCurrency: "eur",
    });
    const tokens = buildLegalSettingsTokens(settings);

    expect(tokens.minimumCommissionAmount).toBe("EUR 12.00");
    expect(tokens.commissionPercent).toBe("15%");
  });

  it("treats a negative or unparsable amount as unconfigured", () => {
    const settings = resolveLegalSettings({
      minimumCommissionAmount: -5,
      supplierCancellationServiceCharge: "abc",
    });
    expect(settings.minimumCommissionAmount).toBeNull();
    expect(settings.supplierCancellationServiceCharge).toBeNull();
  });
});

describe("operational deadlines", () => {
  it("ships documented proposed defaults", () => {
    const settings = resolveLegalSettings(null);
    for (const [key, value] of Object.entries(DEFAULT_OPERATIONAL_DEADLINES)) {
      expect(settings[key]).toBe(value);
    }
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

describe("commission base and fee handling", () => {
  it("excludes every optional charge unless explicitly configured", () => {
    const settings = resolveLegalSettings(null);
    expect(settings.commissionBase).toEqual({
      includeDelivery: false,
      includeExtras: false,
      includeInsuranceUpgrades: false,
      includeAfterHours: false,
    });
  });

  it("honours an explicit inclusion", () => {
    const settings = resolveLegalSettings({
      commissionBase: { includeDelivery: true },
    });
    expect(settings.commissionBase.includeDelivery).toBe(true);
    expect(settings.commissionBase.includeExtras).toBe(false);
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
