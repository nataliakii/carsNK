import React, { useState } from "react";
import {
  Box,
  Typography,
  Grid,
  Button,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import TimeToLeaveIcon from "@mui/icons-material/TimeToLeave";
import AcUnitIcon from "@mui/icons-material/AcUnit";
import SpeedIcon from "@mui/icons-material/Speed";
// import PricingTiers from "./PricingTiers";
import Image from "next/image";
import CarDetailsModal from "./CarDetailsModal";
import CarTypography from "@/app/components/ui/typography/CarTypography";
import { useTranslation } from "react-i18next";

const CarTitle = styled(Typography)(({ theme }) => ({
  fontSize: "1.5rem",
  textTransform: "uppercase",
  fontWeight: 700,
  marginBottom: theme.spacing(1.7),
  marginTop: theme.spacing(2.5),
}));

const CarDetails = ({ car }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isPortraitPhone = useMediaQuery(
    "(max-width:600px) and (orientation: portrait)"
  );

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
      getValue: (car) => `${car.enginePower} HP`,
    },
    {
      key: "engine",
      label: t("car.engine"),
      icon: "/icons/engine.png",
      getValue: (car) => car.engine,
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
      getValue: (car) => car.airConditioning,
      showOnlyIfTrue: true,
    },
  ];

  const allDetails = [...additionalDetails, ...defaultDetails];

  // Ограничиваем количество параметров на мобильных для помещения в одну строку
  const getVisibleDetails = () => {
    if (isMobile) {
      // На мобильных показываем все 5 основных параметров включая кондиционер
      return defaultDetails.filter(
        (detail) => !detail.showOnlyIfTrue || detail.getValue(car)
      );
    }
    return defaultDetails.filter(
      (detail) => !detail.showOnlyIfTrue || detail.getValue(car)
    );
  };

  return (
    <>
      {/*
      <CarTitle
        sx={{
          width: "60%",
          textAlign: "center",
          mb: { xs: 1, sm: 2 }, // Уменьшенный отступ снизу на мобильных
        }}
        variant="h5"
      >
        {car.model}
      </CarTitle>
      */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          alignItems: "center",
          px: isPortraitPhone ? 0.5 : { xs: 1, sm: 3 }, // на портретном телефоне плотнее
          width: "100%", // Ограничиваем ширину контейнера
          maxWidth: { xs: "100%", md: "450px" }, // Максимальная ширина как у фото
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "row", sm: "column" }, // На мобильных - в строку, на десктопе - в столбик
            flexWrap: "nowrap", // Запрещаем перенос строки
            gap: { xs: 0.05, sm: 0.4 }, // Уменьшили gap на десктопе для более компактного отображения
            justifyContent: { xs: "center", sm: "flex-start" }, // На мобильных по центру, на десктопе по левому краю
            alignItems: { xs: "center", sm: "flex-start" }, // На десктопе выравниваем по левому краю
            mb: isPortraitPhone ? 0.5 : { xs: 1, sm: 2 },
            width: "100%",
            overflow: "hidden", // Скрываем то что не помещается
          }}
        >
          {getVisibleDetails().map((detail) => (
            <Box
              key={detail.key}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: { xs: 0.2, sm: 0.3 }, // Уменьшили gap на десктопе с 0.6 до 0.3
                flex: "0 0 auto", // Не растягиваем, не сжимаем
                minWidth: 0, // Позволяем сжатие при необходимости
                width: { xs: "auto", sm: "100%" }, // На десктопе занимаем всю ширину
                justifyContent: { xs: "center", sm: "flex-start" }, // На десктопе выравниваем по левому краю
              }}
            >
              <Image
                src={detail.icon}
                alt={detail.label}
                width={20}
                height={20}
              />
              {/* Название параметра - только на десктопе */}
              <Typography
                variant="body2"
                sx={{
                  display: { xs: "none", sm: "block" }, // Скрываем на мобильных
                  fontSize: "0.85rem",
                  color: "text.secondary",
                  // Убираем minWidth для естественной ширины текста
                  flexShrink: 0,
                  lineHeight: 1, // Устанавливаем одинаковую высоту строки
                }}
              >
                {detail.label}:
              </Typography>
              {/* Логика отображения значения параметра */}
              {detail.showOnlyIfTrue ? (
                // Для кондиционера - на десктопе показываем Yes/No, на мобильных только если true
                isMobile ? (
                  detail.getValue(car) && (
                    <CarTypography
                      variant="body2"
                      sx={{
                        fontSize: "0.85rem",
                        color: "text.primary",
                      }}
                    >
                      {/* На мобильных для кондиционера ничего не показываем, только иконка */}
                    </CarTypography>
                  )
                ) : (
                  // На десктопе всегда показываем Yes/No для кондиционера
                  <CarTypography
                    variant="body2"
                    sx={{
                      fontSize: "0.95rem",
                      color: "text.primary",
                      lineHeight: 1, // Устанавливаем одинаковую высоту строки
                    }}
                  >
                    {detail.getValue(car) ? "Yes" : "No"}
                  </CarTypography>
                )
              ) : (
                // Для обычных параметров всегда показываем значение
                <CarTypography
                  variant="body2"
                  sx={{
                    fontSize: { xs: "0.85rem", sm: "0.95rem" },
                    whiteSpace: "nowrap", // Запрещаем перенос текста
                    overflow: "hidden",
                    textOverflow: "ellipsis", // Многоточие если не помещается
                    color: "text.primary",
                    lineHeight: 1, // Устанавливаем одинаковую высоту строки
                  }}
                >
                  {detail.getValue(car)}
                </CarTypography>
              )}
            </Box>
          ))}
        </Box>

        <CarDetailsModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          car={car}
          additionalDetails={allDetails}
        />

        {/* <PricingTiers prices={car?.pricingTiers} /> */}
      </Box>
    </>
  );
};

export default CarDetails;
