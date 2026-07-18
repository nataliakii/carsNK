// import React from "react";
// import { DateRangePicker } from "@mui/x-date-pickers-pro/DateRangePicker";
// import { Chip, Box, Typography } from "@mui/material";
// import { PickersDay } from "@mui/x-date-pickers/PickersDay";
// import { analyzeDates } from "@utils/analyzeDates";
// import dayjs from "dayjs";
// import { useTranslation } from "react-i18next";

// const CustomCalendarPicker = ({ orders, setBookedDates }) => {
//   const { confirmed, pending } = analyzeDates(orders);

//   const isConfirmedDate = (date) => {
//     // const filteredConfirmed = confirmed.filter((item) => {
//     //   return !item.isStart && !item.isEnd;
//     // });

//     return confirmed.some(
//       (booking) =>
//         dayjs(booking.date).format("YYYY-MM-DD") === date.format("YYYY-MM-DD")
//     );
//   };

//   const isDatePending = (date) => {
//     return pending.some(
//       (booking) =>
//         dayjs(booking.date).format("YYYY-MM-DD") === date.format("YYYY-MM-DD")
//     );
//   };

//   const isStartDate = (date) => {
//     return (
//       confirmed.some(
//         (booking) =>
//           booking.isStart &&
//           dayjs(booking.date).format("YYYY-MM-DD") === date.format("YYYY-MM-DD")
//       ) ||
//       pending.some(
//         (booking) =>
//           booking.isStart &&
//           dayjs(booking.date).format("YYYY-MM-DD") === date.format("YYYY-MM-DD")
//       )
//     );
//   };

//   const isEndDate = (date) => {
//     return (
//       confirmed.some(
//         (booking) =>
//           booking.isEnd &&
//           dayjs(booking.date).format("YYYY-MM-DD") === date.format("YYYY-MM-DD")
//       ) ||
//       pending.some(
//         (booking) =>
//           booking.isEnd &&
//           dayjs(booking.date).format("YYYY-MM-DD") === date.format("YYYY-MM-DD")
//       )
//     );
//   };

//   const ServerDay = (props) => {
//     const { day, outsideCurrentMonth, ...other } = props;

//     if (outsideCurrentMonth) {
//       return <PickersDay {...other} outsideCurrentMonth day={day} />;
//     }

//     let customSx = {};
//     let disabled = false;
//     let tooltipText = "";

//     if (isConfirmedDate(day)) {
//       customSx = {
//         backgroundColor: "#ffebee",
//         color: "primary.red",
//         "&:hover": {
//           backgroundColor: "#ffcdd2",
//         },
//       };
//       disabled = true;
//       tooltipText = "Недоступно для бронирования";
//     } else if (isDatePending(day)) {
//       customSx = {
//         backgroundColor: "#fff3e0",
//         color: "primary.green",
//         "&:hover": {
//           backgroundColor: "#ffe0b2",
//         },
//       };
//       tooltipText = "Ожидает подтверждения";
//     } else if (
//       (isStartDate(day) && isConfirmedDate(day)) ||
//       (isEndDate(day) && isConfirmedDate(day))
//     ) {
//       customSx = {
//         backgroundColor: "#e3f2fd",
//         color: "primary.red",
//         "&:hover": {
//           backgroundColor: "#ffe0b2",
//         },
//       };
//       tooltipText = "Начало другого бронирования";
//     } else if (
//       (isStartDate(day) && isDatePending(day)) ||
//       (isEndDate(day) && isDatePending(day))
//     ) {
//       customSx = {
//         backgroundColor: "#e8f5e9",
//         color: "primary.green",
//         "&:hover": {
//           backgroundColor: "#c8e6c9",
//         },
//       };

//       tooltipText = "Окончание другого бронирования";
//     }

//     return (
//       <PickersDay
//         {...other}
//         day={day}
//         sx={customSx}
//         disabled={disabled}
//         title={tooltipText}
//       />
//     );
//   };

//   const [value, setValue] = React.useState(null);

//   // Обработчик изменения дат
//   const handleDateChange = (newValue) => {
//     setValue(newValue);

//     if (newValue && newValue[0] && newValue[1]) {
//       setBookedDates({
//         start: newValue[0],
//         end: newValue[1],
//       });
//     }
//   };

//   const { t } = useTranslation();

//   return (
//     <Box sx={{ maxWidth: 400, p: 2 }}>
//       <DateRangePicker
//         value={value}
//         localeText={{
//           start: t("order.pickupDate"),
//           end: t("order.returnDate"),
//         }}
//         onChange={handleDateChange}
//         slots={{ day: ServerDay }}
//         disablePast // Отключаем выбор прошедших дат
//       />
//     </Box>
//   );
// };

// export default CustomCalendarPicker;

