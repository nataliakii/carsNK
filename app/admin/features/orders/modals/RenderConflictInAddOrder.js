import { Box, Typography } from "@mui/material";
import dayjs from "dayjs";

const formatDateTime = (date, time) => {
  if (!date) return null;

  // Форматируем дату
  const formattedDate = dayjs(date).format("DD.MM.YYYY");

  // Если есть время, форматируем его
  if (time) {
    // Проверяем, является ли время полной датой ISO
    const timeStr = time.includes("T") ? dayjs(time).format("HH:mm") : time;
    return `${formattedDate} (${timeStr})`;
  }

  return formattedDate;
};

// Вспомогательная функция для проверки пересечения дат
const isDateInRange = (date, startDate, endDate) => {
  const checkDate = dayjs(date);
  const start = dayjs(startDate);
  const end = dayjs(endDate);
  return checkDate.isAfter(start) && checkDate.isBefore(end);
};

export default function RenderConflictMessage({
  datesInRange,
  startDate,
  endDate,
  confirmed = false,
}) {
  if (!datesInRange?.length || !startDate || !endDate) return null;

  const currentBookingStart = dayjs(startDate);
  const currentBookingEnd = dayjs(endDate);

  // 1. Конфликты с началом бронирования (когда начало новой брони совпадает с концом существующей)
  const startConflicts = datesInRange.filter(
    (pending) =>
      pending.isEnd &&
      dayjs(pending.date).format("YYYY-MM-DD") ===
        currentBookingStart.format("YYYY-MM-DD")
  );

  // 2. Конфликты с концом бронирования (когда конец новой брони совпадает с началом существующей)
  const endConflicts = datesInRange.filter(
    (pending) =>
      pending.isStart &&
      dayjs(pending.date).format("YYYY-MM-DD") ===
        currentBookingEnd.format("YYYY-MM-DD")
  );

  // 3. Внутренние конфликты (когда даты существующего бронирования находятся внутри нового диапазона)
  const internalConflicts = datesInRange.filter((pending) => {
    const pendingDate = dayjs(pending.date);
    // Исключаем те даты, которые уже учтены в startConflicts и endConflicts
    const isAlreadyCounted =
      startConflicts.includes(pending) || endConflicts.includes(pending);

    return (
      !isAlreadyCounted &&
      isDateInRange(pendingDate, currentBookingStart, currentBookingEnd)
    );
  });

  return (
    <Box sx={{ mt: 2 }}>
      {startConflicts.length > 0 && (
        <Typography variant="body1" color="error" sx={{ mb: 1 }}>
          {confirmed && "Confirmed"} Конфликт с началом бронирования:
          {startConflicts.map((conflict, index) => (
            <span key={index}>
              {formatDateTime(conflict.date, conflict.timeEnd)}
              {index < startConflicts.length - 1 ? ", " : ""}
            </span>
          ))}
        </Typography>
      )}

      {endConflicts.length > 0 && (
        <Typography variant="body1" color="error" sx={{ mb: 1 }}>
          {confirmed && "Confirmed"} Конфликт с окончанием бронирования:
          {endConflicts.map((conflict, index) => (
            <span key={index}>
              {formatDateTime(conflict.date, conflict.timeStart)}
              {index < endConflicts.length - 1 ? ", " : ""}
            </span>
          ))}
        </Typography>
      )}

      {internalConflicts.length > 0 && (
        <Typography variant="body2" color="error" sx={{ mb: 1 }}>
          {confirmed && "Confirmed"} В выбранном диапазоне есть существующие
          бронирования:
          {internalConflicts.map((conflict, index) => (
            <span key={index}>
              {formatDateTime(conflict.date)}
              {index < internalConflicts.length - 1 ? ", " : ""}
            </span>
          ))}
        </Typography>
      )}
    </Box>
  );
}
