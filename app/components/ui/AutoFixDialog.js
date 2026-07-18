/**
 * AutoFixDialog
 *
 * Диалог подтверждения автоматического исправления времени.
 */

import {
  Button,
  Typography,
  Box,
  Alert,
  Chip,
} from "@mui/material";
import DialogLayout from "./modals/DialogLayout";

/**
 * @param {Object} props
 * @param {boolean} props.open - Открыт ли диалог
 * @param {Function} props.onClose - Закрыть диалог
 * @param {Array} props.suggestions - Массив предложений
 * @param {Function} props.onApply - Применить выбранное предложение
 * @param {string} props.currentPickupTime - Текущее время pickup
 * @param {string} props.currentReturnTime - Текущее время return
 */
export default function AutoFixDialog({
  open,
  onClose,
  suggestions = [],
  onApply,
  currentPickupTime,
  currentReturnTime,
}) {
  const handleApply = (suggestion) => {
    const result = suggestion.apply();
    onApply(result);
    onClose();
  };

  return (
    <DialogLayout
      open={open}
      onClose={onClose}
      maxWidth="sm"
      title="🔧 Автоматическое исправление времени"
      showCloseButton={true}
      closeOnBackdropClick={false}
      closeOnEscape={false}
    >
        <Typography variant="body2" sx={{ mb: 2 }}>
          Текущее время: <strong>{currentPickupTime}</strong> —{" "}
          <strong>{currentReturnTime}</strong>
        </Typography>

        {suggestions.length === 0 ? (
          <Alert severity="info">Нет доступных предложений</Alert>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {suggestions.map((suggestion) => (
              <Box
                key={suggestion.id}
                sx={{
                  p: 2,
                  border: "1px solid",
                  borderColor:
                    suggestion.severity === "block"
                      ? "error.main"
                      : suggestion.severity === "warning"
                      ? "warning.main"
                      : "success.main",
                  borderRadius: 1,
                  bgcolor:
                    suggestion.severity === "block"
                      ? "error.lighter"
                      : suggestion.severity === "warning"
                      ? "warning.lighter"
                      : "success.lighter",
                  opacity: suggestion.disabled ? 0.5 : 1,
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 1,
                  }}
                >
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {suggestion.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {suggestion.reason}
                    </Typography>
                  </Box>

                  <Chip
                    size="small"
                    label={
                      suggestion.severity === "block"
                        ? "⛔ Block"
                        : suggestion.severity === "warning"
                        ? "⚠️ Warning"
                        : "✅ Safe"
                    }
                    color={
                      suggestion.severity === "block"
                        ? "error"
                        : suggestion.severity === "warning"
                        ? "warning"
                        : "success"
                    }
                  />
                </Box>

                <Box sx={{ mt: 1.5 }}>
                  <Button
                    variant="contained"
                    size="small"
                    disabled={suggestion.disabled}
                    onClick={() => handleApply(suggestion)}
                    color={
                      suggestion.severity === "block"
                        ? "error"
                        : suggestion.severity === "warning"
                        ? "warning"
                        : "success"
                    }
                  >
                    Применить
                  </Button>
                </Box>
              </Box>
            ))}
          </Box>
        )}

      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
        <Button onClick={onClose} color="inherit">
          Отмена
        </Button>
      </Box>
    </DialogLayout>
  );
}

