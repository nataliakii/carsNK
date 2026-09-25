"use client";

import { Box, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import { isPlatformBooking, contractorOrderModalStage } from "@/domain/admin/rovaroContractorAdmin";
import SupplierResponseCell from "@/app/admin/features/orders/components/SupplierResponseCell";

const Panel = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(1),
  marginBottom: theme.spacing(1.5),
  padding: theme.spacing(1.5),
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: theme.palette.divider,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.background.default,
}));

const Title = styled(Typography)(({ theme }) => ({
  fontWeight: theme.typography.fontWeightBold,
  color: theme.palette.primary.main,
}));

const Detail = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  marginTop: theme.spacing(0.5),
}));

const Actions = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(1.5),
}));

export default function OrderLiveStagePanel({
  order,
  busy = false,
  showActions = false,
  onRespond,
  onChanged,
}) {
  const { t } = useTranslation();
  if (!isPlatformBooking(order)) return null;
  const view = contractorOrderModalStage(order);
  if (!view?.title) return null;

  return (
    <Panel>
      <Title variant="subtitle1">
        {t(view.titleKey, { defaultValue: view.title })}
      </Title>
      {view.detail ? (
        <Detail variant="body2">
          {t(view.detailKey, { defaultValue: view.detail })}
        </Detail>
      ) : null}
      {showActions && view.supplierActions && typeof onRespond === "function" ? (
        <Actions>
          <SupplierResponseCell
            order={order}
            isClient
            busy={busy}
            onRespond={onRespond}
            onChanged={onChanged}
            onViewDetails={() => {}}
          />
        </Actions>
      ) : null}
    </Panel>
  );
}
