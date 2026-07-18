// "use client";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
// import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
// import isSame from "dayjs/plugin/isSame";
import isBetween from "dayjs/plugin/isBetween";
import { companyData } from "@utils/companyData";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isBetween);
// dayjs.tz.setDefault("Europe/Athens");

const defaultStartHour = companyData.defaultStart.slice(0, 2);
const defaultStartMinute = companyData.defaultStart.slice(-2);

const defaultEndHour = companyData.defaultEnd.slice(0, 2);
const defaultEndMinute = companyData.defaultEnd.slice(-2);

/**
 * Проверяет, относятся ли две даты к одному дню
 * @param {dayjs.Dayjs} date1
 * @param {dayjs.Dayjs} date2
 * @returns {boolean}
 */
const isSameDay = (date1, date2) => {
  return date1.format("YYYY-MM-DD") === date2.format("YYYY-MM-DD");
};

/**
 * Проверяет, меньше или равна ли первая дата второй
 * @param {dayjs.Dayjs} date1
 * @param {dayjs.Dayjs} date2
 * @returns {boolean}
 */
const isSameOrBefore = (date1, date2) => {
  return date1.format("YYYY-MM-DD") <= date2.format("YYYY-MM-DD");
};

/**
 * Анализирует массив заказов и возвращает даты с их статусами
 * @param {Array} orders - Массив заказов
 * @returns {Object} Объект с подтвержденными и ожидающими датами
 */

function analyzeDates(orders) {
  const result = {
    confirmed: [],
    pending: [],
  };

  // Создаем Map для отслеживания повторений дат
  const dateOccurrences = new Map();

  // Первый проход: собираем все даты и подсчитываем их повторения
  orders?.forEach((order) => {
    const startDate = dayjs.utc(order.rentalStartDate).startOf("day");
    const endDate = dayjs.utc(order.rentalEndDate).startOf("day");
    let currentDate = startDate;

    while (isSameOrBefore(currentDate, endDate)) {
      const dateStr = currentDate.format("YYYY-MM-DD");
      const count = dateOccurrences.get(dateStr) || 0;
      dateOccurrences.set(dateStr, count + 1);
      currentDate = currentDate.add(1, "day");
    }
  });

  // Второй проход: формируем результат
  orders?.forEach((order) => {
    const startDate = dayjs.utc(order.rentalStartDate).startOf("day");
    const endDate = dayjs.utc(order.rentalEndDate).startOf("day");
    let currentDate = startDate;

    while (isSameOrBefore(currentDate, endDate)) {
      const dateStr = currentDate.format("YYYY-MM-DD");
      const dateObj = {
        date: currentDate.toDate(),
        dateFormat: currentDate.format("YYYY-MM-DD"),
        datejs: currentDate,
        isStart: isSameDay(currentDate, startDate),
        isEnd: isSameDay(currentDate, endDate),
        // timeStart: isSameDay(currentDate, startDate) ? order.timeIn : null,
        // timeEnd: isSameDay(currentDate, endDate) ? order.timeOut : null,
        timeStart: isSameDay(currentDate, startDate)
          ? dayjs.utc(order.timeIn)
          : null,
        timeEnd: isSameDay(currentDate, endDate)
          ? dayjs.utc(order.timeOut)
          : null,

        isOverlapped: dateOccurrences.get(dateStr) - 1,
        orderId: order._id,
      };

      if (order.offline === true || order.confirmed === true) {
        const existingIndex = result.confirmed.findIndex((item) =>
          isSameDay(dayjs(item.date), currentDate)
        );

        if (existingIndex === -1) {
          result.confirmed.push(dateObj);
        }
      } else {
        const existingIndex = result.pending.findIndex((item) =>
          isSameDay(dayjs(item.date), currentDate)
        );

        if (existingIndex === -1) {
          result.pending.push(dateObj);
        }
      }

      currentDate = currentDate.add(1, "day");
    }
  });

  // Сортируем даты
  result.confirmed.sort((a, b) => dayjs(a.date).diff(dayjs(b.date)));
  result.pending.sort((a, b) => dayjs(a.date).diff(dayjs(b.date)));

  return result;
}

