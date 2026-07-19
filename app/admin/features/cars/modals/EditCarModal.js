import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Grid,
  MenuItem,
  Typography,
  Checkbox,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  Box,
  TextField,
  RadioGroup,
  Radio,
  InputAdornment,
  Stack,
  Autocomplete,
} from "@mui/material";
import DialogLayout from "@/app/components/ui/modals/DialogLayout";
import { ConfirmButton, CancelButton } from "@/app/components/ui";
import Snackbar from "@/app/components/ui/feedback/Snackbar";
import { styled } from "@mui/material/styles";
import PricingTiersTable from "../PricingTiers";
import { useMainContext } from "@app/Context";
import {
  CAR_CLASSES,
  TRANSMISSION_TYPES,
  FUEL_TYPES,
  PREDEFINED_COLORS,
} from "@models/enums";
import {
  RenderTextField,
  RenderSelectField,
} from "@/app/components/ui/inputs/Fields";
import CarImageUpload from "@/app/components/ui/media/AddImageComponent";
import { useTranslation } from "react-i18next";
import { useSession } from "next-auth/react";
import { ROLE } from "@/domain/orders/admin-rbac";

const EditCarModal = ({
  open,
  onClose,
  updatedCar,
  handleChange,
  handleUpdate,
  handleCheckboxChange,
  setUpdatedCar,
  companies = [],
}) => {

  const { updateCarInContext, setUpdateStatus, updateStatus, company } =
    useMainContext();
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === ROLE.SUPERADMIN;

  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);
  const [imagePreview, setImagePreview] = useState(updatedCar.photoUrl || "");
  const [photoUrl, setPhotoUrl] = useState(updatedCar.photoUrl || "");
  const [localCompanies, setLocalCompanies] = useState(companies);

  const handleImageUpload = async () => {
    const file = fileInputRef.current.files[0];
    if (!file) return;

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
        // Update the photoUrl state
        setPhotoUrl(data.data);

        // Update the car in the context
        const response = await updateCarInContext({
          ...updatedCar,
          photoUrl: data.data,
        });
        setUpdateStatus({
          type: response.type,
          message: response.message,
          data: response.data,
        });
      } else {
        console.error("Image upload failed:", data.message);
        setUpdateStatus({ type: 400, message: data.message });
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      setUpdateStatus({ type: 400, message: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    await handleUpdate();
    setIsLoading(false);
  };
  const { t } = useTranslation();
  // Динамические модели из базы
  const [dbCarModels, setDbCarModels] = useState([]);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const fetchModels = async () => {
      try {
        // Получаем уже уникальные модели (API-level дедупликация)
        const res = await fetch("/api/car/models", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data)) return;
        // Поддержка как массива строк, так и массива объектов { model }
        const raw = data.map((item) =>
          typeof item === "string" ? item : item?.model
        );
        const models = Array.from(
          new Set(
            raw.filter((m) => typeof m === "string" && m.trim().length > 0)
          )
        ).sort((a, b) => a.localeCompare(b));
        if (!cancelled) setDbCarModels(models);
      } catch (_) {
        // игнорируем ошибку, останутся статические модели
      }
    };
    fetchModels();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    setLocalCompanies(companies);
  }, [companies]);

  useEffect(() => {
    if (!open || !isSuperAdmin || localCompanies.length > 0) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/owners");
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled && body?.success && Array.isArray(body.companies)) {
          setLocalCompanies(body.companies);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, isSuperAdmin, localCompanies.length]);

  const autoCompleteOptions = useMemo(() => {
    const fallbackModels = [
      "Audi",
      "BMW",
      "BYD",
      "Chevrolet",
      "Citroën",
      "Dacia",
      "Dodge",
      "Fiat",
      "Ford",
      "Honda",
      "Hyundai",
      "Isuzu",
      "Kia",
      "Mazda",
      "Mercedes-Benz",
      "MG",
      "Mini",
      "Mitsubishi",
      "Nissan",
      "Opel",
      "Peugeot",
      "Renault",
      "Seat",
      "Škoda",
      "Smart",
      "Suzuki",
      "Tesla",
      "Toyota",
      "Volkswagen",
      "Volvo",
    ];
    // Объединяем статический список, БД и текущую модель авто, убираем повторы и сортируем A→Z
    const lowerSeen = new Set();
    const merged = [];
    const add = (val) => {
      if (typeof val !== "string") return;
      const v = val.trim();
      if (!v) return;
      const key = v.toLowerCase();
      if (lowerSeen.has(key)) return;
      lowerSeen.add(key);
      merged.push(v);
    };
    fallbackModels.forEach(add);
    dbCarModels.forEach(add);
    add(updatedCar?.model);
    return merged.sort((a, b) => a.localeCompare(b));
  }, [dbCarModels, updatedCar?.model]);
  
  // Actions buttons for DialogLayout
  const modalActions = (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        gap: 2,
      }}
    >
      <CancelButton
        onClick={onClose}
        disabled={isLoading}
        label={t("basic.cancel")}
      />
      <ConfirmButton
        onClick={handleSave}
        loading={isLoading}
        label={t("basic.save")}
      />
    </Box>
  );

  return (
    <DialogLayout
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      title={t("carPark.updateCar")}
      showCloseButton={true}
      closeOnBackdropClick={false}
      closeOnEscape={false}
      actions={modalActions}
      contentSx={{ opacity: isLoading ? 0.3 : 1, transition: "opacity 0.2s" }}
      >
        <Grid container spacing={3} sx={{ flexGrow: 1, pt: 4 }}>
          {isSuperAdmin && (
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel id="edit-car-company">Company</InputLabel>
                <Select
                  labelId="edit-car-company"
                  label="Company"
                  name="ownerId"
                  value={
                    updatedCar.ownerId
                      ? String(updatedCar.ownerId)
                      : ""
                  }
                  onChange={handleChange}
                  disabled={isLoading}
                >
                  {localCompanies.map((c) => (
                    <MenuItem key={String(c._id)} value={String(c._id)}>
                      {c.name || String(c._id)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}
          {/* Column 1 */}
          <Grid item xs={12} sm={3}>
            <Stack spacing={3} >
              <Autocomplete
                freeSolo
                options={autoCompleteOptions}
                value={updatedCar.model || ""}
                onChange={(_, newValue) =>
                  handleChange({
                    target: { name: "model", value: newValue || "" },
                  })
                }
                onInputChange={(_, inputValue) =>
                  handleChange({ target: { name: "model", value: inputValue } })
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t("car.model")}
                    name="model"
                    disabled={isLoading}
                    defaultValue="Toyota"
                  />
                )}
              />
              <RenderSelectField
                name="transmission"
                label={t("car.transmission")}
                options={Object.values(TRANSMISSION_TYPES)}
                required
                updatedCar={updatedCar}
                handleChange={handleChange}
                isLoading={isLoading}
              />
              <RenderTextField
                type="number"
                name="seats"
                label={t("car.seats")}
                defaultValue={updatedCar.seats}
                updatedCar={updatedCar}
                handleChange={handleChange}
                isLoading={isLoading}
              />
              {/* <RenderTextField
                type="number"
                name="PriceChildSeats"
                label={t("car.childSeatsPrice") || "Цена детских кресел"}
                defaultValue={updatedCar.PriceChildSeats}
                updatedCar={updatedCar}
                handleChange={handleChange}
                isLoading={isLoading}
              />{" "} */}
              <RenderTextField
                type="number"
                name="PriceKacko"
                label={t("car.KackoPrice") || "Цена КАСКО в день"}
                //label="Цена КАСКО в день"
                defaultValue={updatedCar.PriceKacko}
                updatedCar={updatedCar}
                handleChange={handleChange}
                isLoading={isLoading}
              />
              {/* <RenderTextField
                type="number"
                name="deposit"
                label={t("car.deposit") || "Залог, €"}
                defaultValue={
                  typeof updatedCar.deposit !== "undefined"
                    ? updatedCar.deposit
                    : ""
                }
                updatedCar={updatedCar}
                handleChange={handleChange}
                isLoading={isLoading}
              /> */}
            </Stack>
          </Grid>

          <Grid item xs={12} sm={3}>
            <Stack spacing={3}>
              <RenderTextField
                name="registration"
                label={t("car.reg-year")}
                defaultValue={updatedCar.registration}
                type="number"
                updatedCar={updatedCar}
                handleChange={handleChange}
                isLoading={isLoading}
              />
              <RenderSelectField
                name="fueltype"
                label={t("car.fuel")}
                options={Object.values(FUEL_TYPES)}
                updatedCar={updatedCar}
                handleChange={handleChange}
                isLoading={isLoading}
              />
              <RenderTextField
                type="number"
                name="numberOfDoors"
                label={t("car.doors")}
                defaultValue={updatedCar.numberOfDoors}
                updatedCar={updatedCar}
                handleChange={handleChange}
                isLoading={isLoading}
              />
              <RenderTextField
                type="number"
                name="franchise"
                label={t("car.franchise") || "Франшиза"}
                defaultValue={updatedCar.franchise}
                updatedCar={updatedCar}
                handleChange={handleChange}
                isLoading={isLoading}
              />
            </Stack>
          </Grid>

          {/* Column 3 */}
          <Grid item xs={12} sm={3}>
            <Stack spacing={3}>
              <RenderTextField
                name="regNumber"
                label={t("car.reg-numb")}
                defaultValue={updatedCar.regNumber}
                updatedCar={updatedCar}
                handleChange={handleChange}
                isLoading={isLoading}
              />
              <RenderTextField
                type="number"
                name="engine"
                label={t("car.engine")}
                defaultValue={updatedCar.enginePower}
                updatedCar={updatedCar}
                handleChange={handleChange}
                isLoading={isLoading}
                adornment="c.c."
              />
              <Autocomplete
                freeSolo
                options={Object.values(PREDEFINED_COLORS)}
                value={updatedCar.color || ""}
                getOptionLabel={(option) =>
                  typeof option === "string" && option.length > 0
                    ? option.charAt(0).toUpperCase() + option.slice(1)
                    : option
                }
                onChange={(_, newValue) => {
                  handleChange({
                    target: {
                      name: "color",
                      value: (newValue || "").toLowerCase(),
                    },
                  });
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t("car.color") || "Цвет"}
                    name="color"
                    disabled={isLoading}
                    onChange={(e) => {
                      handleChange({
                        target: {
                          name: "color",
                          value: e.target.value.toLowerCase(),
                        },
                      });
                    }}
                  />
                )}
              />
              <RenderTextField
                type="number"
                name="deposit"
                label={t("car.deposit") || "Залог, €"}
                defaultValue={
                  typeof updatedCar.deposit !== "undefined"
                    ? updatedCar.deposit
                    : ""
                }
                updatedCar={updatedCar}
                handleChange={handleChange}
                isLoading={isLoading}
              />
              {/* <RenderTextField
                type="number"
                name="franchise"
                label={t("car.franchise") || "Франшиза"}
                defaultValue={updatedCar.franchise}
                updatedCar={updatedCar}
                handleChange={handleChange}
                isLoading={isLoading}
              /> */}
            </Stack>
          </Grid>

          <Grid item xs={12} sm={3}>
            <RenderSelectField
              name="class"
              label={t("car.class")}
              options={Object.values(CAR_CLASSES)}
              required
              updatedCar={updatedCar}
              handleChange={handleChange}
              isLoading={isLoading}
            />
            <RenderTextField
              type="number"
              name="enginePower"
              label={t("car.engine-pow")}
              defaultValue={updatedCar.enginePower}
              updatedCar={updatedCar}
              handleChange={handleChange}
              isLoading={isLoading}
              adornment="bhp"
            />
            <RenderTextField
              type="number"
              name="PriceChildSeats"
              label={t("car.childSeatsPrice") || "Цена детских кресел"}
              defaultValue={updatedCar.PriceChildSeats}
              updatedCar={updatedCar}
              handleChange={handleChange}
              isLoading={isLoading}
            />{" "}
            <FormControlLabel
              control={
                <Checkbox
                  checked={updatedCar.airConditioning || false}
                  onChange={handleCheckboxChange}
                  name="airConditioning"
                  disabled={isLoading}
                />
              }
              label={t("car.air")}
              sx={{ my: 0.5 }}
            />
          </Grid>

          <Grid item xs={12}>
            <PricingTiersTable
              car={updatedCar}
              open={open}
              disabled={isLoading}
              handleChange={handleChange}
              setUpdatedCar={setUpdatedCar}
              mirrorAllSeasonsFromNoSeason={company?.useSeasons === false}
            />
          </Grid>
        </Grid>
    </DialogLayout>
  );
};

export default EditCarModal;
