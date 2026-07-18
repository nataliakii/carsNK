"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Container, Grid } from "@mui/material";
import CarItemComponent from "./CarComponent/CarItemComponent";
import { useMainContext } from "../Context";
import dayjs from "dayjs";

function SingleCarDisplay({ carSlug }) {
  const { cars } = useMainContext();
  const car = useMemo(
    () => cars.find((c) => c.slug === carSlug),
    [cars, carSlug]
  );

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
      // Discount is optional — silent failure
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
      if (typeof window !== "undefined" && window.requestIdleCallback && typeof timer === "number") {
        window.cancelIdleCallback(timer);
      } else if (typeof timer !== "undefined") {
        clearTimeout(timer);
      }
    };
  }, [fetchDiscount]);

  if (!car) return null;

  return (
    <Container sx={{ mt: 2 }}>
      <Grid
        container
        spacing={{ sm: 2, sx: 0.4 }}
        direction="column"
        sx={{ alignItems: "center", alignContent: "center" }}
      >
        <Grid item xs={12} sx={{ padding: 2 }}>
          <CarItemComponent
            car={car}
            discount={discount}
            discountStart={discountStart}
            discountEnd={discountEnd}
            isFirstCar={true}
          />
        </Grid>
      </Grid>
    </Container>
  );
}

export default SingleCarDisplay;
