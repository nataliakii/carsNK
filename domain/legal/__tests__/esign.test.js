import {
  ESIGN_MODE,
  resolveEsignProvider,
  clickwrapProvider,
  manualProvider,
  externalEsignProvider,
} from "@/domain/legal/esign";

function validClickwrapContext(overrides = {}) {
  return {
    authenticatedUserId: "user-1",
    signerName: "A Signer",
    signerRole: "Administrador único",
    signerEmail: "signer@supplier.es",
    confirmationOfAuthority: true,
    acceptedCheckbox: true,
    ipAddress: "203.0.113.10",
    userAgent: "jest",
    ...overrides,
  };
}

describe("provider selection", () => {
  it("defaults to clickwrap", () => {
    expect(resolveEsignProvider().mode).toBe(ESIGN_MODE.CLICKWRAP);
  });

  it("falls back to clickwrap for an unknown mode", () => {
    expect(resolveEsignProvider("docusign").mode).toBe(ESIGN_MODE.CLICKWRAP);
  });

  it("honours a configured mode", () => {
    expect(resolveEsignProvider(ESIGN_MODE.MANUAL).mode).toBe(ESIGN_MODE.MANUAL);
  });
});

describe("clickwrap audit trail requirements", () => {
  it("accepts a complete acceptance", async () => {
    expect(clickwrapProvider.validate(validClickwrapContext()).ok).toBe(true);
    const signed = await clickwrapProvider.sign(validClickwrapContext());
    expect(signed).toMatchObject({
      ok: true,
      acceptanceMethod: "clickwrap",
      esignStatus: "completed",
    });
  });

  it("refuses without the acceptance checkbox", () => {
    const result = clickwrapProvider.validate(
      validClickwrapContext({ acceptedCheckbox: false })
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe("acceptance_not_ticked");
  });

  it("refuses without a confirmation of signing authority", () => {
    const result = clickwrapProvider.validate(
      validClickwrapContext({ confirmationOfAuthority: false })
    );
    expect(result.code).toBe("authority_not_confirmed");
  });

  it("refuses when the signer is not identified", () => {
    const result = clickwrapProvider.validate(
      validClickwrapContext({ signerRole: "" })
    );
    expect(result.code).toBe("missing_signer_details");
  });

  it("refuses when the client IP is unavailable", () => {
    const result = clickwrapProvider.validate(
      validClickwrapContext({ ipAddress: "" })
    );
    expect(result.code).toBe("missing_audit_context");
  });
});

describe("manual provider", () => {
  it("requires a stored reference to the signed evidence", () => {
    const result = manualProvider.validate({
      signerName: "A Signer",
      signerRole: "Director",
      confirmationOfAuthority: true,
    });
    expect(result.code).toBe("missing_evidence");
  });

  it("accepts an acceptance backed by evidence", async () => {
    const context = {
      signerName: "A Signer",
      signerRole: "Director",
      confirmationOfAuthority: true,
      evidenceStorageRef: "partners/agreements/signed-1.pdf",
    };
    expect(manualProvider.validate(context).ok).toBe(true);
    const signed = await manualProvider.sign(context);
    expect(signed.acceptanceMethod).toBe("manual");
    expect(signed.esignEnvelopeId).toBe("partners/agreements/signed-1.pdf");
  });
});

describe("external provider is an unimplemented integration point", () => {
  it("is marked as not implemented", () => {
    expect(externalEsignProvider.implemented).toBe(false);
  });

  it("refuses validation with a clear message", () => {
    const result = externalEsignProvider.validate();
    expect(result.ok).toBe(false);
    expect(result.code).toBe("provider_not_configured");
  });

  it("throws rather than silently pretending to sign", async () => {
    await expect(externalEsignProvider.sign()).rejects.toThrow(/not implemented/i);
  });
});
