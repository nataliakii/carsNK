const fs = require("fs");
const path = require("path");

const tableSrc = fs.readFileSync(
  path.join(__dirname, "../OrdersTableSection.js"),
  "utf8"
);
const modalSrc = fs.readFileSync(
  path.join(__dirname, "../modals/EditOrderModal.js"),
  "utf8"
);
const cellSrc = fs.readFileSync(
  path.join(__dirname, "../components/SupplierResponseCell.js"),
  "utf8"
);
const customerSrc = fs.readFileSync(
  path.join(__dirname, "../components/CustomerConfirmationCell.js"),
  "utf8"
);

describe("orders table confirmation UX", () => {
  test("table shows supplier response and customer confirmation separately", () => {
    expect(tableSrc).toMatch(/table\.supplierResponse/);
    expect(tableSrc).toMatch(/table\.customerConfirmation/);
    expect(tableSrc).toMatch(/SupplierResponseCell/);
    expect(tableSrc).toMatch(/CustomerConfirmationCell/);
    expect(tableSrc).not.toMatch(/PlatformStatusCell/);
    expect(tableSrc).not.toMatch(/Confirmed by Rovaro/i);
    expect(tableSrc).not.toMatch(/bookingConfirmedByRovaro/);
  });

  test("supplier cell confirms availability and does not say Rovaro confirmed the booking", () => {
    expect(cellSrc).toMatch(/table\.confirmRequestedVehicle/);
    expect(cellSrc).toMatch(/table\.declineRequest/);
    expect(cellSrc).toMatch(/table\.offerEquivalentReplacement/);
    expect(cellSrc).toMatch(/View request details/);
    expect(cellSrc).not.toMatch(/<Switch/);
    expect(cellSrc).not.toMatch(/bookingConfirmedByRovaro/);
    expect(cellSrc.toLowerCase()).not.toContain("confirmed by rovaro");
  });

  test("customer confirmation is a badge, not a toggle", () => {
    expect(customerSrc).toMatch(/customerFeePaid/);
    expect(customerSrc).not.toMatch(/<Switch/);
    expect(customerSrc).not.toMatch(/onToggleConfirm/);
  });

  test("edit modal confirms internal bookings only", () => {
    expect(modalSrc).toMatch(/!isPlatformBooking\(editedOrder\)/);
    expect(modalSrc).toMatch(/confirmInternally/);
    expect(modalSrc.toLowerCase()).not.toContain("confirmed by rovaro");
  });
});