import React from "react";
import { DateRangePicker } from "@mui/x-date-pickers-pro/DateRangePicker";
import { Chip, Box, Typography } from "@mui/material";
import { PickersDay } from "@mui/x-date-pickers/PickersDay";
import { analyzeDates } from "@utils/analyzeDates";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";

const CustomCalendarPicker = ({
  orders,
  setBookedDates,
  startDate,
  endDate,
}) => {
  const { confirmed, pending } = analyzeDates(orders);

  const isConfirmedDate = (date) => {
    return confirmed.some(
      (booking) =>
        dayjs(booking.date).format("YYYY-MM-DD") === date.format("YYYY-MM-DD")
    );
  };

  const isDatePending = (date) => {
    return pending.some(
      (booking) =>
        dayjs(booking.date).format("YYYY-MM-DD") === date.format("YYYY-MM-DD")
    );
  };

  const isStartDate = (date) => {
    return (
      confirmed.some(
        (booking) =>
          booking.isStart &&
          dayjs(booking.date).format("YYYY-MM-DD") === date.format("YYYY-MM-DD")
      ) ||
      pending.some(
        (booking) =>
          booking.isStart &&
          dayjs(booking.date).format("YYYY-MM-DD") === date.format("YYYY-MM-DD")
      )
    );
  };

  const isEndDate = (date) => {
    return (
      confirmed.some(
        (booking) =>
          booking.isEnd &&
          dayjs(booking.date).format("YYYY-MM-DD") === date.format("YYYY-MM-DD")
      ) ||
      pending.some(
        (booking) =>
          booking.isEnd &&
          dayjs(booking.date).format("YYYY-MM-DD") === date.format("YYYY-MM-DD")
      )
    );
  };

  const ServerDay = (props) => {
    const { day, outsideCurrentMonth, ...other } = props;

    if (outsideCurrentMonth) {
      return <PickersDay {...other} outsideCurrentMonth day={day} />;
    }

    let customSx = {};
    let disabled = false;
    let tooltipText = "";

    if (isConfirmedDate(day)) {
      customSx = {
        backgroundColor: "#ffebee",
        color: "primary.red",
        "&:hover": {
          backgroundColor: "#ffcdd2",
        },
      };
      disabled = true;
      tooltipText = "Недоступно для бронирования";
    } else if (isDatePending(day)) {
      customSx = {
        backgroundColor: "#fff3e0",
        color: "primary.green",
        "&:hover": {
          backgroundColor: "#ffe0b2",
        },
      };
      tooltipText = "Ожидает подтверждения";
    } else if (
      (isStartDate(day) && isConfirmedDate(day)) ||
      (isEndDate(day) && isConfirmedDate(day))
    ) {
      customSx = {
        backgroundColor: "#e3f2fd",
        color: "primary.red",
        "&:hover": {
          backgroundColor: "#ffe0b2",
        },
      };
      tooltipText = "Начало другого бронирования";
    } else if (
      (isStartDate(day) && isDatePending(day)) ||
      (isEndDate(day) && isDatePending(day))
    ) {
      customSx = {
        backgroundColor: "#e8f5e9",
        color: "primary.green",
        "&:hover": {
          backgroundColor: "#c8e6c9",
        },
      };

      tooltipText = "Окончание другого бронирования";
    }

    return (
      <PickersDay
        {...other}
        day={day}
        sx={customSx}
        disabled={disabled}
        title={tooltipText}
      />
    );
  };

  // --- Исправлено: синхронизация value с внешними датами ---
  const [value, setValue] = React.useState(
    startDate && endDate ? [dayjs(startDate), dayjs(endDate)] : [null, null]
  );

  React.useEffect(() => {
    if (startDate && endDate) {
      setValue([dayjs(startDate), dayjs(endDate)]);
    } else {
      setValue([null, null]);
    }
  }, [startDate, endDate]);
  // ---------------------------------------------------------

  // Обработчик изменения дат
  const handleDateChange = (newValue) => {
    setValue(newValue);

    if (newValue && newValue[0] && newValue[1]) {
      setBookedDates({
        start: newValue[0].format("YYYY-MM-DD"),
        //end: newValue[1].format("YYYY-MM-DD"),
        end: newValue[1].add(1, "day").format("YYYY-MM-DD"), // ← увеличиваем на 1 день
      });
    }
  };

  const { t } = useTranslation();

  return (
    <Box sx={{ maxWidth: 400, p: 2 }}>
      <DateRangePicker
        value={value}
        localeText={{
          start: t("order.pickupDate"),
          end: t("order.returnDate"),
        }}
        onChange={handleDateChange}
        slots={{ day: ServerDay }}
        disablePast // Отключаем выбор прошедших дат
        format="DD-MM-YYYY" // ← вот это добавьте
      />
    </Box>
  );
};

export default CustomCalendarPicker;
