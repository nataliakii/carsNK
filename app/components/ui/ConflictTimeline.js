/**
 * ConflictTimeline
 *
 * Визуализация временной шкалы как Google Calendar.
 * Показывает занятые слоты, буферные зоны и конфликты.
 */

import { Box, Typography, Tooltip } from "@mui/material";
import dayjs from "dayjs";

/**
 * Конвертирует время "HH:mm" в позицию на шкале (0-100%)
 */
function timeToPercent(time) {
  if (!time) return 0;
  const [hours, minutes] = time.split(":").map(Number);
  return ((hours * 60 + minutes) / (24 * 60)) * 100;
}

/**
 * @typedef {Object} TimeSegment
 * @property {string} start - "HH:mm"
 * @property {string} end - "HH:mm"
 * @property {"confirmed" | "pending"} status
 * @property {boolean} myOrder
 * @property {string} orderId
 * @property {string} [label]
 */

/**
 * @param {Object} props
 * @param {string} props.date - YYYY-MM-DD
 * @param {TimeSegment[]} props.segments - Занятые слоты
 * @param {Object} props.editing - { start: "HH:mm", end: "HH:mm" }
 * @param {number} [props.bufferHours] - Буфер в часах (только из company.bufferTime)
 * @param {Object} props.conflicts - { blocks: [], warnings: [], infos: [] }
 */
