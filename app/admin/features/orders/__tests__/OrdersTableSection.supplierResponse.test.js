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
    expect(cellSrc).toMatch(/table\.confirmVehicle/);
    expect(cellSrc).toMatch(/table\.otherResponses/);
    expect(cellSrc).not.toMatch(/<Switch/);
    expect(cellSrc).not.toMatch(/bookingConfirmedByRovaro/);
    expect(cellSrc.toLowerCase()).not.toContain("confirmed by rovaro");
  });

  test("the row carries the primary decision only; the rest is one click deeper", () => {
    // Declining, offering a replacement and asking Rovaro a question are the
    // same capabilities reached from the Booking Details modal, which already
    // hosts all three.
    expect(cellSrc).not.toMatch(/table\.declineRequest/);
    expect(cellSrc).not.toMatch(/table\.offerEquivalentReplacement/);
    expect(cellSrc).not.toMatch(/table\.askRovaro/);
    expect(cellSrc).not.toMatch(/askRovaroAboutBooking|offerEquivalentReplacement\(/);
    // The supplier-response endpoint refuses a second decision once the
    // booking has moved on, so the row offers no "change response" control.
    expect(cellSrc).not.toMatch(/table\.changeResponse/);
    // Row-scoped entry points that have no other home collapse into one menu.
    expect(tableSrc).toMatch(/OrderRowActionsMenu/);
    expect(tableSrc).not.toMatch(/table\.reportProblem/);
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
