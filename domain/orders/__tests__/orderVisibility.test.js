import {
  applyVisibilityToOrder,
  companyMustHideCustomerIdentity,
  maskCustomerName,
} from "../orderVisibility";

const companyAdmin = { isAdmin: true, role: 1 };
const superadmin = { isAdmin: true, role: 2 };

function marketplace(overrides = {}) {
  return {
    my_order: true,
    source: "PLATFORM",
    bookingMode: "MARKETPLACE_REQUEST",
    customerName: "Ana Lopez",
    email: "ana@example.com",
    phone: "+34600000000",
    Viber: true,
    Whatsapp: true,
    Telegram: true,
    drivingLicenceUrls: ["https://res.cloudinary.com/demo/image/upload/licence.jpg"],
    confirmed: true,
    payment: { status: "pending" },
    ...overrides,
  };
}

describe("customer identity before the Booking Fee", () => {
  test("masks the name and removes contacts, messengers and licence URLs", () => {
    const visible = applyVisibilityToOrder(marketplace(), companyAdmin);
    expect(companyMustHideCustomerIdentity(marketplace())).toBe(true);
    expect(visible.customerName).toBe(maskCustomerName("Ana Lopez"));
    expect(visible.customerName).not.toBe("Ana Lopez");
    expect(visible.email).toBeUndefined();
    expect(visible.phone).toBeUndefined();
    expect(visible.Viber).toBeUndefined();
    expect(visible.Whatsapp).toBeUndefined();
    expect(visible.Telegram).toBeUndefined();
    expect(visible.drivingLicenceUrls).toBeUndefined();
    expect(visible.hasDrivingLicence).toBeUndefined();
  });

  test("reveals identity after payment and still withholds the stored URL", () => {
    const visible = applyVisibilityToOrder(
      marketplace({ payment: { status: "paid" } }),
      companyAdmin
    );
    expect(visible.customerName).toBe("Ana Lopez");
    expect(visible.email).toBe("ana@example.com");
    expect(visible.phone).toBe("+34600000000");
    expect(visible.drivingLicenceUrls).toBeUndefined();
    expect(visible.hasDrivingLicence).toBe(true);
  });

  test("does not hide an internal booking because marketplace mode is set", () => {
    const visible = applyVisibilityToOrder(
      {
        my_order: false,
        source: "INTERNAL",
        bookingMode: "MARKETPLACE_REQUEST",
        customerName: "Local Client",
        email: "local@example.com",
        phone: "600",
        payment: { status: "pending" },
      },
      companyAdmin
    );
    expect(visible.customerName).toBe("Local Client");
    expect(visible.email).toBe("local@example.com");
  });

  test("superadmin can still review unpaid marketplace identity", () => {
    const visible = applyVisibilityToOrder(marketplace(), superadmin);
    expect(visible.email).toBe("ana@example.com");
  });
});
