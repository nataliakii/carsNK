"use client";

import React, { Suspense, lazy, useMemo } from "react";
import { Modal, Box, Typography, Button, Divider } from "@mui/material";
import { useTranslation } from "react-i18next";
import { buildCarSpecGroups } from "@/domain/cars/carSpecs";
import CarSpecSection from "./CarSpecList";

const CarDeliveryInfo = lazy(() => import("./CarDeliveryInfo"));

/**
 * Detail sheet: full specs and delivery / available-in cities (no photo —
 * the card already shows the image). Spec rows come from buildCarSpecGroups
 * so labels stay in sync with the card.
 */
const CarDetailsModal = ({ open, onClose, car, company }) => {
  const { t } = useTranslation();
  const groups = useMemo(() => buildCarSpecGroups(car, t), [car, t]);

  return (
    <Modal open={open} onClose={onClose} aria-labelledby="car-details-title">
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: { xs: "92%", sm: 480 },
          maxHeight: "90vh",
          bgcolor: "background.paper",
          borderRadius: 2,
          boxShadow: 24,
          overflowY: "auto",
          outline: "none",
        }}
      >
        <Box
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 5,
            bgcolor: "background.paper",
            px: { xs: 2, sm: 3 },
            py: 1.5,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography
            id="car-details-title"
            variant="h6"
            component="h2"
            sx={{
              textTransform: "uppercase",
              fontWeight: 700,
              color: "primary.main",
              lineHeight: 1.2,
            }}
          >
            {car?.model || t("car.model")}
          </Typography>
        </Box>

        <Box sx={{ px: { xs: 2, sm: 3 }, pb: 3, pt: 2 }}>
          {groups.map((group, index) => (
            <React.Fragment key={group.id}>
              {index > 0 ? <Divider sx={{ my: 1.75 }} /> : null}
              <CarSpecSection
                title={group.title}
                items={group.items}
                columns={1}
              />
            </React.Fragment>
          ))}

          <Divider sx={{ my: 2, borderStyle: "dashed" }} />

          <Suspense fallback={null}>
            <CarDeliveryInfo car={car} company={company} />
          </Suspense>

          <Button
            onClick={onClose}
            variant="contained"
            fullWidth
            sx={{ mt: 3 }}
          >
            {t("basic.close")}
          </Button>
        </Box>
      </Box>
    </Modal>
  );
};

export default CarDetailsModal;
