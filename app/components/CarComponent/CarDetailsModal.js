"use client";

import React, { useMemo } from "react";
import { Modal, Box, Typography, Button, Divider } from "@mui/material";
import { useTranslation } from "react-i18next";
import { buildCarSpecGroups } from "@/domain/cars/carSpecs";
import CarSpecSection from "./CarSpecList";
import CarPhoto from "./CarPhoto";

/**
 * Enlarged detail sheet: photo + the same specification rows the card shows.
 * Spec rows come from buildCarSpecGroups, so labels/formatting cannot drift
 * away from the catalog card.
 */
const CarDetailsModal = ({ open, onClose, car }) => {
  const { t } = useTranslation();
  const groups = useMemo(() => buildCarSpecGroups(car, t), [car, t]);

  return (
    <Modal open={open} onClose={onClose}>
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
          <Box
            sx={{
              position: "relative",
              width: "100%",
              aspectRatio: "3 / 2",
              borderRadius: 1.5,
              overflow: "hidden",
              bgcolor: "action.hover",
              mb: 2.5,
            }}
          >
            <CarPhoto
              photoUrl={car?.photoUrl}
              alt={car?.model || ""}
              sizes="(max-width: 600px) 92vw, 480px"
            />
          </Box>

          {groups.map((group, index) => (
            <React.Fragment key={group.id}>
              {index > 0 ? <Divider sx={{ my: 1.75 }} /> : null}
              {/* Single column: the sheet is only ~480px wide. */}
              <CarSpecSection
                title={group.title}
                items={group.items}
                columns={1}
              />
            </React.Fragment>
          ))}

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
