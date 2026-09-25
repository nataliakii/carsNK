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

describe("orders table confirmation UX", () => {
  test("table leads with Your response and drops Customer confirmation", () => {
    expect(tableSrc).toMatch(/table\.yourResponse/);
    expect(tableSrc).toMatch(/SupplierResponseCell/);
    expect(tableSrc).not.toMatch(/CustomerConfirmationCell/);
    expect(tableSrc).not.toMatch(/table\.customerConfirmation/);
    expect(tableSrc).not.toMatch(/PlatformStatusCell/);
    expect(tableSrc).not.toMatch(/Confirmed by Rovaro/i);
    expect(tableSrc).not.toMatch(/bookingConfirmedByRovaro/);
  });

  test("system price line is gated to offline orders", () => {
    expect(tableSrc).toMatch(/showSystemPrice = Boolean\(order\.offline\)/);
  });

  test("supplier cell confirms availability and does not say Rovaro confirmed the booking", () => {
    expect(cellSrc).toMatch(/table\.confirmRequestedVehicle/);
    expect(cellSrc).toMatch(/table\.declineRequest/);
    expect(cellSrc).toMatch(/table\.offerEquivalentReplacement/);
    expect(cellSrc).toMatch(/View request details/);
    expect(cellSrc).toMatch(/InfoOutlinedIcon/);
    expect(cellSrc).not.toMatch(/<Switch/);
    expect(cellSrc).not.toMatch(/bookingConfirmedByRovaro/);
    expect(cellSrc.toLowerCase()).not.toContain("confirmed by rovaro");
  });

  test("edit modal does not use Rovaro-confirmed wording", () => {
    expect(modalSrc.toLowerCase()).not.toContain("confirmed by rovaro");
  });
});
