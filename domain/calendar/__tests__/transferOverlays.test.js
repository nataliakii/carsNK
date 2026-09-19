import {
  buildTransferCalendarOverlays,
  carsForTransferOverlay,
  CALENDAR_TRANSFER_STATUSES,
} from "../transferOverlays.js";

describe("transferOverlays", () => {
  const cars = [
    { _id: "car1", ownerId: "coA", model: "A" },
    { _id: "car2", ownerId: "coA", model: "B" },
    { _id: "car3", ownerId: "coB", model: "C" },
  ];

  test("requires assignedCarId in fleet", () => {
    const matched = carsForTransferOverlay(
      {
        assignedCarId: "car2",
        claimedByCompanyId: "coA",
        status: "CLAIMED",
      },
      cars
    );
    expect(matched.map((c) => c._id)).toEqual(["car2"]);
  });

  test("without assignedCarId yields no cars", () => {
    const matched = carsForTransferOverlay(
      { claimedByCompanyId: "coA", status: "CLAIMED" },
      cars
    );
    expect(matched).toEqual([]);
  });

  test("skips open / unclaimed transfers", () => {
    const overlays = buildTransferCalendarOverlays(
      [
        {
          _id: "t1",
          status: "OPEN_FOR_CLAIM",
          datetime: "2026-06-01T10:00:00.000Z",
          from: "A",
          to: "B",
          assignedCarId: "car1",
        },
      ],
      cars
    );
    expect(overlays).toEqual([]);
  });

  test("builds same-day overlay for claimed transfer on assigned fleet car", () => {
    const overlays = buildTransferCalendarOverlays(
      [
        {
          _id: "t2",
          status: "CLAIMED",
          datetime: "2026-06-01T10:00:00.000Z",
          durationMinutes: 90,
          from: "Airport",
          to: "Hotel",
          claimedByCompanyId: "coA",
          assignedCarId: "car1",
        },
      ],
      cars
    );
    expect(overlays).toHaveLength(1);
    expect(overlays[0].isTransferOverlay).toBe(true);
    expect(overlays[0]._calendarKind).toBe("transfer");
    expect(overlays[0].car).toBe("car1");
    expect(CALENDAR_TRANSFER_STATUSES.has("CLAIMED")).toBe(true);
  });

  test("assignedCarId not in fleet yields no overlay", () => {
    const overlays = buildTransferCalendarOverlays(
      [
        {
          _id: "t3",
          status: "CONFIRMED",
          datetime: "2026-06-01T10:00:00.000Z",
          assignedCarId: "missing",
          claimedByCompanyId: "coA",
          from: "A",
          to: "B",
        },
      ],
      cars
    );
    expect(overlays).toEqual([]);
  });
});
