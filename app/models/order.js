import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
  Typography,
  Box,
  TextField,
  CircularProgress,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { addOrderNew } from "@utils/action";
import SuccessMessage from "../common/SuccessMessage";
import sendEmail from "@utils/sendEmail";
import { DEVELOPER_EMAIL } from "@config/email";
import { setTimeToDatejs } from "@/domain/calendar";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { useMainContext } from "../../Context";
import { isValidInternationalPhone } from "@/domain/validation/internationalPhone";
import { reportGoogleAdsPurchaseFromOrder } from "@/domain/analytics/googleAdsConversion";

// Extend dayjs with plugins
dayjs.extend(utc);

const BookingModal = ({
  open,
  onClose,
  car,
  presetDates = null,
  fetchAndUpdateOrders,
  isLoading,
  selectedTimes,
}) => {
  const { t } = useTranslation();
  const { company } = useMainContext();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState({});
  const [emailSent, setSuccessfullySent] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [submittedOrder, setSubmittedOrder] = useState(null);

  const [startTime, setStartTime] = useState(() =>
    setTimeToDatejs(presetDates?.startDate, selectedTimes?.start, true)
  );
  const [endTime, setEndTime] = useState(() =>
    setTimeToDatejs(presetDates?.endDate, selectedTimes?.end)
  );

  useEffect(() => {
    if (presetDates?.startDate && presetDates?.endDate) {
      setStartTime(
        setTimeToDatejs(presetDates?.startDate, selectedTimes?.start, true)
      );
      setEndTime(setTimeToDatejs(presetDates?.endDate, selectedTimes?.end));
    }
  }, [
    presetDates?.startDate,
    presetDates?.endDate,
    car.pricePerDay,
    selectedTimes,
  ]);

  // Проверка формата email происходит только на фронте, в функции validateEmail:
  const validateEmail = (email) => {
    if (!email) return true; // Email необязателен
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(String(email).toLowerCase());
  };

  const bookButtonRef = useRef(null);

  useEffect(() => {
    if (
      open &&
      !isSubmitted &&
      name &&
      email &&
      phone &&
      presetDates?.startDate &&
      presetDates?.endDate &&
      bookButtonRef.current
    ) {
      const timer = setTimeout(() => {
        bookButtonRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [
    open,
    isSubmitted,
    name,
    email,
    phone,
    presetDates?.startDate,
    presetDates?.endDate,
  ]);

  const handleSubmit = async () => {
    if (isSubmitting) return;

    const newErrors = {};
    if (!name) newErrors.name = "Name is required";
    if (email && !validateEmail(email))
      newErrors.email = "Invalid email address";
    if (!phone?.trim()) newErrors.phone = t("order.required");
    else if (!isValidInternationalPhone(phone))
      newErrors.phone = t("order.phoneInvalid");
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      // Логгирование данных перед отправкой
      console.log("BookingModal: orderData для отправки:");
      console.log({
        carNumber: car.carNumber || "",
        customerName: name || "",
        phone: phone || "",
        email: email ? email : "",
        timeIn: startTime ? startTime.toISOString() : "",
        timeOut: endTime ? endTime.toISOString() : "",
        rentalStartDate: presetDates?.startDate
          ? dayjs.utc(presetDates.startDate).toDate()
          : "",
        rentalEndDate: presetDates?.endDate
          ? dayjs.utc(presetDates.endDate).toDate()
          : "",
        my_order: true,
      });

      const orderData = {
        carNumber: car.carNumber || "",
        customerName: name || "",
        phone: phone || "",
        email: email ? email : "",
        timeIn: startTime ? startTime.toISOString() : "",
        timeOut: endTime ? endTime.toISOString() : "",
        rentalStartDate: presetDates?.startDate
          ? dayjs.utc(presetDates.startDate).toDate()
          : "",
        rentalEndDate: presetDates?.endDate
          ? dayjs.utc(presetDates.endDate).toDate()
          : "",
        my_order: true,
      };

      // Логгирование JSON строки для отладки
      console.log(
        "BookingModal: JSON.stringify(orderData):",
        JSON.stringify(orderData)
      );

      const response = await addOrderNew(orderData);

      const prepareEmailData = (orderData, status) => {
        const formattedStartDate = dayjs
          .utc(orderData.rentalStartDate)
          .format("DD.MM.YYYY");
        const formattedEndDate = dayjs
          .utc(orderData.rentalEndDate)
          .format("DD.MM.YYYY");
        let title =
          status === "success"
            ? `Новое бронирование ${orderData.carNumber} ${orderData.carModel}`
            : `Бронирование с неподтвержденными датами ${orderData.carNumber} ${orderData.carModel}`;
        let statusMessage =
          status === "success"
            ? "Создано бронирование в свободные даты."
            : "Бронирование в ожидании подтверждения.";
        return {
          emailCompany: DEVELOPER_EMAIL,
          email: orderData.email,
          title: title,
          message: `${statusMessage}\nБронь с ${formattedStartDate} по ${formattedEndDate}. \n Кол-во дней : ${orderData.numberOfDays}  \n Сумма : ${response.data.totalPrice} евро. \n \n Данные машины :   ${orderData.carModel} regNumber : ${car.regNumber} \n \n Данные клиента : \n  Мейл : ${orderData.email}, \n Тел : ${orderData.phone} \n имя: ${orderData.customerName}`,
        };
      };

      const sendConfirmationEmail = async (formData) => {
        try {
          const emailResponse = await sendEmail(
            formData,
            DEVELOPER_EMAIL,
            company.useEmail
          );
          setSuccessfullySent(emailResponse.status === 200);
        } catch (emailError) {
          setSuccessfullySent(false);
        }
      };

      switch (response.status) {
        case "success":
          setSubmittedOrder(response.data);
          setIsSubmitted(true);
          reportGoogleAdsPurchaseFromOrder(response.data);
          fetchAndUpdateOrders();
          await sendConfirmationEmail(
            prepareEmailData(response.data, "success")
          );
          break;
        case "pending":
          setSubmittedOrder(response.data);
          reportGoogleAdsPurchaseFromOrder(response.data);
          setMessage(response.message);
          setIsSubmitted(true);
          fetchAndUpdateOrders();
          await sendConfirmationEmail(
            prepareEmailData(response.data, "pending")
          );
          break;
        case "conflict":
          setErrors({ submit: response.message });
          break;
        case "error":
          throw new Error(response.message);
        default:
          throw new Error(`Unexpected response status: ${response.status}`);
      }
    } catch (error) {
      console.error("BookingModal: Ошибка при подтверждении заказа:", error);
      setErrors({
        submit:
          error.message || "An error occurred while processing your request.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setErrors({});
    setIsSubmitted(false);
    setIsSubmitting(false);
    setSubmittedOrder(null);
    setSuccessfullySent(false);
    setMessage(null);
  };

  const handleModalClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      {isLoading ? (
        <Box sx={{ display: "flex", alignContent: "center", p: 10 }}>
          <CircularProgress />
          <CircularProgress sx={{ color: "primary.green" }} />
          <CircularProgress sx={{ color: "primary.red" }} />
        </Box>
      ) : (
        <React.Fragment>
          <DialogTitle textAlign="center" mt="3">
            {t("order.book", { model: car.model })}
          </DialogTitle>
          <DialogContent>
            {isSubmitted ? (
              <SuccessMessage
                submittedOrder={submittedOrder}
                presetDates={presetDates}
                onClose={onClose}
                emailSent={emailSent}
                message={message}
              />
            ) : (
              <Box>
                <Typography variant="body1">
                  {t("order.youBook", { model: car.model })}
                  <Box
                    component="span"
                    sx={{ fontWeight: "bold", color: "primary.main" }}
                  >
                    {dayjs(presetDates?.startDate).format("MMMM D")}
                  </Box>{" "}
                  {t("order.till")}
                  <Box
                    component="span"
                    sx={{ fontWeight: "bold", color: "primary.main" }}
                  >
                    {dayjs(presetDates?.endDate).format("MMMM D")}
                  </Box>
                  .
                </Typography>
                <Box
                  component="form"
                  sx={{ "& .MuiTextField-root": { my: 1 } }}
                >
                  {/* Время в одной строке, 24-часовой формат */}
                  <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
                    <TextField
                      label={t("order.pickupTime")}
                      type="time"
                      value={startTime.format("HH:mm")}
                      onChange={(e) =>
                        setStartTime(dayjs(e.target.value, "HH:mm"))
                      }
                      sx={{ flex: 1 }}
                      size="small"
                    />
                    <TextField
                      label={t("order.returnTime")}
                      type="time"
                      value={endTime.format("HH:mm")}
                      onChange={(e) =>
                        setEndTime(dayjs(e.target.value, "HH:mm"))
                      }
                      sx={{ flex: 1 }}
                      size="small"
                    />
                  </Box>
                  <TextField
                    label={t("order.name")}
                    variant="outlined"
                    fullWidth
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    error={!!errors.name}
                    helperText={errors.name}
                  />
                  {/* Сначала телефон, потом email */}
                  <TextField
                    label={t("order.phone")}
                    variant="outlined"
                    fullWidth
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    error={!!errors.phone}
                    helperText={errors.phone}
                    placeholder={t("order.phoneHint")}
                  />
                  <TextField
                    label={
                      <>
                        {t("order.email")}
                        <span
                          style={{
                            color: "red",
                            fontWeight: 500,
                            marginLeft: 8,
                          }}
                        >
                          {t("basic.optional")}
                        </span>
                      </>
                    }
                    variant="outlined"
                    fullWidth
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    error={!!errors.email}
                    helperText={errors.email}
                    // required убран, поле необязательное
                  />
                </Box>
                {errors.submit && (
                  <Typography color="error" sx={{ mt: 2 }}>
                    {errors.submit}
                  </Typography>
                )}
                {/* Кнопки внутри DialogContent, BOOK по центру и мигает */}
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    gap: 2,
                    mt: 3,
                    pt: 2,
                    borderTop: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Button onClick={handleModalClose} variant="outlined">
                    {isSubmitted ? "OK" : t("basic.cancel")}
                  </Button>
                  {!isSubmitted && (
                    <Button
                      ref={bookButtonRef}
                      variant="contained"
                      color="error"
                      onClick={handleSubmit}
                      disabled={
                        isSubmitting ||
                        !name ||
                        !phone ||
                        !presetDates?.startDate ||
                        !presetDates?.endDate
                        // email не требуется для активации
                      }
                      startIcon={
                        isSubmitting ? <CircularProgress size={20} /> : null
                      }
                      sx={{
                        backgroundColor: "primary.red",
                        color: "white",
                        fontWeight: "bold",
                        fontSize: "1.1rem",
                        padding: "12px 32px",
                        minWidth: "200px",
                        margin: "0 auto",
                        animation: "bookButtonPulse 1.5s ease-in-out infinite",
                        display: "block",
                        "&:hover": {
                          backgroundColor: "#d32f2f",
                          animation: "none",
                        },
                        "&:disabled": {
                          backgroundColor: "#grey.400",
                          animation: "none",
                        },
                        "@keyframes bookButtonPulse": {
                          "0%": {
                            backgroundColor: "primary.red",
                            boxShadow: "0 0 10px rgba(211, 47, 47, 0.7)",
                            transform: "scale(1)",
                          },
                          "50%": {
                            backgroundColor: "#ff5252",
                            boxShadow: "0 0 20px rgba(255, 82, 82, 0.9)",
                            transform: "scale(1.05)",
                          },
                          "100%": {
                            backgroundColor: "primary.red",
                            boxShadow: "0 0 10px rgba(211, 47, 47, 0.7)",
                            transform: "scale(1)",
                          },
                        },
                      }}
                    >
                      {isSubmitting
                        ? t("order.processing") || "Processing..."
                        : t("order.confirmBooking")}
                    </Button>
                  )}
                </Box>
              </Box>
            )}
          </DialogContent>
        </React.Fragment>
      )}
    </Dialog>
  );
};

export default BookingModal;

// Ваш orderData формируется корректно: email: "" (пустая строка).
// На фронте нет проблем с форматом email, если он пустой.
// Если заказ не сохраняется, причина на сервере (API).

// Для отладки можно добавить логгирование на сервере (route.js):
// console.log("API: email =", typeof email, email);

// На фронте ничего менять не нужно — email: "" это корректно для необязательного поля.

// В Mongoose-схеме Order найдите определение поля email и измените required: true на required: false:

const OrderSchema = new mongoose.Schema({
  // ...existing code...
  email: {
    type: String,
    required: false, // ← email теперь необязателен
  },
  // ...existing code...
});
