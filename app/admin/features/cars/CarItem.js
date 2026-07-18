import React, {
  useState,
  useEffect,
  useTransition,
  useRef,
  useCallback,
} from "react";
import { styled, useTheme } from "@mui/material/styles";
import {
  Paper,
  Box,
  Typography,
  Stack,
  CircularProgress,
} from "@mui/material";
import { ConfirmButton, CancelButton, ActionButton } from "@/app/components/ui";
import EditCarModal from "./modals/EditCarModal";
import DefaultButton from "@/app/components/ui/buttons/DefaultButton";
import { CldImage } from "next-cloudinary";
import { useMainContext } from "@app/Context";
import { useTranslation } from "react-i18next";
import { CLOUDINARY_PLACEHOLDER_PUBLIC_ID } from "@config/cloudinary";

/** Сохраняем прокрутку списка admin/cars перед открытием EditCarModal и восстанавливаем после сохранения / закрытия */
const ADMIN_CARS_SCROLL_KEY = "nc_admin_cars_scroll_restore";

function persistAdminCarsScrollPosition() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(ADMIN_CARS_SCROLL_KEY, String(window.scrollY));
  } catch {
    /* quota / private mode */
  }
}

function restoreAdminCarsScrollPosition() {
  if (typeof window === "undefined") return;
  let y;
  try {
    const raw = sessionStorage.getItem(ADMIN_CARS_SCROLL_KEY);
    if (raw == null) return;
    y = Number.parseFloat(raw);
    if (!Number.isFinite(y)) return;
    sessionStorage.removeItem(ADMIN_CARS_SCROLL_KEY);
  } catch {
    return;
  }
  const apply = () => window.scrollTo({ top: y, left: 0, behavior: "auto" });
  requestAnimationFrame(() => {
    apply();
    requestAnimationFrame(() => {
      apply();
      setTimeout(apply, 0);
    });
  });
}

const StyledCarItem = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  width: "100%",
  zIndex: 22,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-evenly",
  bgColor: "black",
  boxShadow: theme.shadows[4],
  transition: "transform 0.3s",
  "&:hover": {
    transform: "scale(1.02)",
    boxShadow: theme.shadows[5],
  },
  [theme.breakpoints.up("sm")]: {
    flexDirection: "row",
    alignItems: "center",
    padding: theme.spacing(5),
    minWidth: 950,
  },
}));

const Wrapper = styled(Box)(({ theme }) => ({
  justifyContent: "center",
  alignItems: "center",
  alignContent: "center",
  width: "100%",
  margin: theme.spacing(1),
  [theme.breakpoints.up("sm")]: {
    width: "50%",
    margin: 5,
  },
}));

const CarImage = styled(Box)(({ theme }) => ({
  position: "relative",
  width: "100%",
  height: "auto",
  borderRadius: theme.shape.borderRadius,
  overflow: "hidden",
  marginBottom: theme.spacing(2),
  "& img": {
    width: "100%",
    height: "auto",
    objectFit: "contain",
  },
  [theme.breakpoints.up("sm")]: {
    marginBottom: 0,
    width: 450,
    height: 300,
  },
}));

const CarDetails = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  flexGrow: 1,
  margin: 11,
  textAlign: "center",
}));

const CarTitle = styled(Typography)(({ theme }) => ({
  fontSize: "1.5rem",
  fontWeight: 700,
  marginBottom: theme.spacing(1),
  marginTop: theme.spacing(1),
}));

const CarReg = styled(Typography)(({ theme }) => ({
  fontSize: "1.5rem",
  fontWeight: 700,
  marginBottom: theme.spacing(1),
  marginTop: theme.spacing(1),
  border: "1px solid black",
}));

const ImageOverlay = styled(Box)(({ theme }) => ({
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  bgcolor: "rgba(0, 0, 0, 0.6)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  flexDirection: "column",
}));

