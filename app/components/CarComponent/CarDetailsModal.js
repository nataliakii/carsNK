import React from "react";
import { Modal, Box, Typography, Button, Grid } from "@mui/material";
import Image from "next/image";
import CarTypography from "@/app/components/ui/typography/CarTypography";
import { useTranslation } from "react-i18next";

const CarDetailsModal = ({ open, onClose, car }) => {
  const { t } = useTranslation();

  const additionalDetails = [
    {
      key: "registration",
      label: t("car.reg-year"),
      icon: "/icons/registration.png",
      getValue: (car) => car.registration,
    },
    {
      key: "regNumber",
      label: t("car.reg-numb"),
      icon: "/icons/regnumber.png",
      getValue: (car) => car.regNumber,
    },
    {
      key: "color",
      label: t("car.color"),
      icon: "/icons/color.png",
      getValue: (car) =>
        car.color ? car.color.charAt(0).toUpperCase() + car.color.slice(1) : "",
    },
    {
      key: "numberOfDoors",
      label: t("car.doors"),
      icon: "/icons/doors2.png",
      getValue: (car) => car.numberOfDoors,
    },
    {
      key: "enginePower",
      label: t("car.engine-pow"),
      icon: "/icons/engine_power.png",
      getValue: (car) =>
        car.enginePower || car.enginePower === 0
          ? `${car.enginePower} bhp`
          : "",
    },
    {
      key: "engine",
      label: t("car.engine"),
      icon: "/icons/engine.png",
      getValue: (car) => {
        if (car.engine || car.engine === 0) {
          const base =
            typeof car.engine === "string" && car.engine
              ? car.engine.charAt(0).toUpperCase() + car.engine.slice(1)
              : car.engine;
          return `${base} c.c.`;
        }
        return "";
      },
    },
  ];

  const defaultDetails = [
    {
      key: "class",
      label: t("car.class"),
      icon: "/icons/klass.png",
      getValue: (car) =>
        car.class ? car.class.charAt(0).toUpperCase() + car.class.slice(1) : "",
    },
    {
      key: "transmission",
      label: t("car.transmission"),
      icon: "/icons/transmission.png",
      getValue: (car) =>
        car.transmission
          ? car.transmission.charAt(0).toUpperCase() + car.transmission.slice(1)
          : "",
    },
    {
      key: "fueltype",
      label: t("car.fuel"),
      icon: "/icons/fuel.png",
      getValue: (car) =>
        car.fueltype
          ? car.fueltype.charAt(0).toUpperCase() + car.fueltype.slice(1)
          : "",
    },
    {
      key: "seats",
      label: t("car.seats"),
      icon: "/icons/seat.png",
      getValue: (car) => car.seats,
    },
    {
      key: "airConditioning",
      label: t("car.air"),
      icon: "/icons/ac.png",
      getValue: (car) => (car.airConditioning ? "Yes" : "No"),
    },
  ];

  // Финансовые / страховые детали, добавленные по запросу:
  const financialDetails = [
    {
      key: "PriceChildSeats",
      label: t("car.childSeatsPrice"),
      icon: "/icons/childseat.png",
      getValue: (car) =>
        car.PriceChildSeats || car.PriceChildSeats === 0
          ? `${car.PriceChildSeats} € / ${t("order.perDay")}`
          : "-",
    },
    {
      key: "insuranceTPLFree",
      label: t("car.insuranceTPLFree"), // Строка без значения, просто текст (исправлен ключ)
      icon: "/icons/insurance_tpl.png",
      getValue: () => "", // Ничего справа, вся информация в label
    },
    {
      key: "PriceKacko",
      label: t("car.KackoPrice"),
      icon: "/icons/insurance_kasko.png",
      getValue: (car) =>
        car.PriceKacko || car.PriceKacko === 0
          ? `${car.PriceKacko} € / ${t("order.perDay")}`
          : "-",
    },
    {
      key: "franchiseKacko",
      label: t("car.franchiseKacko"),
      icon: "/icons/franchise.png",
      getValue: (car) =>
        car.franchise || car.franchise === 0 ? `${car.franchise} €` : "-",
    },
    {
      key: "deposit",
      label: t("car.deposit"),
      icon: "/icons/deposit.png",
      getValue: (car) =>
        car.deposit && car.deposit > 0
          ? `${car.deposit} €`
          : t("car.noDeposit"),
    },
  ];

  const allDetails = [
    ...defaultDetails,
    ...additionalDetails,
    ...financialDetails,
  ];
  return (
    <Modal open={open} onClose={onClose} sx={{ textAlign: "center" }}>
      <Box
        onClick={() => onClose()}
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: { xs: "90%", sm: 400 },
          maxHeight: "90vh",
          bgcolor: "background.paper",
          boxShadow: 24,
          pt: 0,
          px: 4,
          pb: 4,
          overflowY: "auto",
          cursor: "pointer",
        }}
      >
        {/* Заголовок с названием автомобиля (липкий при прокрутке, непрозрачный фон) */}
        <Box
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 5,
            bgcolor: "background.default",
            py: 1,
            mb: 2,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography
            variant="h5"
            component="h2"
            sx={{
              textTransform: "uppercase",
              fontWeight: 700,
              color: "primary.main",
            }}
          >
            {car?.model || "Car Details"}
          </Typography>
        </Box>
        <Grid container direction="column" spacing={2}>
          {allDetails.map((detail) => (
            <Grid item key={detail.key}>
              <Grid container alignItems="center" spacing={2}>
                <Grid item>
                  <Image
                    src={detail.icon}
                    alt={detail.label}
                    width={24}
                    height={24}
                  />
                </Grid>
                <Grid item>
                  <CarTypography>
                    {detail.label}
                    {(() => {
                      const value = detail.getValue(car);
                      // Для insuranceTPLFree (строка без значения) двоеточие не выводим
                      if (detail.key === "insuranceTPLFree") return "";
                      // Если значение пустое или отсутствует, тоже не ставим двоеточие
                      if (value === "" || value === null || value === undefined)
                        return "";
                      return ": ";
                    })()}
                    {(() => {
                      const value = detail.getValue(car);
                      if (typeof value === "string" && value)
                        return value.charAt(0).toUpperCase() + value.slice(1);
                      return value;
                    })()}
                  </CarTypography>
                </Grid>
              </Grid>
            </Grid>
          ))}
        </Grid>
        <Button onClick={onClose} variant="contained" sx={{ mt: 3 }}>
          {t("basic.close")}
        </Button>
      </Box>
    </Modal>
  );
};

export default CarDetailsModal;
