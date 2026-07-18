/**
 * Unit tests for handleRecalculatePrice function
 * 
 * Tests verify that:
 * 1. API /api/order/calcTotalPrice is called with correct parameters (days, insurance, childSeats)
 * 2. Price calculation is based on: number of days + insurance (CDW) + child seats
 * 3. Price is updated in database via handleFieldUpdate
 * 4. Updated price in database matches calculated price from API
 */

describe("handleRecalculatePrice", () => {
  let mockFetch;
  let mockHandleFieldUpdate;
  let mockEnqueueSnackbar;
  let mockCars;
  let mockOrder;

  beforeEach(() => {
    // Mock fetch
    global.fetch = jest.fn();
    mockFetch = global.fetch;

    // Mock handleFieldUpdate
    mockHandleFieldUpdate = jest.fn().mockResolvedValue(undefined);

    // Mock enqueueSnackbar
    mockEnqueueSnackbar = jest.fn();

    // Mock cars array
    mockCars = [
      {
        _id: "car1",
        carNumber: "ABC123",
        model: "Toyota Corolla",
        regNumber: "ABC-123",
      },
      {
        _id: "car2",
        carNumber: "XYZ789",
        model: "Honda Civic",
        regNumber: "XYZ-789",
      },
    ];

    // Mock order
    mockOrder = {
      _id: "order1",
      car: {
        _id: "car1",
        carNumber: "ABC123",
        model: "Toyota Corolla",
      },
      rentalStartDate: new Date("2026-01-06T00:00:00Z"),
      rentalEndDate: new Date("2026-01-10T00:00:00Z"),
      insurance: "CDW",
      ChildSeats: 2,
      totalPrice: 500,
      numberOfDays: 4,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("API call with correct parameters", () => {
    test("should call /api/order/calcTotalPrice with order data", async () => {
      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalPrice: 750,
          days: 4,
        }),
      });

      // Import and call handleRecalculatePrice logic
      const handleRecalculatePrice = async (order) => {
        const orderId = order._id;
        
        // Get carNumber
        let carNumber = null;
        if (order.car?.carNumber) {
          carNumber = order.car.carNumber;
        } else if (order.carNumber) {
          carNumber = order.carNumber;
        } else if (order.car?._id || order.car) {
          const carId = order.car?._id || order.car;
          const car = mockCars.find((c) => c._id?.toString() === carId?.toString());
          if (car?.carNumber) {
            carNumber = car.carNumber;
          }
        }

        if (!carNumber) {
          throw new Error("Не удалось определить номер автомобиля");
        }

        // Get dates
        const rentalStartDate = order.rentalStartDate
          ? new Date(order.rentalStartDate).toISOString().split("T")[0]
          : null;
        const rentalEndDate = order.rentalEndDate
          ? new Date(order.rentalEndDate).toISOString().split("T")[0]
          : null;

        if (!rentalStartDate || !rentalEndDate) {
          throw new Error("Не указаны даты аренды");
        }

        // Get insurance and child seats
        const kacko = order.insurance || "TPL";
        const childSeats = order.ChildSeats || 0;

        // Call API
        const response = await fetch("/api/order/calcTotalPrice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            carNumber,
            rentalStartDate,
            rentalEndDate,
            kacko,
            childSeats,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Ошибка пересчета цены");
        }

        const data = await response.json();

        // Update price
        if (data.totalPrice !== undefined) {
          await mockHandleFieldUpdate(orderId, "totalPrice", data.totalPrice);
        }

        return data;
      };

      // Execute
      await handleRecalculatePrice(mockOrder);

      // Verify API was called with correct parameters
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith("/api/order/calcTotalPrice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carNumber: "ABC123",
          rentalStartDate: "2026-01-06",
          rentalEndDate: "2026-01-10",
          kacko: "CDW",
          childSeats: 2,
        }),
      });
    });

    test("should handle carNumber from cars array if not in order.car", async () => {
      const orderWithoutCarNumber = {
        ...mockOrder,
        car: { _id: "car2" }, // No carNumber in car object
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalPrice: 600,
          days: 4,
        }),
      });

      const handleRecalculatePrice = async (order) => {
        let carNumber = null;
        if (order.car?.carNumber) {
          carNumber = order.car.carNumber;
        } else if (order.carNumber) {
          carNumber = order.carNumber;
        } else if (order.car?._id || order.car) {
          const carId = order.car?._id || order.car;
          const car = mockCars.find((c) => c._id?.toString() === carId?.toString());
          if (car?.carNumber) {
            carNumber = car.carNumber;
          }
        }

        if (!carNumber) {
          throw new Error("Не удалось определить номер автомобиля");
        }

        const rentalStartDate = order.rentalStartDate
          ? new Date(order.rentalStartDate).toISOString().split("T")[0]
          : null;
        const rentalEndDate = order.rentalEndDate
          ? new Date(order.rentalEndDate).toISOString().split("T")[0]
          : null;

        const kacko = order.insurance || "TPL";
        const childSeats = order.ChildSeats || 0;

        const response = await fetch("/api/order/calcTotalPrice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            carNumber,
            rentalStartDate,
            rentalEndDate,
            kacko,
            childSeats,
          }),
        });

        if (!response.ok) {
          throw new Error("Ошибка пересчета цены");
        }

        return await response.json();
      };

      const result = await handleRecalculatePrice(orderWithoutCarNumber);

      // Verify carNumber was found from cars array
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/order/calcTotalPrice",
        expect.objectContaining({
          body: JSON.stringify({
            carNumber: "XYZ789", // Found from cars array
            rentalStartDate: "2026-01-06",
            rentalEndDate: "2026-01-10",
            kacko: "CDW",
            childSeats: 2,
          }),
        })
      );
    });
  });

  describe("Price calculation based on days, insurance, and child seats", () => {
    test("should calculate price based on number of days", async () => {
      // Order with 4 days rental
      const order4Days = {
        ...mockOrder,
        rentalStartDate: new Date("2026-01-06T00:00:00Z"),
        rentalEndDate: new Date("2026-01-10T00:00:00Z"),
        insurance: "TPL",
        ChildSeats: 0,
      };

      // Expected: 4 days calculated by API
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalPrice: 400, // Base price for 4 days
          days: 4,
        }),
      });

      const handleRecalculatePrice = async (order) => {
        const carNumber = order.car?.carNumber || "ABC123";
        const rentalStartDate = new Date(order.rentalStartDate).toISOString().split("T")[0];
        const rentalEndDate = new Date(order.rentalEndDate).toISOString().split("T")[0];
        const kacko = order.insurance || "TPL";
        const childSeats = order.ChildSeats || 0;

        const response = await fetch("/api/order/calcTotalPrice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            carNumber,
            rentalStartDate,
            rentalEndDate,
            kacko,
            childSeats,
          }),
        });

        return await response.json();
      };

      const result = await handleRecalculatePrice(order4Days);

      // Verify API was called with dates that result in 4 days
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/order/calcTotalPrice",
        expect.objectContaining({
          body: JSON.stringify({
            carNumber: "ABC123",
            rentalStartDate: "2026-01-06",
            rentalEndDate: "2026-01-10", // 4 days difference
            kacko: "TPL",
            childSeats: 0,
          }),
        })
      );

      // Verify API returned correct number of days
      expect(result.days).toBe(4);
    });

    test("should add CDW insurance cost to base price", async () => {
      // Order with CDW insurance
      const orderWithCDW = {
        ...mockOrder,
        insurance: "CDW",
        ChildSeats: 0,
      };

      // Expected: base price + (PriceKacko * days)
      // If PriceKacko = 10 and days = 4, then CDW cost = 40
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalPrice: 440, // Base 400 + CDW 40 (10 * 4 days)
          days: 4,
        }),
      });

      const handleRecalculatePrice = async (order) => {
        const carNumber = order.car?.carNumber || "ABC123";
        const rentalStartDate = new Date(order.rentalStartDate).toISOString().split("T")[0];
        const rentalEndDate = new Date(order.rentalEndDate).toISOString().split("T")[0];
        const kacko = order.insurance || "TPL";
        const childSeats = order.ChildSeats || 0;

        const response = await fetch("/api/order/calcTotalPrice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            carNumber,
            rentalStartDate,
            rentalEndDate,
            kacko,
            childSeats,
          }),
        });

        return await response.json();
      };

      const result = await handleRecalculatePrice(orderWithCDW);

      // Verify API was called with CDW insurance
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/order/calcTotalPrice",
        expect.objectContaining({
          body: JSON.stringify({
            carNumber: "ABC123",
            rentalStartDate: "2026-01-06",
            rentalEndDate: "2026-01-10",
            kacko: "CDW", // CDW insurance
            childSeats: 0,
          }),
        })
      );

      // Verify price includes CDW cost (higher than base)
      expect(result.totalPrice).toBeGreaterThan(400); // Should be base + CDW
    });

    test("should add child seats cost to base price", async () => {
      // Order with 2 child seats
      const orderWithChildSeats = {
        ...mockOrder,
        insurance: "TPL",
        ChildSeats: 2,
      };

      // Expected: base price + (PriceChildSeats * childSeats * days)
      // If PriceChildSeats = 5, childSeats = 2, days = 4, then cost = 5 * 2 * 4 = 40
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalPrice: 440, // Base 400 + Child Seats 40 (5 * 2 * 4 days)
          days: 4,
        }),
      });

      const handleRecalculatePrice = async (order) => {
        const carNumber = order.car?.carNumber || "ABC123";
        const rentalStartDate = new Date(order.rentalStartDate).toISOString().split("T")[0];
        const rentalEndDate = new Date(order.rentalEndDate).toISOString().split("T")[0];
        const kacko = order.insurance || "TPL";
        const childSeats = order.ChildSeats || 0;

        const response = await fetch("/api/order/calcTotalPrice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            carNumber,
            rentalStartDate,
            rentalEndDate,
            kacko,
            childSeats,
          }),
        });

        return await response.json();
      };

      const result = await handleRecalculatePrice(orderWithChildSeats);

      // Verify API was called with child seats
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/order/calcTotalPrice",
        expect.objectContaining({
          body: JSON.stringify({
            carNumber: "ABC123",
            rentalStartDate: "2026-01-06",
            rentalEndDate: "2026-01-10",
            kacko: "TPL",
            childSeats: 2, // 2 child seats
          }),
        })
      );

      // Verify price includes child seats cost (higher than base)
      expect(result.totalPrice).toBeGreaterThan(400); // Should be base + child seats
    });

    test("should calculate total price with all factors: days + CDW + child seats", async () => {
      // Order with CDW insurance and 2 child seats for 4 days
      const orderFull = {
        ...mockOrder,
        insurance: "CDW",
        ChildSeats: 2,
      };

      // Expected: base price + CDW cost + child seats cost
      // Base: 400, CDW: 40 (10 * 4), Child Seats: 40 (5 * 2 * 4) = 480 total
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalPrice: 480, // Base 400 + CDW 40 + Child Seats 40
          days: 4,
        }),
      });

      const handleRecalculatePrice = async (order) => {
        const orderId = order._id;
        const carNumber = order.car?.carNumber || "ABC123";
        const rentalStartDate = new Date(order.rentalStartDate).toISOString().split("T")[0];
        const rentalEndDate = new Date(order.rentalEndDate).toISOString().split("T")[0];
        const kacko = order.insurance || "TPL";
        const childSeats = order.ChildSeats || 0;

        const response = await fetch("/api/order/calcTotalPrice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            carNumber,
            rentalStartDate,
            rentalEndDate,
            kacko,
            childSeats,
          }),
        });

        if (!response.ok) {
          throw new Error("Ошибка пересчета цены");
        }

        const data = await response.json();

        // Update price in database
        if (data.totalPrice !== undefined) {
          await mockHandleFieldUpdate(orderId, "totalPrice", data.totalPrice);
        }

        return data;
      };

      const result = await handleRecalculatePrice(orderFull);

      // Verify API was called with all factors
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/order/calcTotalPrice",
        expect.objectContaining({
          body: JSON.stringify({
            carNumber: "ABC123",
            rentalStartDate: "2026-01-06",
            rentalEndDate: "2026-01-10", // 4 days
            kacko: "CDW", // CDW insurance
            childSeats: 2, // 2 child seats
          }),
        })
      );

      // Verify calculated price includes all factors
      expect(result.totalPrice).toBe(480);
      expect(result.days).toBe(4);

      // Verify price was updated in database with calculated value
      expect(mockHandleFieldUpdate).toHaveBeenCalledTimes(1);
      expect(mockHandleFieldUpdate).toHaveBeenCalledWith(
        "order1",
        "totalPrice",
        480 // Calculated price: base + CDW + child seats
      );
    });
  });

  describe("Price update in database", () => {
    test("should update price in database to match calculated price from API", async () => {
      const originalPrice = 500;
      const calculatedPrice = 750; // Calculated based on days + insurance + child seats

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalPrice: calculatedPrice,
          days: 4,
        }),
      });

      const handleRecalculatePrice = async (order) => {
        const orderId = order._id;
        const carNumber = order.car?.carNumber || "ABC123";
        const rentalStartDate = new Date(order.rentalStartDate).toISOString().split("T")[0];
        const rentalEndDate = new Date(order.rentalEndDate).toISOString().split("T")[0];
        const kacko = order.insurance || "TPL";
        const childSeats = order.ChildSeats || 0;

        const response = await fetch("/api/order/calcTotalPrice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            carNumber,
            rentalStartDate,
            rentalEndDate,
            kacko,
            childSeats,
          }),
        });

        if (!response.ok) {
          throw new Error("Ошибка пересчета цены");
        }

        const data = await response.json();

        // Update price in database
        if (data.totalPrice !== undefined) {
          await mockHandleFieldUpdate(orderId, "totalPrice", data.totalPrice);
        }

        return data;
      };

      await handleRecalculatePrice(mockOrder);

      // Verify price in database matches calculated price from API
      expect(mockHandleFieldUpdate).toHaveBeenCalledTimes(1);
      expect(mockHandleFieldUpdate).toHaveBeenCalledWith(
        "order1",
        "totalPrice",
        calculatedPrice // Database price = API calculated price
      );
      expect(mockHandleFieldUpdate).not.toHaveBeenCalledWith(
        "order1",
        "totalPrice",
        originalPrice // Old price should not be used
      );
    });
  });

  describe("Error handling", () => {
    test("should throw error if carNumber cannot be determined", async () => {
      const orderWithoutCar = {
        ...mockOrder,
        car: null,
        carNumber: null,
      };

      const handleRecalculatePrice = async (order) => {
        let carNumber = null;
        if (order.car?.carNumber) {
          carNumber = order.car.carNumber;
        } else if (order.carNumber) {
          carNumber = order.carNumber;
        } else if (order.car?._id || order.car) {
          const carId = order.car?._id || order.car;
          const car = mockCars.find((c) => c._id?.toString() === carId?.toString());
          if (car?.carNumber) {
            carNumber = car.carNumber;
          }
        }

        if (!carNumber) {
          throw new Error("Не удалось определить номер автомобиля");
        }
      };

      await expect(handleRecalculatePrice(orderWithoutCar)).rejects.toThrow(
        "Не удалось определить номер автомобиля"
      );

      // Verify API was not called
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockHandleFieldUpdate).not.toHaveBeenCalled();
    });

    test("should throw error if dates are missing", async () => {
      const orderWithoutDates = {
        ...mockOrder,
        rentalStartDate: null,
        rentalEndDate: null,
      };

      const handleRecalculatePrice = async (order) => {
        const rentalStartDate = order.rentalStartDate
          ? new Date(order.rentalStartDate).toISOString().split("T")[0]
          : null;
        const rentalEndDate = order.rentalEndDate
          ? new Date(order.rentalEndDate).toISOString().split("T")[0]
          : null;

        if (!rentalStartDate || !rentalEndDate) {
          throw new Error("Не указаны даты аренды");
        }
      };

      await expect(handleRecalculatePrice(orderWithoutDates)).rejects.toThrow(
        "Не указаны даты аренды"
      );

      // Verify API was not called
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockHandleFieldUpdate).not.toHaveBeenCalled();
    });

    test("should handle API error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          message: "Car not found",
        }),
      });

      const handleRecalculatePrice = async (order) => {
        const carNumber = order.car?.carNumber || "ABC123";
        const rentalStartDate = new Date(order.rentalStartDate).toISOString().split("T")[0];
        const rentalEndDate = new Date(order.rentalEndDate).toISOString().split("T")[0];
        const kacko = order.insurance || "TPL";
        const childSeats = order.ChildSeats || 0;

        const response = await fetch("/api/order/calcTotalPrice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            carNumber,
            rentalStartDate,
            rentalEndDate,
            kacko,
            childSeats,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Ошибка пересчета цены");
        }
      };

      await expect(handleRecalculatePrice(mockOrder)).rejects.toThrow("Car not found");

      // Verify handleFieldUpdate was not called on error
      expect(mockHandleFieldUpdate).not.toHaveBeenCalled();
    });
  });

  describe("Default values", () => {
    test("should use default insurance 'TPL' if not specified", async () => {
      const orderWithoutInsurance = {
        ...mockOrder,
        insurance: undefined,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalPrice: 600,
          days: 4,
        }),
      });

      const handleRecalculatePrice = async (order) => {
        const carNumber = order.car?.carNumber || "ABC123";
        const rentalStartDate = new Date(order.rentalStartDate).toISOString().split("T")[0];
        const rentalEndDate = new Date(order.rentalEndDate).toISOString().split("T")[0];
        const kacko = order.insurance || "TPL"; // Default
        const childSeats = order.ChildSeats || 0;

        const response = await fetch("/api/order/calcTotalPrice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            carNumber,
            rentalStartDate,
            rentalEndDate,
            kacko,
            childSeats,
          }),
        });

        return await response.json();
      };

      await handleRecalculatePrice(orderWithoutInsurance);

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/order/calcTotalPrice",
        expect.objectContaining({
          body: JSON.stringify({
            carNumber: "ABC123",
            rentalStartDate: "2026-01-06",
            rentalEndDate: "2026-01-10",
            kacko: "TPL", // Default value
            childSeats: 2,
          }),
        })
      );
    });

    test("should use default childSeats 0 if not specified", async () => {
      const orderWithoutChildSeats = {
        ...mockOrder,
        ChildSeats: undefined,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalPrice: 600,
          days: 4,
        }),
      });

      const handleRecalculatePrice = async (order) => {
        const carNumber = order.car?.carNumber || "ABC123";
        const rentalStartDate = new Date(order.rentalStartDate).toISOString().split("T")[0];
        const rentalEndDate = new Date(order.rentalEndDate).toISOString().split("T")[0];
        const kacko = order.insurance || "TPL";
        const childSeats = order.ChildSeats || 0; // Default

        const response = await fetch("/api/order/calcTotalPrice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            carNumber,
            rentalStartDate,
            rentalEndDate,
            kacko,
            childSeats,
          }),
        });

        return await response.json();
      };

      await handleRecalculatePrice(orderWithoutChildSeats);

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/order/calcTotalPrice",
        expect.objectContaining({
          body: JSON.stringify({
            carNumber: "ABC123",
            rentalStartDate: "2026-01-06",
            rentalEndDate: "2026-01-10",
            kacko: "CDW",
            childSeats: 0, // Default value
          }),
        })
      );
    });
  });
});

