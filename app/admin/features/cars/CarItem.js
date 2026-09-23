import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { styled } from "@mui/material/styles";
import {
  Paper,
  Box,
  Typography,
  Stack,
  Chip,
  FormControlLabel,
  Switch,
} from "@mui/material";
import { ConfirmButton, CancelButton, ActionButton } from "@/app/components/ui";
import EditCarModal from "./modals/EditCarModal";
import DefaultButton from "@/app/components/ui/buttons/DefaultButton";
import { CldImage } from "next-cloudinary";
import { useMainContext } from "@app/Context";
import { useTranslation } from "react-i18next";
import { CLOUDINARY_PLACEHOLDER_PUBLIC_ID } from "@config/cloudinary";
import { listCarPhotos, photosForSave, MAX_CAR_PHOTOS } from "@/domain/cars/carPhotos";

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
  padding: theme.spacing(1.25),
  width: "100%",
  zIndex: 22,
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: theme.spacing(1.5),
  backgroundColor: theme.palette.background.paper,
  boxShadow: theme.shadows[1],
  borderRadius: 10,
  border: `1px solid ${theme.palette.divider}`,
  overflow: "hidden",
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    alignItems: "stretch",
  },
}));

const CarImage = styled(Box)(({ theme }) => ({
  position: "relative",
  width: 148,
  flexShrink: 0,
  aspectRatio: "3 / 2",
  borderRadius: 8,
  overflow: "hidden",
  backgroundColor: theme.palette.grey[100],
  "& img": {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  [theme.breakpoints.down("sm")]: {
    width: "100%",
    maxHeight: 160,
  },
}));

const CarDetails = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  flexGrow: 1,
  minWidth: 0,
  textAlign: "left",
  gap: theme.spacing(0.35),
}));

const CarTitle = styled(Typography)(() => ({
  fontSize: "1rem",
  fontWeight: 700,
  lineHeight: 1.25,
}));

const CarReg = styled(Typography)(({ theme }) => ({
  fontSize: "0.8rem",
  fontWeight: 600,
  letterSpacing: "0.04em",
  display: "inline-block",
  alignSelf: "flex-start",
  padding: theme.spacing(0.2, 0.75),
  borderRadius: 4,
  border: `1px solid ${theme.palette.text.primary}`,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
}));

const ImageOverlay = styled(Box)(({ theme }) => ({
  position: "absolute",
  inset: 0,
  backgroundColor: "rgba(11, 31, 58, 0.55)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  flexDirection: "column",
  gap: theme.spacing(0.5),
  backdropFilter: "blur(1px)",
}));