function checkConflicts(existingOrders, startDate, endDate, timeIn, timeOut) {
  const result = analyzeDates(existingOrders);

  // Handle general date conflicts status 409 - order is not created
  const confirmedInnerDates = result.confirmed.filter(
    (item) =>
      !item.isStart &&
      !item.isEnd &&
      item.datejs.isBetween(startDate, endDate, "day", "[]")
  );

  if (confirmedInnerDates.length > 0) {
    const conflictDates = new Set(
      confirmedInnerDates.map((item) => item.datejs.format("MMM D"))
    );

    const conflictMessage = `Dates ${[...conflictDates].join(
      ", "
    )} have been booked and not available.`;

    return {
      status: 409,
      data: {
        conflictMessage,
        conflictDates: [...conflictDates],
      },
    };
  }

  // Initialize timeConflicts to track conflicts

  const timeConflicts = { start: null, end: null };

  // Check if booking start overlaps with an existing end date's time
  const isStartTimeConflict = result.confirmed.find((item) => {
    if (
      item.isEnd &&
      item.dateFormat === dayjs(startDate).format("YYYY-MM-DD") &&
      item.timeEnd && // Ensure there is a timeEnd
      //dayjs(item.timeEnd).isAfter(dayjs(timeIn)) // Check if timeEnd conflicts with timeIn
      // dayjs(item.timeEnd).isAfter(dayjs(timeIn)) &&
      // !dayjs(item.timeEnd).isSame(dayjs(timeIn))
      //
      dayjs.utc(timeIn).isBefore(dayjs.utc(item.timeEnd))
    ) {
      console.log("item is", item);
      console.log("timeIn", timeIn);
      console.log(
        "🟠 DEBUG: Сравнение начала перемещаемого заказа с концом существующего:"
      );
      console.log(
        "Новое время начала (timeIn):",
        timeIn,
        "→",
        dayjs.utc(timeIn).format()
      );
      console.log(
        "Существующее время конца (item.timeEnd):",
        item.timeEnd,
        "→",
        dayjs.utc(item.timeEnd).format()
      );
      console.log(
        "dayjs.utc(timeIn).isBefore(item.timeEnd):",
        dayjs.utc(timeIn).isBefore(dayjs.utc(item.timeEnd))
      );
      console.log(
        "dayjs.utc(timeIn).isSame(item.timeEnd):",
        dayjs.utc(timeIn).isSame(dayjs.utc(item.timeEnd))
      );

      timeConflicts.start = item.timeEnd;
      return true;
    }
    return false;
  });

  // Check if booking end overlaps with an existing start date's time
  const isEndTimeConflict = result.confirmed.find((item) => {
    if (
      item.isStart &&
      item.dateFormat === dayjs(endDate).format("YYYY-MM-DD") &&
      item.timeStart && // Ensure there is a timeStart
      //dayjs(item.timeStart).isBefore(dayjs(timeOut)) // Check if timeStart conflicts with timeOut
      //
      dayjs.utc(item.timeStart).isBefore(dayjs.utc(timeOut)) &&
      !dayjs.utc(item.timeStart).isSame(dayjs.utc(timeOut))
    ) {
      console.log("item out is", item.timeStart);
      console.log("timeOut", timeOut);
      console.log(
        "boolean check if  item out  is before timeOut==>",
        dayjs(item.timeStart).isBefore(dayjs(timeOut))
      );
      console.log(
        "🟠 DEBUG: Сравнение начала перемещаемого заказа с концом существующего:"
      );
      console.log(
        "Новое время начала (timeIn):",
        timeIn,
        "→",
        dayjs.utc(timeIn).format()
      );
      console.log(
        "Существующее время конца (item.timeEnd):",
        item.timeEnd,
        "→",
        dayjs.utc(item.timeEnd).format()
      );
      console.log(
        "dayjs.utc(timeIn).isBefore(item.timeEnd):",
        dayjs.utc(timeIn).isBefore(dayjs.utc(item.timeEnd))
      );
      console.log(
        "dayjs.utc(timeIn).isSame(item.timeEnd):",
        dayjs.utc(timeIn).isSame(dayjs.utc(item.timeEnd))
      );

      timeConflicts.end = item.timeStart;
      return true;
    }
    return false;
  });

  // Handle time-specific conflicts - order created but with notice - status 200
  if (isStartTimeConflict || isEndTimeConflict) {
    // const conflictMessage = `Time ${
    //   timeConflicts.start
    //     ? `has conflict with start booking: ${timeConflicts.start.utc()} `
    //     : ""
    // }${
    //   timeConflicts.end
    //     ? `has conflict with end booking: ${timeConflicts.end.utc()}`
    //     : ""
    // } with existingn bookings.`;

    const conflictMessage = `Time ${
      timeConflicts.start
        ? `has conflict with start booking: ${dayjs(timeConflicts.start)
            .utc()
            .format()} `
        : ""
    }${
      timeConflicts.end
        ? `has conflict with end booking: ${dayjs(timeConflicts.end)
            .utc()
            .format()}`
        : ""
    } with existing bookings.`;

    return {
      status: 408,
      data: { conflictMessage, conflictDates: timeConflicts },
    };
  }

  // Handle general date pending - status 202 - orders is created but with warning
  const pendingInnerDates = result.pending.filter(
    (item) =>
      !item.isStart &&
      !item.isEnd &&
      item.datejs.isBetween(startDate, endDate, "day", "[]")
  );

  if (pendingInnerDates.length > 0) {
    const conflictDates = new Set(
      pendingInnerDates.map((item) => item.datejs.format("MMM D"))
    );

    const conflictOrdersIds = new Set(
      pendingInnerDates.map((item) => item.orderId)
    );

    const conflictMessage = `Dates ${[...conflictDates].join(
      ", "
    )} have been booked and not availabe.`;

    return {
      status: 202,
      data: {
        conflictMessage,
        conflictDates: [...conflictDates],
        conflictOrdersIds,
      },
    };
  }
  // No conflicts detected
  return false;
}

