"use client";
import React from "react";
import { Modal, Grid, Box, Typography } from "@mui/material";
import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(utc);
dayjs.extend(timezone);

import {
  ActionButton,
  CancelButton,
  OrdersByDateModal,
  ModalLayout,
} from "../ui";
import EditOrderModal from "@/app/admin/features/orders/modals/EditOrderModal";
import AddOrderModal from "@/app/admin/features/orders/modals/AddOrderModal";
import OrderUnsavedCloseDialog from "@/app/admin/features/orders/components/OrderUnsavedCloseDialog";
import EditCarModal from "@/app/admin/features/cars/modals/EditCarModal";
import { isPast } from "@utils/businessTime";

/**
 * Модалки и всплывающий UI календаря (вне корневого layout таблицы).
 */
export default function CalendarOverlays({
  data,
  actions,
}) {
  const {
    open,
    selectedOrders,
    startEndDates,
    cars,
    unsavedEditDialogOpen,
    unsavedEditSaving,
    isAddOrderOpen,
    selectedCarForAdd,
    selectedDateForAdd,
    headerOrdersModal,
    startedOrders,
    endedOrders,
    confirmModal,
    isEditCarOpen,
    selectedCarForEdit,
    addOrderTimeoutRef,
    updateCarInContext,
    enqueueSnackbar,
  } = data;
  const {
    handleEditModalBackdropClose,
    tryCloseEditModal,
    performEditModalClose,
    registerEditOrderCloseGuard,
    handleSaveOrder,
    setIsConflictOrder,
    handleUnsavedEditCancel,
    handleUnsavedEditDiscard,
    handleUnsavedEditSave,
    setIsAddOrderOpen,
    fetchAndUpdateOrders,
    setForceUpdateKey,
    setHeaderOrdersModal,
    getRegNumberByCarNumber,
    handleCloseConfirmModal,
    handleConfirmMove,
    setIsEditCarOpen,
    setSelectedCarForEdit,
  } = actions;

  return (
    <>
      {/* Модальные окна — вне BigCalendarLayout */}

      {/* Модальное окно редактирования заказов - открывается только при обычном клике */}
      <Modal
        open={open}
        onClose={handleEditModalBackdropClose}
        sx={{
          display: "flex",
          alignItems: { xs: "flex-start", sm: "center" },
          justifyContent: "center",
          overflowY: { xs: "auto", sm: "hidden" },
        }}
      >
        <Box
          onClick={(e) => {
            // Закрываем модал при клике на backdrop (вне контента)
            if (e.target === e.currentTarget) {
              tryCloseEditModal();
            }
          }}
          sx={{
            display: "flex",
            alignItems: { xs: "flex-start", sm: "center" },
            justifyContent: { xs: "flex-start", sm: "center" },
            width: "100%",
            minHeight: "100%",
            overflowY: "auto",
            overflowX: "hidden",
            p: { xs: 0.75, sm: 2 },
          }}
        >
          <Grid
            container
            spacing={selectedOrders.length > 1 ? 2 : 0}
            justifyContent="center"
            alignItems="flex-start"
            onClick={(e) => e.stopPropagation()} // Предотвращаем закрытие при клике на контент
            sx={{
              width: "100%",
              maxWidth: { xs: "95vw", sm: "92vw", md: "1100px" },
              maxHeight: { xs: "none", sm: "100%" },
              overflowY: {
                xs: "visible",
                sm: selectedOrders.length > 1 ? "auto" : "visible",
              },
              overflowX: "hidden",
              my: { xs: 0.5, sm: 0 },
              "&::-webkit-scrollbar": {
                width: "4px",
              },
              "&::-webkit-scrollbar-thumb": {
                backgroundColor: "primary.main",
                borderRadius: "4px",
              },
              "&::-webkit-scrollbar-track": {
                backgroundColor: "background.paper",
              },
            }}
          >
            {/* Сортировка: сначала ранние, затем поздние */}
            {[...selectedOrders]
              .sort(
                (a, b) =>
                  dayjs(a.rentalStartDate).valueOf() -
                  dayjs(b.rentalStartDate).valueOf()
              )
              .map((order, index) => (
                <Grid
                  item
                  key={order._id}
                  xs={12}
                  sm={selectedOrders.length > 1 ? 6 : 12}
                  md={
                    selectedOrders.length === 1
                      ? 12
                      : selectedOrders.length === 2
                      ? 6
                      : selectedOrders.length === 3
                      ? 4
                      : 3
                  }
                >
                  <EditOrderModal
                    order={order}
                    open={open}
                    onClose={performEditModalClose}
                    onRequestClose={tryCloseEditModal}
                    registerEditOrderCloseGuard={registerEditOrderCloseGuard}
                    onSave={handleSaveOrder}
                    isConflictOrder={selectedOrders.length > 1 ? true : false}
                    setIsConflictOrder={setIsConflictOrder}
                    startEndDates={startEndDates}
                    cars={cars}
                    isViewOnly={isPast(order.rentalEndDate)}
                    ordersInBatch={selectedOrders.length}
                  />
                </Grid>
              ))}
          </Grid>
        </Box>
      </Modal>

      <OrderUnsavedCloseDialog
        open={unsavedEditDialogOpen}
        onClose={handleUnsavedEditCancel}
        onDiscard={handleUnsavedEditDiscard}
        onSaveAndExit={handleUnsavedEditSave}
        saving={unsavedEditSaving}
      />

      {/* AddOrderModal для создания нового заказа */}
      {isAddOrderOpen && selectedCarForAdd && (
        <AddOrderModal
          open={isAddOrderOpen}
          onClose={() => setIsAddOrderOpen(false)}
          car={selectedCarForAdd}
          date={selectedDateForAdd}
          setUpdateStatus={(status) => {
            if (status?.type === 200) {
              fetchAndUpdateOrders();
              setForceUpdateKey((prev) => prev + 1); // триггер перерисовки
              // 🔧 PERF FIX: Track timeout with ref to prevent memory leak
              // Автоматически закрываем модальное окно после успешного создания
              if (addOrderTimeoutRef.current) {
                clearTimeout(addOrderTimeoutRef.current);
              }
              addOrderTimeoutRef.current = setTimeout(() => {
                setIsAddOrderOpen(false);
                addOrderTimeoutRef.current = null;
              }, 1500);
            }
          }}
        />
      )}

      {/* Модальное окно для заказов по дате в шапке */}
      <OrdersByDateModal
        open={headerOrdersModal.open}
        onClose={() =>
          setHeaderOrdersModal({ ...headerOrdersModal, open: false })
        }
        date={headerOrdersModal.date}
        startedOrders={startedOrders}
        endedOrders={endedOrders}
        getRegNumberByCarNumber={getRegNumberByCarNumber}
      />

      {/* Модальное окно подтверждения перемещения */}
      <ModalLayout
        open={confirmModal.open}
        onClose={handleCloseConfirmModal}
        title="Подтверждение перемещения"
        size="small"
        centerVertically={false}
      >
        <Typography sx={{ mb: 3, color: "text.primary" }}>
          Вы хотите сдвинуть заказ с автомобиля{" "}
          <strong>{confirmModal.oldCar?.model}</strong> (
          {confirmModal.oldCar?.regNumber}) на автомобиль{" "}
          <strong>{confirmModal.newCar?.model}</strong> (
          {confirmModal.newCar?.regNumber})?
        </Typography>

        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
          <CancelButton onClick={handleCloseConfirmModal} label="НЕТ" />
          <ActionButton
            color="success"
            onClick={handleConfirmMove}
            label="ДА"
          />
        </Box>
      </ModalLayout>

      {isEditCarOpen && selectedCarForEdit && (
        <EditCarModal
          open={isEditCarOpen}
          onClose={() => {
            setIsEditCarOpen(false);
            setSelectedCarForEdit(null);
          }}
          updatedCar={selectedCarForEdit}
          setUpdatedCar={setSelectedCarForEdit}
          updateCarInContext={updateCarInContext}
          handleChange={(e) =>
            setSelectedCarForEdit((prev) => ({
              ...prev,
              [e.target.name]: e.target.value,
            }))
          }
          handleCheckboxChange={(e) =>
            setSelectedCarForEdit((prev) => ({
              ...prev,
              [e.target.name]: e.target.checked,
            }))
          }
          handleUpdate={async () => {
            const response = await updateCarInContext(selectedCarForEdit);
            if (response?.type === 200) {
              enqueueSnackbar("Машина обновлена", { variant: "success" });
              fetchAndUpdateOrders();
              setIsEditCarOpen(false);
            } else {
              enqueueSnackbar("Ошибка обновления", { variant: "error" });
            }
          }}
        />
      )}
    </>
  );
}
