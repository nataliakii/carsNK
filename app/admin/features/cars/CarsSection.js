"use client";

import React from "react";
import { Box } from "@mui/material";
import Cars from "./Cars";
import AddCarModal from "./modals/AddCarModal";
import BulkAddCarsModal from "./modals/BulkAddCarsModal";
import { useCars } from "./useCars";

/**
 * CarsSection - секция управления автомобилями
 */
export default function CarsSection({
  isAddModalOpen = false,
  closeAddModal,
  isBulkModalOpen = false,
  closeBulkModal,
  setNotification: externalSetNotification,
}) {
  const {
    cars,
    deleteCar,
    setNotification: localSetNotification,
    resubmitCars,
  } = useCars();

  const setNotification = externalSetNotification || localSetNotification;
  const handleCloseModal = closeAddModal || (() => {});
  const handleCloseBulk = closeBulkModal || (() => {});

  return (
    <Box sx={{ px: { xs: 1, md: 2 }, pb: 6 }}>
      <Cars onCarDelete={deleteCar} setUpdateStatus={setNotification} />

      <AddCarModal
        open={isAddModalOpen}
        onClose={handleCloseModal}
        car={cars[0]}
        setUpdateStatus={setNotification}
        fetchAndUpdateCars={resubmitCars}
      />

      <BulkAddCarsModal
        open={isBulkModalOpen}
        onClose={handleCloseBulk}
        setUpdateStatus={setNotification}
      />
    </Box>
  );
}
