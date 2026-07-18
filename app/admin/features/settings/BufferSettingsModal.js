/**
 * BufferSettingsModal
 * 
 * Модальное окно для настройки буфера времени между заказами.
 * Буфер — это минимальное время между возвратом одной машины и выдачей следующей.
 */

"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  Box,
  Button,
  Alert,
  IconButton,
  CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useMainContext } from "@app/Context";
import { updateCompanyBuffer } from "@utils/action";

export default function BufferSettingsModal({ open, onClose }) {
  const { company, updateCompanyInContext } = useMainContext();
  // bufferTime только из company (БД)
  const currentBufferTime = company?.bufferTime != null ? Number(company.bufferTime) : undefined;
  const [bufferHours, setBufferHours] = useState(currentBufferTime ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setBufferHours(currentBufferTime != null ? currentBufferTime : "");
      setError(null);
      setSuccess(false);
    }
  }, [open, currentBufferTime]);

  const handleSave = async () => {
    if (!company?._id) {
      setError("Компания не найдена");
      return;
    }

    const bufferValue = Number(bufferHours);

    // Валидация
    if (isNaN(bufferValue) || bufferValue < 0 || bufferValue > 24) {
      setError("Буфер должен быть числом от 0 до 24 часов");
      return;
    }

    // Если значение не изменилось - ничего не делаем
    if (currentBufferTime != null && bufferValue === currentBufferTime) {
      setError("Значение не изменилось");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Используем server action
      const result = await updateCompanyBuffer(company._id, bufferValue);

      if (!result.success) {
        throw new Error(result.error || "Ошибка при сохранении");
      }

      setSuccess(true);
      
      // Обновляем компанию в контексте
      if (result.data) {
        await updateCompanyInContext(company._id, result.data);
      } else {
        await updateCompanyInContext(company._id);
      }
      
      // Закрываем модальное окно через 1.5 секунды
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error("Error saving bufferTime:", err);
      setError(err.message || "Не удалось сохранить настройки буфера");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle sx={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        pb: 1 
      }}>
        <Typography variant="h6" component="span">
          ⚙️ Настройка буфера времени
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Буфер — это минимальное время между <strong>возвратом</strong> одной машины 
            и <strong>выдачей</strong> следующей. Это время нужно для:
          </Typography>
          <Typography component="ul" variant="body2" color="text.secondary" sx={{ pl: 2, mb: 2 }}>
            <li>Проверки состояния автомобиля</li>
            <li>Заправки (при необходимости)</li>
            <li>Уборки салона</li>
            <li>Подготовки документов</li>
          </Typography>
        </Box>

        <TextField
          label="Буфер (часы)"
          type="number"
          value={bufferHours}
          onChange={(e) => setBufferHours(Number(e.target.value))}
          fullWidth
          size="small"
          inputProps={{ min: 0, max: 24, step: 1 }}
          sx={{ mb: 2 }}
        />

        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            Текущее значение: <strong>{currentBufferTime} ч.</strong>
            {company?.bufferTime !== undefined && (
              <span style={{ color: "#666", fontSize: "0.875rem", marginLeft: "8px" }}>
                (из базы данных)
              </span>
            )}
            {company?.bufferTime === undefined && (
              <span style={{ color: "#666", fontSize: "0.875rem", marginLeft: "8px" }}>
                (fallback значение)
              </span>
            )}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Изменение буфера влияет на все проверки конфликтов заказов.
          </Typography>
        </Alert>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2">{error}</Typography>
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            <Typography variant="body2">
              ✅ Буфер успешно обновлён на {bufferHours} ч.!
            </Typography>
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button 
          onClick={onClose} 
          variant="outlined" 
          color="inherit"
          disabled={loading}
        >
          Отмена
        </Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          color="primary"
          disabled={loading || bufferHours === "" || isNaN(Number(bufferHours)) || (currentBufferTime != null && Number(bufferHours) === currentBufferTime)}
          startIcon={loading ? <CircularProgress size={16} /> : null}
        >
          {loading ? "Сохранение..." : "Сохранить"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

