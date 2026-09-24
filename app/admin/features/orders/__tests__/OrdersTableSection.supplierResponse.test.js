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
  test("company table uses supplier-response actions, not a Confirmed switch on client orders", () => {
    expect(tableSrc).toMatch(/table\.supplierResponse/);
    expect(tableSrc).toMatch(/SupplierResponseCell/);
    expect(tableSrc).toMatch(/isClient \? \(/);
    expect(tableSrc).toMatch(/isPlatformAdmin \? \(/);
    expect(tableSrc).toMatch(/PlatformStatusCell/);
    expect(tableSrc).not.toMatch(/Confirmed - Switch Toggle/);
  });

  test("supplier cell exposes Vehicle available and Cannot provide, not Confirmed", () => {
    expect(cellSrc).toMatch(/table\.vehicleAvailable/);
    expect(cellSrc).toMatch(/table\.cannotProvide/);
    expect(cellSrc).not.toMatch(/<Switch/);
    expect(cellSrc).not.toMatch(/t\("table\.confirmed"\)/);
  });

  test("edit modal hides platform confirmation for company client orders", () => {
    expect(modalSrc).toMatch(/isCurrentUserSuperAdmin \|\| !isClientOrder/);
    expect(modalSrc).toMatch(/isPlatformAdminUser/);
  });
});
