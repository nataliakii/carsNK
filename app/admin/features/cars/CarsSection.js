"use client";

import React from "react";
import { Box } from "@mui/material";
import Cars from "./Cars";
import AddCarModal from "./modals/AddCarModal";
import { useCars } from "./useCars";

/**
 * CarsSection - секция управления автомобилями
 * Feature component - lazy-loaded
 * 
 * @param {object} props
 * @param {boolean} props.isAddModalOpen - управляется из AdminViewContent
 * @param {function} props.closeAddModal - callback для закрытия модала
 * @param {function} props.setNotification - callback для уведомлений
 */
export default function CarsSection({ 
  isAddModalOpen = false, 
  closeAddModal, 
  setNotification: externalSetNotification 
}) {
  const {
    cars,
    deleteCar,
    setNotification: localSetNotification,
    resubmitCars,
  } = useCars();

  // Используем внешний setNotification если передан, иначе локальный
  const setNotification = externalSetNotification || localSetNotification;
  
  // Безопасный callback для закрытия (на случай если не передан)
  const handleCloseModal = closeAddModal || (() => {});

  return (
    <Box sx={{ px: { xs: 1, md: 2 }, pb: 6 }}>
      <Cars
        onCarDelete={deleteCar}
        setUpdateStatus={setNotification}
      />
      
      <AddCarModal
        open={isAddModalOpen}
        onClose={handleCloseModal}
        car={cars[0]}
        setUpdateStatus={setNotification}
        fetchAndUpdateCars={resubmitCars}
      />
    </Box>
  );
}

