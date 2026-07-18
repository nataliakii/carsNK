/**
 * ConflictBadge
 *
 * Маленький бейдж для отображения количества конфликтов.
 * Используется в ячейках и заголовках календаря.
 */

import { Box, Typography } from "@mui/material";

/**
 * @param {Object} props
 * @param {number} props.blocks - Количество блокирующих конфликтов
 * @param {number} props.warnings - Количество предупреждений
 * @param {number} props.infos - Количество info
 * @param {"small" | "medium"} props.size - Размер бейджа
 * @param {boolean} props.compact - Компактный режим (только иконки)
 */
export default function ConflictBadge({
  blocks = 0,
  warnings = 0,
  infos = 0,
  size = "small",
  compact = false,
}) {
  if (blocks === 0 && warnings === 0 && infos === 0) {
    return null;
  }

  const fontSize = size === "small" ? 10 : 12;
  const padding = size === "small" ? "1px 3px" : "2px 6px";
  const gap = size === "small" ? 0.5 : 1;

  return (
    <Box
      className="calendar-conflict-badge"
      sx={{
        display: "flex",
        gap,
        alignItems: "center",
        flexWrap: "nowrap",
      }}
    >
      {/* Blocks - красный */}
      {blocks > 0 && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.25,
            bgcolor: "error.main",
            color: "white",
            borderRadius: 0.5,
            px: padding,
            py: "1px",
          }}
        >
          <Typography sx={{ fontSize, fontWeight: 600, lineHeight: 1 }}>
            {compact ? "⛔" : `⛔ ${blocks}`}
          </Typography>
        </Box>
      )}

      {/* Warnings - жёлтый */}
      {warnings > 0 && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.25,
            bgcolor: "warning.main",
            color: "warning.contrastText",
            borderRadius: 0.5,
            px: padding,
            py: "1px",
          }}
        >
          <Typography sx={{ fontSize, fontWeight: 600, lineHeight: 1 }}>
            {compact ? "⚠️" : `⚠️ ${warnings}`}
          </Typography>
        </Box>
      )}

      {/* Infos - серый/голубой */}
      {infos > 0 && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.25,
            bgcolor: "info.light",
            color: "info.contrastText",
            borderRadius: 0.5,
            px: padding,
            py: "1px",
          }}
        >
          <Typography sx={{ fontSize, fontWeight: 600, lineHeight: 1 }}>
            {compact ? "ℹ️" : `ℹ️ ${infos}`}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

/**
 * Маленький бейдж для угла ячейки
 */
export function CellConflictBadge({ blocks = 0, warnings = 0, infos = 0 }) {
  if (blocks === 0 && warnings === 0 && infos === 0) {
    return null;
  }

  // Показываем только самый приоритетный
  const color = blocks > 0 ? "error.main" : warnings > 0 ? "warning.main" : "info.main";
  const icon = blocks > 0 ? "⛔" : warnings > 0 ? "⚠️" : "ℹ️";
  const count = blocks > 0 ? blocks : warnings > 0 ? warnings : infos;

  return (
    <Box
      className="calendar-conflict-badge"
      sx={{
        position: "absolute",
        top: 2,
        right: 2,
        bgcolor: color,
        color: "white",
        borderRadius: "50%",
        width: 16,
        height: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
        fontWeight: 700,
        zIndex: 10,
      }}
      title={`${blocks} blocks, ${warnings} warnings, ${infos} infos`}
    >
      {count}
    </Box>
  );
}