export default function ConflictTimeline({
  date,
  segments = [],
  editing = null,
  bufferHours,
  conflicts = { blocks: [], warnings: [], infos: [] },
}) {
  const effectiveBufferHours = (bufferHours != null && typeof bufferHours === "number" && bufferHours >= 0) ? bufferHours : 0;
  const hours = Array.from({ length: 25 }, (_, i) => i);

  const hasBlocks = conflicts?.blocks?.length > 0;
  const hasWarnings = conflicts?.warnings?.length > 0;

  return (
    <Box sx={{ mb: 2 }}>
      {/* Заголовок с конфликтами */}
      {(hasBlocks || hasWarnings) && (
        <Box
          sx={{
            mb: 1,
            p: 0.5,
            borderRadius: 1,
            bgcolor: hasBlocks ? "error.lighter" : "warning.lighter",
            border: "1px solid",
            borderColor: hasBlocks ? "error.main" : "warning.main",
          }}
        >
          <Typography
            variant="caption"
            sx={{ color: hasBlocks ? "error.main" : "warning.dark" }}
          >
            {hasBlocks
              ? `⛔ ${conflicts.blocks.length} конфликт(ов) — сохранение невозможно`
              : `⚠️ ${conflicts.warnings.length} предупреждение(й)`}
          </Typography>
        </Box>
      )}

      {/* Временная шкала */}
      <Box
        sx={{
          position: "relative",
          height: 40,
          bgcolor: "grey.100",
          borderRadius: 1,
          overflow: "hidden",
          border: "1px solid",
          borderColor: "grey.300",
        }}
      >
        {/* Часовые метки */}
        {hours.map((hour) => (
          <Box
            key={hour}
            sx={{
              position: "absolute",
              left: `${(hour / 24) * 100}%`,
              top: 0,
              bottom: 0,
              borderLeft: hour % 6 === 0 ? "1px solid" : "1px dashed",
              borderColor: hour % 6 === 0 ? "grey.400" : "grey.200",
              zIndex: 1,
            }}
          >
            {hour % 6 === 0 && (
              <Typography
                sx={{
                  position: "absolute",
                  top: -16,
                  left: -10,
                  fontSize: 10,
                  color: "grey.600",
                }}
              >
                {hour.toString().padStart(2, "0")}:00
              </Typography>
            )}
          </Box>
        ))}

        {/* Сегменты занятости */}
        {segments.map((segment, idx) => {
          const left = timeToPercent(segment.start);
          const right = timeToPercent(segment.end);
          const width = right - left;

          const isConfirmed = segment.status === "confirmed";
          const isMyOrder = segment.myOrder;

          return (
            <Tooltip
              key={idx}
              title={
                <Box>
                  <Typography variant="caption" display="block">
                    {segment.label || segment.orderId}
                  </Typography>
                  <Typography variant="caption" display="block">
                    {segment.start} - {segment.end}
                  </Typography>
                  <Typography variant="caption" display="block">
                    {isConfirmed ? "✅ Confirmed" : "⏳ Pending"}
                    {isMyOrder && " ★ MY"}
                  </Typography>
                </Box>
              }
            >
              <Box
                sx={{
                  position: "absolute",
                  left: `${left}%`,
                  width: `${width}%`,
                  top: 4,
                  bottom: 4,
                  bgcolor: isConfirmed
                    ? isMyOrder
                      ? "success.main"
                      : "primary.main"
                    : isMyOrder
                    ? "success.light"
                    : "primary.light",
                  opacity: isConfirmed ? 0.9 : 0.5,
                  borderRadius: 0.5,
                  border: "1px solid",
                  borderColor: isConfirmed ? "primary.dark" : "primary.main",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 5,
                  cursor: "pointer",
                  "&:hover": {
                    opacity: 1,
                  },
                }}
              >
                {isMyOrder && (
                  <Typography sx={{ fontSize: 10, color: "white" }}>★</Typography>
                )}
              </Box>
            </Tooltip>
          );
        })}

        {/* Буферные зоны (пунктир вокруг confirmed) */}
        {segments
          .filter((s) => s.status === "confirmed")
          .map((segment, idx) => {
            const startPercent = timeToPercent(segment.start);
            const endPercent = timeToPercent(segment.end);
            const bufferPercent = (effectiveBufferHours / 24) * 100;

            return (
              <Box key={`buffer-${idx}`}>
                {/* Буфер до */}
                <Box
                  sx={{
                    position: "absolute",
                    left: `${Math.max(0, startPercent - bufferPercent)}%`,
                    width: `${bufferPercent}%`,
                    top: 4,
                    bottom: 4,
                    border: "2px dashed",
                    borderColor: "warning.main",
                    borderRadius: 0.5,
                    zIndex: 3,
                    pointerEvents: "none",
                  }}
                />
                {/* Буфер после */}
                <Box
                  sx={{
                    position: "absolute",
                    left: `${endPercent}%`,
                    width: `${Math.min(bufferPercent, 100 - endPercent)}%`,
                    top: 4,
                    bottom: 4,
                    border: "2px dashed",
                    borderColor: "warning.main",
                    borderRadius: 0.5,
                    zIndex: 3,
                    pointerEvents: "none",
                  }}
                />
              </Box>
            );
          })}

        {/* Выбранный интервал (editing) */}
        {editing && editing.start && editing.end && (
          <Box
            sx={{
              position: "absolute",
              left: `${timeToPercent(editing.start)}%`,
              width: `${timeToPercent(editing.end) - timeToPercent(editing.start)}%`,
              top: 0,
              bottom: 0,
              bgcolor: hasBlocks
                ? "error.main"
                : hasWarnings
                ? "warning.main"
                : "success.main",
              opacity: 0.3,
              zIndex: 2,
              border: "2px solid",
              borderColor: hasBlocks
                ? "error.dark"
                : hasWarnings
                ? "warning.dark"
                : "success.dark",
            }}
          />
        )}
      </Box>

      {/* Легенда */}
      <Box sx={{ display: "flex", gap: 2, mt: 1, flexWrap: "wrap" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, bgcolor: "primary.main", borderRadius: 0.5 }} />
          <Typography variant="caption">Confirmed</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, bgcolor: "primary.light", opacity: 0.5, borderRadius: 0.5 }} />
          <Typography variant="caption">Pending</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box
            sx={{
              width: 12,
              height: 12,
              border: "2px dashed",
              borderColor: "warning.main",
              borderRadius: 0.5,
            }}
          />
          <Typography variant="caption">Buffer ({effectiveBufferHours}h)</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Typography variant="caption">★ = My Order</Typography>
        </Box>
      </Box>
    </Box>
  );
}

