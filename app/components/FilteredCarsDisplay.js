"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Container, Grid, Typography } from "@mui/material";
import CarItemComponent from "./CarComponent/CarItemComponent";
import { useMainContext } from "../Context";
import dayjs from "dayjs";

function FilteredCarsDisplay({ filterType, filterValue, minSeats }) {
  const { cars } = useMainContext();

  const filteredCars = useMemo(() => {
    if (!cars || cars.length === 0) return [];

    switch (filterType) {
      case "transmission":
        return cars.filter(
          (c) =>
            typeof c.transmission === "string" &&
            c.transmission.toLowerCase() === String(filterValue).toLowerCase()
        );
      case "classes": {
        const classList = Array.isArray(filterValue)
          ? filterValue
          : [filterValue];
        return cars.filter(
          (c) =>
            typeof c.class === "string" &&
            classList.includes(c.class.toLowerCase())
        );
      }
      case "familySeats":
        return cars.filter((c) => {
          const seats = typeof c.seats === "number" ? c.seats : 0;
          const carClass =
            typeof c.class === "string" ? c.class.toLowerCase() : "";
          return (
            seats >= (minSeats || 5) ||
            ["crossover", "minibus", "combi"].includes(carClass)
          );
        });
      case "brand": {
        const normalizedBrand = String(filterValue).toLowerCase();
        return cars.filter((c) => {
          const model = typeof c.model === "string" ? c.model : "";
          const firstWord = model.trim().split(/\s+/)[0] || "";
          return firstWord.toLowerCase() === normalizedBrand;
        });
      }
      case "cheapest":
        return [...cars].sort((a, b) => {
          const pa = getLowestPrice(a);
          const pb = getLowestPrice(b);
          return pa - pb;
        });
      default:
        return cars;
    }
  }, [cars, filterType, filterValue, minSeats]);

  const [discount, setDiscount] = useState(null);
  const [discountStart, setDiscountStart] = useState(null);
  const [discountEnd, setDiscountEnd] = useState(null);

  const fetchDiscount = useCallback(async () => {
    try {
      const res = await fetch("/api/discount");
      if (!res.ok) return;
      const data = await res.json();
      setDiscount(data.discount || null);
      setDiscountStart(data.startDate ? dayjs(data.startDate) : null);
      setDiscountEnd(data.endDate ? dayjs(data.endDate) : null);
    } catch {
      // Discount is optional
    }
  }, []);

  useEffect(() => {
    let timer;
    if (typeof window !== "undefined" && window.requestIdleCallback) {
      timer = window.requestIdleCallback(() => fetchDiscount(), {
        timeout: 2000,
      });
    } else {
      timer = setTimeout(() => fetchDiscount(), 100);
    }
    return () => {
      if (
        typeof window !== "undefined" &&
        window.requestIdleCallback &&
        typeof timer === "number"
      ) {
        window.cancelIdleCallback(timer);
      } else if (typeof timer !== "undefined") {
        clearTimeout(timer);
      }
    };
  }, [fetchDiscount]);

  if (filteredCars.length === 0) {
    return (
      <Container sx={{ mt: 2, mb: 2 }}>
        <Typography variant="body1" color="text.secondary" align="center">
          No cars available in this category at the moment.
        </Typography>
      </Container>
    );
  }

  return (
    <Container sx={{ mt: 2 }}>
      <Grid
        container
        spacing={{ sm: 2, sx: 0.4 }}
        direction="column"
        sx={{ alignItems: "center", alignContent: "center" }}
      >
        {filteredCars.map((car, index) => (
          <Grid item xs={12} sx={{ padding: 2 }} key={car._id}>
            <CarItemComponent
              car={car}
              discount={discount}
              discountStart={discountStart}
              discountEnd={discountEnd}
              isFirstCar={index === 0}
            />
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}

function getLowestPrice(car) {
  const tiers = car?.pricingTiers;
  if (!tiers) return Infinity;
  let min = Infinity;
  for (const tier of Object.values(tiers)) {
    if (tier?.days) {
      for (const price of Object.values(tier.days)) {
        if (typeof price === "number" && price < min) min = price;
      }
    }
  }
  return min;
}

export default FilteredCarsDisplay;