function CarItem({
  car,
  onCarDelete,
  setUpdateStatus,
  companyName,
  companies = [],
}) {
  const { updateCarInContext, resubmitCars } = useMainContext();
  const [modalOpen, setModalOpen] = useState(false);
  const [updatedCar, setUpdatedCar] = useState({
    ...car,
    deposit: car.deposit,
  });
  const [previewImage, setPreviewImage] = useState(null);
  const [hovered, setHovered] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const fileInputRef = useRef(null);
  const previewUrlRef = useRef(null);

  useEffect(() => {
    setUpdatedCar({ ...car, deposit: car.deposit });
  }, [car]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const isOnSite = car.isActive !== false;

  const handleToggleActive = async (event) => {
    const nextActive = Boolean(event.target.checked);
    setTogglingActive(true);
    setUpdateStatus(null);
    try {
      const response = await updateCarInContext({
        ...car,
        isActive: nextActive,
      });
      if (!response?.data) {
        const code = response?.payload?.error;
        throw new Error(
          code === "PARTNER_SUSPENDED"
            ? t("partnerLegal.gate.actionBlockedSuspended")
            : code === "PARTNER_COMPLIANCE_REQUIRED"
              ? `${t("partnerLegal.gate.actionBlocked")} ${t("partnerLegal.gate.openProfileCta")}`
              : response?.message || "Failed to update"
        );
      }
      setUpdatedCar(response.data);
      setUpdateStatus({
        type: 200,
        message: nextActive
          ? t("car.activatedOnSite") || "Car is now visible on the website"
          : t("car.deactivatedOnSite") || "Car is hidden from the website",
      });
    } catch (error) {
      setUpdateStatus({
        type: 400,
        message: error?.message || "Failed to update visibility",
      });
    } finally {
      setTogglingActive(false);
    }
  };

  const clearPreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleImageSelect = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const blobUrl = URL.createObjectURL(file);
    previewUrlRef.current = blobUrl;
    setPreviewImage(blobUrl);
    setHovered(true);
  }, []);

  const handleImageUpload = useCallback(async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("image", file);

    try {
      // Local spinner only — global isLoading unmounts the cars list
      // (Cars.js returns <Loading />) and wipes the selected preview.
      setUploadingPhoto(true);
      setUpdateStatus(null);
      const uploadRes = await fetch("/api/order/update/image", {
        method: "POST",
        body: formData,
      });
      const data = await uploadRes.json();
      if (!data.success || !data.data) {
        setUpdateStatus({
          type: 400,
          message: data.message || "Image NOT uploaded successfully",
        });
        return;
      }
      const newPhotoUrl = data.data;
      const current = listCarPhotos(updatedCar);
      const saved = await updateCarInContext({
        ...updatedCar,
        ...photosForSave([...current, newPhotoUrl].slice(0, MAX_CAR_PHOTOS)),
      });
      if (!saved?.data) {
        setUpdateStatus({
          type: saved?.type || 400,
          message: saved?.message || "Photo uploaded but was not saved on the car",
        });
        return;
      }
      setUpdatedCar(saved.data);
      clearPreview();
      setUpdateStatus({
        type: saved.type,
        message: saved.message || "Photo saved",
      });
    } catch (error) {
      console.error("Error uploading image:", error);
      setUpdateStatus({
        type: 400,
        message: error?.message || "Error uploading image",
      });
    } finally {
      setUploadingPhoto(false);
    }
  }, [updatedCar, setUpdateStatus, updateCarInContext, clearPreview]);

  const handleCarsUpdate = async () => {
    try {
      setUpdateStatus(null);

      const response = await updateCarInContext(updatedCar);
      if (!response?.data) {
        const code = response?.payload?.error;
        setUpdateStatus({
          type: 403,
          message:
            code === "PARTNER_SUSPENDED"
              ? `${t("partnerLegal.gate.actionBlockedSuspended")} ${t("partnerLegal.gate.openProfileCta")}`
              : code === "PARTNER_COMPLIANCE_REQUIRED"
                ? `${t("partnerLegal.gate.actionBlocked")} ${t("partnerLegal.gate.openProfileCta")}`
                : response?.message || "Failed to update",
        });
        return;
      }

      setUpdatedCar(response.data);

      await resubmitCars();

      setUpdateStatus({
        type: Number(response.type),
        message: response.message || "Car updated successfully",
      });

      setModalOpen(false);
      restoreAdminCarsScrollPosition();
    } catch (error) {
      console.error("Car update error:", error);

      setUpdateStatus({
        type: 404,
        message: error.message || "An unexpected error occurred",
      });
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

  const displayCompany =
    companyName ||
    (car.ownerId ? String(car.ownerId).slice(-6) : "—");

  return (
    <StyledCarItem elevation={1}>
      <CarImage
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          if (!previewImage && !uploadingPhoto) setHovered(false);
        }}
      >
        {previewImage ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={previewImage} alt="Preview" />
        ) : (
          <CldImage
            src={
              updatedCar.photoUrl ||
              car.photoUrl ||
              CLOUDINARY_PLACEHOLDER_PUBLIC_ID
            }
            alt={`rovaro-${car.model}`}
            width="300"
            height="200"
            crop="fill"
            gravity="auto"
            sizes="148px"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
        {(hovered || previewImage || uploadingPhoto) && (
          <ImageOverlay>
            <ActionButton
              color="primary"
              size="small"
              disabled={uploadingPhoto}
              onClick={() => fileInputRef.current?.click()}
              label={t("carPark.carNewPhoto")}
              sx={{ minWidth: 0, width: "92%", px: 1, fontSize: "0.7rem" }}
            />
            {previewImage && (
              <Stack spacing={0.5} direction="row" sx={{ width: "92%" }}>
                <ConfirmButton
                  size="small"
                  loading={uploadingPhoto}
                  disabled={uploadingPhoto}
                  onClick={handleImageUpload}
                  label={t("carPark.savePhoto")}
                  sx={{ minWidth: 0, flex: 1, px: 1, fontSize: "0.7rem" }}
                />
                <CancelButton
                  size="small"
                  disabled={uploadingPhoto}
                  onClick={clearPreview}
                  label={t("basic.cancel")}
                  sx={{ minWidth: 0, flex: 1, px: 1, fontSize: "0.7rem" }}
                />
              </Stack>
            )}
          </ImageOverlay>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          ref={fileInputRef}
          onChange={handleImageSelect}
          style={{ display: "none" }}
        />
      </CarImage>

      <CarDetails>
        <CarTitle noWrap>{car.model}</CarTitle>
        <CarReg>{car.regNumber}</CarReg>
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            label={displayCompany}
            sx={{
              alignSelf: "flex-start",
              mt: 0.25,
              height: 22,
              fontSize: "0.7rem",
              fontWeight: 600,
              bgcolor: (theme) => theme.palette.grey[100],
            }}
          />
        </Stack>
        <FormControlLabel
          sx={{
            mt: 0.5,
            ml: 0,
            mr: 0,
            alignItems: "center",
            "& .MuiFormControlLabel-label": {
              fontSize: "0.8rem",
              fontWeight: 600,
            },
          }}
          control={
            <Switch
              size="small"
              color="success"
              checked={isOnSite}
              disabled={togglingActive}
              onChange={handleToggleActive}
            />
          }
          label={
            isOnSite
              ? t("car.showOnSite") || "On website"
              : t("car.hideOnSite") || "Off website"
          }
        />
      </CarDetails>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{
          flexShrink: 0,
          width: { xs: "100%", sm: "auto" },
          minWidth: { sm: 200 },
        }}
      >
        <DefaultButton
          relative
          onClick={handleEditToggle}
          sx={{
            width: { xs: "100%", sm: 100 },
            py: 0.75,
            fontSize: "0.8rem",
          }}
        >
          {t("carPark.editCar")}
        </DefaultButton>
        <DefaultButton
          onClick={handleDelete}
          relative
          sx={{
            backgroundColor: "primary.main",
            color: "white",
            width: { xs: "100%", sm: 100 },
            py: 0.75,
            fontSize: "0.8rem",
          }}
        >
          {t("carPark.delCar")}
        </DefaultButton>
      </Stack>

      <EditCarModal
        open={modalOpen}
        onClose={handleModalClose}
        updatedCar={updatedCar}
        setUpdatedCar={setUpdatedCar}
        companies={companies}
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
