import { useState, useEffect } from "react";
import { Grid, Box, Typography, Button } from "@mui/material";
import dayjs from "dayjs";
import { useMainContext } from "@app/Context";
import { deleteOrder } from "@/utils/action";

const mappingTypes = {
  1: "Изменение дат создало конфликт бронирования с даныи датами",
  2: "Брони которые не позволяют занять указанные даты",
  3: "У єтого заказа есть конфликтующие бронирования",
};

export default function ConflictMessage({
  initialConflicts,
  type,
  setUpdateMessage,
}) {
  const { fetchAndUpdateOrders } = useMainContext();
  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState(initialConflicts);

  useEffect(() => {
    setConflicts(initialConflicts);
  }, [initialConflicts]);

  const handleDeleteOrder = async (orderId) => {
    setLoading(true);
    try {
      const result = await deleteOrder(orderId);

      if (!result.success) {
        setUpdateMessage(result.message || "Failed to delete order");
        throw new Error(result.message || "Failed to delete order");
      }
      await fetchAndUpdateOrders();
      setConflicts((prevConflicts) =>
        prevConflicts.filter((o) => o._id !== orderId)
      );
      setUpdateMessage("Order deleted successfully");
    } catch (error) {
      console.error("Failed to delete order:", error);
      setUpdateMessage(`Failed to delete order: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (
    !conflicts ||
    conflicts.length < 1 ||
    !initialConflicts ||
    initialConflicts.length < 1
  )
    return;

  return (
    <Box width="100%">
      <Typography
        variant="h6"
        color={type == 1 ? "primary.main" : "error"}
        sx={{ lineHeight: "1.2rem", my: 1 }}
      >
        {mappingTypes[type]}
      </Typography>

      <Grid container spacing={2}>
        {conflicts.map((o) => (
          <Grid item sx={12} sm={12} md={6} key={o.id || o._id}>
            <Box border={1} borderColor="grey.300" p={2} borderRadius={2}>
              <Typography variant="body1" fontWeight="bold">
                {o.customerName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Бронь с {dayjs(o.rentalStartDate).format("MMM D")} по{" "}
                {dayjs(o.rentalEndDate).format("MMM D")}
              </Typography>
              <Typography variant="body2">{o.email}</Typography>
              <Typography variant="body2">{o.phone}</Typography>
              <Typography
                variant="body2"
                color={o.confirmed ? "success.main" : "error"}
              >
                {o.confirmed ? "Подтвержден" : "НЕ Подтвержден"}
              </Typography>
              <Button
                variant="contained"
                color="error"
                onClick={() => handleDeleteOrder(o.id || o._id)}
                disabled={loading}
                sx={{ mt: 2 }}
              >
                Удалить
              </Button>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