function CarItem({ car, onCarDelete, setUpdateStatus }) {
  // Диагностика: выводим объект car в консоль при каждом рендере
  //console.log('CarItem car:', car);

  const { updateCarInContext, setIsLoading, resubmitCars } = useMainContext();
  const [modalOpen, setModalOpen] = useState(false);
  const [updatedCar, setUpdatedCar] = useState({
    ...car,
    deposit: car.deposit,
  });
  const [previewImage, setPreviewImage] = useState(null);
  const [hovered, setHovered] = useState(false);
  const fileInputRef = useRef(null);

  const handleImageSelect = useCallback((event) => {
    const file = event.target.files[0];
    if (file) setPreviewImage(URL.createObjectURL(file));
  }, []);

  const handleImageUpload = useCallback(async () => {
    if (!fileInputRef.current.files[0]) return;
    const file = fileInputRef.current.files[0];
    const formData = new FormData();
    formData.append("image", file);

    try {
      setIsLoading(true);
      const response = await fetch("/api/order/update/image", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (data.success) {
        const newPhotoUrl = data.data;
        setUpdatedCar((prev) => ({ ...prev, photoUrl: newPhotoUrl }));
        const response = await updateCarInContext({
          ...updatedCar,
          photoUrl: newPhotoUrl,
        });
        setUpdateStatus({ type: response.type, message: response.message });
        setPreviewImage(null);
      } else {
        setUpdateStatus({
          type: 400,
          message: "Image NOT uploaded successfully",
        });
      }
    } catch (error) {
      console.error("Error uploading image:", error);
    } finally {
      setIsLoading(false);
    }
  }, [updatedCar, setIsLoading, setUpdateStatus, updateCarInContext]);

  const handleCarsUpdate = async () => {
    try {
      // Reset any previous status
      setUpdateStatus(null);

      // Attempt to update car in context
      const response = await updateCarInContext(updatedCar);
      if (!response?.data) {
        return;
      }

      setUpdatedCar(response.data);

      // Resubmit cars after successful update (полноэкранный Loading сбрасывает прокрутку — восстанавливаем ниже)
      await resubmitCars();

      // Set success status
      setUpdateStatus({
        type: Number(response.type),
        message: response.message || "Car updated successfully",
      });

      setModalOpen(false);
      restoreAdminCarsScrollPosition();
    } catch (error) {
      // Log the error for debugging
      console.error("Car update error:", error);

      // Set error status
      setUpdateStatus({
        type: 404,
        message: error.message || "An unexpected error occurred",
      });
    } finally {
      // Optional: Any cleanup or final actions
      // For example, clearing form or resetting some state
    }
  };
  const handleEditToggle = () => {
    persistAdminCarsScrollPosition();
    setModalOpen(true);
  };
  const handleModalClose = () => {
    setModalOpen(false);
    setUpdateStatus(null);
    restoreAdminCarsScrollPosition();
  };

  const { t } = useTranslation();

  const handleDelete = () => {
    if (window.confirm(t("carPark.sureDelCar") + car.model + " ?")) {
      onCarDelete(car._id);
    }
  };
  //const handleDelete = () => {
  //  if (window.confirm(`Вы уверены что хотите удалить ${car.model}?`)) {
  //    onCarDelete(car._id);
  //  }
  //};
  /* const { t } = useTranslation(); */
  return (
    <StyledCarItem elevation={3}>
      {/* {car?.photoUrl && ( */}
      <CarImage
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {previewImage ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={previewImage} alt="Preview" />
        ) : (
          <CldImage
            src={car.photoUrl || CLOUDINARY_PLACEHOLDER_PUBLIC_ID}
            alt={`Natali-Cars-${car.model}`}
            width="450"
            height="300"
            crop="fill"
            priority
            sizes="(max-width: 600px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        )}
        {hovered && (
          <ImageOverlay>
            <ActionButton
              color="primary"
              size="small"
              onClick={() => fileInputRef.current.click()}
              label={t("carPark.carNewPhoto")}
              sx={{ mb: 1 }}
            />
            {previewImage && (
              <Stack spacing={1}>
                <ConfirmButton
                  size="small"
                  onClick={handleImageUpload}
                  label={t("carPark.savePhoto")}
                />
                <CancelButton
                  size="small"
                  onClick={() => setPreviewImage(null)}
                  label={t("basic.cancel")}
                />
              </Stack>
            )}
          </ImageOverlay>
        )}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageSelect}
          style={{ display: "none" }}
        />
      </CarImage>
      {/* )} */}
      <Wrapper>
        <Stack sx={{ flexDirection: "column", width: "100%" }}>
          <CarDetails>
            <CarTitle>{car.model}</CarTitle>
            <CarReg>{car.regNumber}</CarReg>
          </CarDetails>
          <DefaultButton
            onClick={handleDelete}
            relative
            sx={{
              backgroundColor: "primary.main",
              color: "white",
              width: "100%",
              marginBottom: 1,
            }}
          >
            {t("carPark.delCar")}
          </DefaultButton>
          <DefaultButton
            relative
            onClick={handleEditToggle}
            sx={{ width: "100%" }}
          >
            {t("carPark.editCar")}
          </DefaultButton>
        </Stack>
      </Wrapper>
      <EditCarModal
        open={modalOpen}
        onClose={handleModalClose}
        updatedCar={updatedCar}
        setUpdatedCar={setUpdatedCar}
        handleChange={(e) =>
          setUpdatedCar((prev) => ({
            ...prev,
            [e.target.name]: e.target.value,
          }))
        }
        handleUpdate={handleCarsUpdate}
        handleCheckboxChange={(e) =>
          setUpdatedCar((prev) => ({
            ...prev,
            [e.target.name]: e.target.checked,
          }))
        }
      />
    </StyledCarItem>
  );
}

export default CarItem;
