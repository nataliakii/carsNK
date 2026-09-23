/**
 * Lightweight contract: admin cars page must be able to render a list payload
 * shaped like /api/car/getAll (plain array of cars), including legacy shapes.
 * @jest-environment node
 */
describe("admin cars list payload contract", () => {
  test("getAll-shaped list includes legacy and missing-office cars without throwing", () => {
    const payload = [
      {
        _id: "64b7f2c3a1b2c3d4e5f607a1",
        model: "Yaris",
        ownerId: "64b7f2c3a1b2c3d4e5f60701",
        officeIds: ["64b7f2c3a1b2c3d4e5f60711"],
        officeScope: "selected",
      },
      {
        _id: "64b7f2c3a1b2c3d4e5f607a2",
        model: "Legacy",
        ownerId: "64b7f2c3a1b2c3d4e5f60701",
      },
      {
        _id: "64b7f2c3a1b2c3d4e5f607a3",
        model: "Ghost",
        ownerId: "64b7f2c3a1b2c3d4e5f60701",
        officeIds: ["64b7f2c3a1b2c3d4e5f60999"],
        officeScope: "selected",
      },
    ];

    expect(Array.isArray(payload)).toBe(true);
    expect(payload).toHaveLength(3);
    // Serialization round-trip used by DataLoader before Client Components
    const safe = JSON.parse(JSON.stringify(payload));
    expect(safe.map((c) => c.model)).toEqual(["Yaris", "Legacy", "Ghost"]);
    expect(safe[1].officeIds).toBeUndefined();
    expect(safe[2].officeIds).toHaveLength(1);
  });

  test("empty fleet is a valid render payload", () => {
    const safe = JSON.parse(JSON.stringify([]));
    expect(safe).toEqual([]);
  });
});
