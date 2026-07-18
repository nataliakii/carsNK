"use client";
import React, { useMemo } from "react";
import { Table, TableBody, TableRow, useTheme } from "@mui/material";
import { CalendarFirstColumn } from "../ui";
import CarTableRow from "./CalendarRow";
import CalendarHeader from "./CalendarHeader";

/**
 * Таблица календаря: sticky header, первая колонка, строки по машинам.
 */
export default function CalendarGrid(props) {
  const theme = useTheme();
  const data = props?.data ?? props;
  const actions = props?.actions ?? props;

  const safeHeaderData = data?.headerData ?? {
    days: data?.days ?? [],
    month: data?.month,
    year: data?.year,
    todayIndex: data?.todayIndex,
    highlightToday: data?.highlightToday,
    viewMode: data?.viewMode,
    rangeDirection: data?.rangeDirection,
    calendarDayRange: data?.calendarDayRange,
    monthNames: data?.monthNames,
    weekday2: data?.weekday2,
    currentLang: data?.currentLang,
    isPortraitPhone: data?.isPortraitPhone,
    headerStyles: data?.headerStyles,
    calendarRef: data?.calendarRef,
  };
  const {
    headerData = safeHeaderData,
    sortedCars,
    setMeasurementRef,
    enableOrderDrag,
    isDraggingOrder,
    dragOverCarId,
    draggingOrderId,
    allOrders,
    ordersByCarId,
    todayIndex,
    filteredStartEndDates,
    conflictMap,
    activeCell,
    moveMode,
    orderToMove,
    selectedMoveOrder,
    selectedOrderDates,
    calendarRef,
  } = data;
  const {
    handleEditCar,
    handleRowDragOver,
    handleRowDragLeave,
    handleRowDrop,
    isCarCompatibleForMove,
    ordersByCarIdWithAllorders,
    setSelectedOrders,
    setOpen,
    handleAddOrderClick,
    handleLongPress,
    handleCarSelectForMove,
    exitMoveMode,
    handleOrderDragStart,
    handleOrderDragEnd,
    onActiveCellChange,
  } = actions;

  const headerActions = useMemo(
    () => ({
      onPrevMonth: actions?.onPrevMonth,
      onNextMonth: actions?.onNextMonth,
      onMonthChange: actions?.onMonthChange,
      onYearChange: actions?.onYearChange,
      onDayClick: actions?.onDayClick,
    }),
    [
      actions?.onPrevMonth,
      actions?.onNextMonth,
      actions?.onMonthChange,
      actions?.onYearChange,
      actions?.onDayClick,
    ]
  );

  const days = headerData?.days ?? [];
  const carsToRender = sortedCars ?? [];

  return (
    <Table
      stickyHeader
      sx={{
        width: "100%",
        minWidth: 0,
        tableLayout: "fixed",
      }}
    >
      <CalendarHeader data={headerData} actions={headerActions} />
      <TableBody>
        {carsToRender.map((car, index) => (
          <TableRow key={car._id}>
            <CalendarFirstColumn
              ref={index === 0 ? setMeasurementRef : null}
              onClick={() => handleEditCar(car)}
              title="Нажмите для редактирования информации об автомобиле"
              onDragOver={
                enableOrderDrag
                  ? (e) => handleRowDragOver(e, car)
                  : undefined
              }
              onDragLeave={
                enableOrderDrag ? handleRowDragLeave : undefined
              }
              onDrop={
                enableOrderDrag ? (e) => handleRowDrop(e, car) : undefined
              }
              sx={
                enableOrderDrag &&
                isDraggingOrder &&
                dragOverCarId != null &&
                String(dragOverCarId) === String(car._id)
                  ? {
                      boxShadow: `inset 0 0 0 2px ${
                        isCarCompatibleForMove(car._id)
                          ? theme.palette.success.main
                          : theme.palette.error.main
                      }`,
                      ...(!isCarCompatibleForMove(car._id)
                        ? { cursor: "not-allowed" }
                        : {}),
                    }
                  : undefined
              }
            >
              {car.model} {car.regNumber}
            </CalendarFirstColumn>

            <CarTableRow
              key={car._id}
              car={car}
              rowIndex={index}
              activeDayIndex={activeCell?.carIndex === index ? activeCell?.dayIndex : -1}
              onCellFocus={onActiveCellChange}
              calendarRef={calendarRef}
              orders={ordersByCarIdWithAllorders(car._id, allOrders)}
              days={days}
              ordersByCarId={ordersByCarId}
              setSelectedOrders={setSelectedOrders}
              setOpen={setOpen}
              onAddOrderClick={handleAddOrderClick}
              todayIndex={todayIndex}
              onLongPress={handleLongPress}
              filteredStartEndDates={filteredStartEndDates}
              conflictByDay={conflictMap?.[String(car?._id)] || null}
              moveMode={moveMode}
              onCarSelectForMove={handleCarSelectForMove}
              orderToMove={orderToMove}
              selectedMoveOrder={selectedMoveOrder}
              onExitMoveMode={exitMoveMode}
              selectedOrderDates={selectedOrderDates}
              isCarCompatibleForMove={isCarCompatibleForMove(car._id)}
              enableOrderDrag={enableOrderDrag}
              isDraggingOrder={isDraggingOrder}
              dragOverCarId={dragOverCarId}
              draggingOrderId={draggingOrderId}
              onOrderDragStart={handleOrderDragStart}
              onOrderDragEnd={handleOrderDragEnd}
              onRowDragOver={handleRowDragOver}
              onRowDragLeave={handleRowDragLeave}
              onRowDrop={handleRowDrop}
            />
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
