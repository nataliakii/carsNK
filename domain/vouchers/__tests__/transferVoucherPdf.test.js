import { buildTransferVoucherPdf } from "@/domain/vouchers/transferVoucherPdf";

describe("buildTransferVoucherPdf", () => {
  it("builds a PDF with Greek text and stamp", async () => {
    const { bytes, fileName } = await buildTransferVoucherPdf({
      companyHeaderTitle: "ΜΑΚΑΡΟΒΑ ΝΑΤΑΛΙΑ",
      companyInfo: "ΚΕΛΕΣΗ 12\nΤΗΛ. 6970 034707",
      clientName: "Test Client",
      lessee: "Agency XYZ",
      dateOfService: "2026-08-16",
      amount: "120€",
      stampSrc: "/vouchers/natali-cars-stamp.png",
      notes: "Smoke test",
    });

    expect(fileName).toMatch(/\.pdf$/);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(2000);
    expect(Buffer.from(bytes.slice(0, 4)).toString()).toBe("%PDF");
  });
});