// returns dates in range between start and end
function functionPendingOrConfirmedDatesInRange(pending, start, end) {
  return pending?.filter((bookingDate) => {
    const currentDate = dayjs(bookingDate.date);

    const startDate = dayjs(start);
    const endDate = dayjs(end);

    // Проверяем, равна ли дата текущей дате (start или end)
    const isStartDate = isSameDay(startDate, currentDate);

    const isEndDate = isSameDay(endDate, currentDate);

    // Проверка на то, что дата находится в диапазоне
    const isWithinRange =
      currentDate.isAfter(startDate) && currentDate.isBefore(endDate);
    // const isSameOrBeforeEnd =
    //   currentDate.isBefore(endDate) || currentDate.isSame(endDate, "day");

    // Возвращаем те даты, которые равны start или end, и находятся в пределах диапазона
    return isStartDate || isEndDate || isWithinRange;
  });
}
// пушает фремя в существующий datejs обьект
function setTimeToDatejs(date, time, isStart = false) {
  // console.log("DATE", date);
  // console.log("time", time);
  if (time) {
    const hour = Number(time?.slice(0, 2));
    const minute = Number(time?.slice(-2));
    const newDateWithTime = dayjs(date)
      .hour(hour)
      .minute(minute)
      .second(0)
      .millisecond(0);

    return newDateWithTime;
  } else if (isStart) {
    // console.log("???? day to retunr for START", dayjs(date).hour(15).minute(0));
    return dayjs(date)
      .hour(defaultStartHour)
      .minute(defaultStartMinute)
      .second(0)
      .millisecond(0);
  } else
    return dayjs(date)
      .hour(defaultEndHour)
      .minute(defaultEndMinute)
      .second(0)
      .millisecond(0);
}

module.exports = {
  analyzeDates,
  functionPendingOrConfirmedDatesInRange,
  isSameOrBefore,
  isSameDay,
  setTimeToDatejs,
  checkConflicts,
};
