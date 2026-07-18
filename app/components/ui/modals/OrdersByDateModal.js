"use client";

import React from "react";
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Grid,
  Divider,
  Paper
} from "@mui/material";
import { formatDate, formatDateRange } from "@utils/businessTime";
import ModalLayout from "./ModalLayout";
import { ActionButton } from "../index";

/**
 * Модальное окно заказов по дате
 * Показывает заказы, начинающиеся и заканчивающиеся в указанную дату
 * 
 * @param {boolean} open - открыто ли окно
 * @param {function} onClose - обработчик закрытия
 * @param {dayjs} date - дата для отображения
 * @param {Array} startedOrders - заказы, начинающиеся в эту дату
 * @param {Array} endedOrders - заказы, заканчивающиеся в эту дату
 * @param {function} getRegNumberByCarNumber - функция для получения госномера
 */
const OrdersByDateModal = ({
  open,
  onClose,
  date,
  startedOrders = [],
  endedOrders = [],
  getRegNumberByCarNumber,
}) => {
  const cellSx = {
    whiteSpace: "nowrap",
  };

  const formatPlaceWithThessalonikiDetail = (place, detail) => {
    const p = String(place || "").trim();
    const d = String(detail || "").trim();
    if (!p) return "-";
    if (p.toLowerCase() === "thessaloniki" && d) return `${p} — ${d}`;
    return p;
  };

  const renderOrdersTable = (orders, emptyMessage, isStartingOrders = false) => {
    if (orders.length === 0) {
      return (
        <Typography align="center" sx={{ color: "text.secondary", py: 2 }}>
          {emptyMessage}
        </Typography>
      );
    }

    return (
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ ...cellSx, fontWeight: 600 }}>Машина</TableCell>
            <TableCell sx={{ ...cellSx, fontWeight: 600 }}>Госномер</TableCell>
            <TableCell sx={{ ...cellSx, fontWeight: 600 }}>Срок</TableCell>
            <TableCell sx={{ ...cellSx, fontWeight: 600 }}>Клиент</TableCell>
            <TableCell sx={{ ...cellSx, fontWeight: 600 }}>Телефон</TableCell>
            {isStartingOrders ? (
              <>
                <TableCell sx={{ ...cellSx, fontWeight: 600 }}>Место получения</TableCell>
                <TableCell sx={{ ...cellSx, fontWeight: 600 }}>Номер рейса</TableCell>
              </>
            ) : (
              <TableCell sx={{ ...cellSx, fontWeight: 600 }}>Место возврата</TableCell>
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {orders.map((order, idx) => (
            <TableRow key={order._id || idx}>
              <TableCell sx={cellSx}>{order.carModel}</TableCell>
              <TableCell sx={cellSx}>
                {getRegNumberByCarNumber
                  ? getRegNumberByCarNumber(order.carNumber)
                  : order.carNumber}
              </TableCell>
              <TableCell sx={cellSx}>
                {order.rentalStartDate
                  ? formatDateRange(order.rentalStartDate, order.rentalEndDate)
                  : ""}
              </TableCell>
              {/* Скрываем PII если _visibility.hideClientContacts === true */}
              <TableCell sx={cellSx}>
                {order._visibility?.hideClientContacts ? "—" : order.customerName}
              </TableCell>
              <TableCell sx={cellSx}>
                {order._visibility?.hideClientContacts ? "—" : order.phone}
              </TableCell>
              {isStartingOrders ? (
                <>
                  <TableCell sx={cellSx}>
                    {formatPlaceWithThessalonikiDetail(
                      order.placeIn,
                      order.placeInDetail
                    )}
                  </TableCell>
                  <TableCell sx={cellSx}>
                    {order.placeIn && order.placeIn.toLowerCase() === "airport"
                      ? order.flightNumber || "-"
                      : "-"}
                  </TableCell>
                </>
              ) : (
                <TableCell sx={cellSx}>
                  {formatPlaceWithThessalonikiDetail(
                    order.placeOut,
                    order.placeOutDetail
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
<ModalLayout
  open={open}
  onClose={onClose}
  size="fullWidth"
  showCloseButton={true}
  closeOnBackdropClick={false}
  closeOnEscape={true}
>
    <Box id="print-orders-modal">
    <Grid     
    sx={{
      maxWidth: 1000,
      py: 2,
    }} container spacing={3} >
      {/* НАЧИНАЮЩИЕСЯ ЗАКАЗЫ */}
      <Grid item xs={12} >
        <Paper
          elevation={2}
          sx={{
            p: 3,
            height: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Typography
            variant="h6"
            align="center"
            sx={{ fontWeight: 600, mb: 1 }}
          >
            Заказы, начинающиеся {date && formatDate(date, "DD.MM.YY")}
          </Typography>

          <Divider sx={{ mb: 2 }} />

          {renderOrdersTable(
            startedOrders,
            "Нет заказов, начинающихся в эту дату",
            true
          )}
        </Paper>
      </Grid>

      {/* ЗАКАНЧИВАЮЩИЕСЯ ЗАКАЗЫ */}
      <Grid item xs={12}>
        <Paper
          elevation={2}
          sx={{
            p: 3,
            height: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Typography
            variant="h6"
            align="center"
            sx={{ fontWeight: 600, mb: 1 }}
          >
            Заказы, заканчивающиеся {date && formatDate(date, "DD.MM.YY")}
          </Typography>

          <Divider sx={{ mb: 2 }} />

          {renderOrdersTable(
            endedOrders,
            "Нет заказов, заканчивающихся в эту дату",
            false
          )}
        </Paper>
      </Grid>
    </Grid>

    {/* КНОПКИ */}
    <Box
      className="no-print"
      sx={{
        mt: 4,
        display: "flex",
        justifyContent: "center",
        gap: 2,
      }}
    >
      <ActionButton
        variant="outlined"
        color="warning"
        size="small"
        onClick={onClose}
        label="ЗАКРЫТЬ"
      />

      <ActionButton
        color="secondary"
        size="small"
        onClick={() => window.print()}
        label="ПЕЧАТЬ"
      />

  </Box>
    </Box>
</ModalLayout>

  );
};

export default OrdersByDateModal;

