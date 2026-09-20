"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  alpha,
} from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import { useTranslation } from "react-i18next";
import Link from "next/link";

import CarPhoto from "@app/components/CarComponent/CarPhoto";
import { formatMinor } from "@/domain/money/minorUnits";
import { formatDateTime } from "@/domain/time/businessTime";

const DECISION_ENDPOINT = "/api/booking/alternative";

/** Below this the deadline is shown as urgent rather than informational. */
const URGENT_MS = 6 * 60 * 60 * 1000;

function capitalize(value) {
  const str = String(value || "");
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

function joinPickup(pickup) {
  return [pickup?.place, pickup?.detail].filter(Boolean).join(" · ") || null;
}

/**
 * Photos plus the model name for one side of the comparison.
 * The first photo is the hero; the rest are selectable thumbnails.
 */
function VehiclePanel({ heading, side, highlight, fallbackName }) {
  const { t } = useTranslation();
  const [active, setActive] = useState(0);
  const photos = side.photos.length ? side.photos : [null];
  const name = side.name || fallbackName;

  return (
    <Box sx={{ minWidth: 0 }}>
      <Chip
        size="small"
        label={heading}
        color={highlight ? "primary" : "default"}
        variant={highlight ? "filled" : "outlined"}
        sx={{ mb: 1, fontWeight: 700 }}
      />

      <Box
        sx={{
          position: "relative",
          width: "100%",
          aspectRatio: "16 / 10",
          borderRadius: 2,
          overflow: "hidden",
          bgcolor: "background.subtle",
          border: "1px solid",
          borderColor: highlight ? "primary.main" : "divider",
        }}
      >
        <CarPhoto
          photoUrl={photos[active]}
          alt={name || ""}
          sizes="(max-width: 900px) 50vw, 33vw"
        />
      </Box>

      {photos.length > 1 && (
        <Stack direction="row" spacing={0.75} sx={{ mt: 0.75, flexWrap: "wrap", gap: 0.75 }}>
          {photos.map((photo, index) => (
            <Box
              key={`${photo}-${index}`}
              component="button"
              type="button"
              aria-label={t("alternativeOffer.photoNumber", { index: index + 1 })}
              aria-current={index === active}
              onClick={() => setActive(index)}
              sx={{
                position: "relative",
                width: 52,
                height: 36,
                p: 0,
                borderRadius: 1,
                overflow: "hidden",
                cursor: "pointer",
                border: "2px solid",
                borderColor: index === active ? "primary.main" : "divider",
                bgcolor: "background.subtle",
              }}
            >
              <CarPhoto photoUrl={photo} alt="" sizes="52px" iconSize={16} />
            </Box>
          ))}
        </Stack>
      )}

      <Typography
        sx={{ mt: 1, fontWeight: 700, fontSize: { xs: "0.95rem", md: "1.05rem" } }}
      >
        {name || t("alternativeOffer.notSpecified")}
      </Typography>
    </Box>
  );
}

/** Label / booked value / offered value. Differences stand out on the right. */
function ComparisonTable({ offer }) {
  const { t, i18n } = useTranslation();

  const money = useCallback(
    (minor) => formatMinor(minor, offer.currency, i18n.language),
    [offer.currency, i18n.language]
  );

  const dateTime = useCallback(
    (value) => formatDateTime(value, "DD MMM YYYY, HH:mm", offer.timezone),
    [offer.timezone]
  );

  const rows = useMemo(() => {
    const definitions = [
      { key: "category", label: t("alternativeOffer.spec.category"), read: (s) => s.category, format: capitalize },
      { key: "transmission", label: t("alternativeOffer.spec.transmission"), read: (s) => s.transmission, format: capitalize },
      { key: "seats", label: t("alternativeOffer.spec.seats"), read: (s) => s.seats },
      { key: "luggage", label: t("alternativeOffer.spec.luggage"), read: (s) => s.luggage },
      { key: "year", label: t("alternativeOffer.spec.year"), read: (s) => s.year },
      { key: "modelGroup", label: t("alternativeOffer.spec.modelGroup"), read: (s) => s.modelGroup },
      { key: "mileage", label: t("alternativeOffer.spec.mileage"), read: (s) => s.mileagePolicy },
      { key: "insurance", label: t("alternativeOffer.spec.insurance"), read: (s) => s.insurance },
      { key: "deposit", label: t("alternativeOffer.spec.deposit"), read: (s) => s.depositMinor, format: money },
      { key: "pickupAt", label: t("alternativeOffer.spec.pickupAt"), read: (s) => s.pickup.atUtc, format: dateTime },
      { key: "pickupPlace", label: t("alternativeOffer.spec.pickupPlace"), read: (s) => joinPickup(s.pickup) },
      { key: "price", label: t("alternativeOffer.spec.price"), read: (s) => s.priceMinor, format: money, emphasis: true },
    ];

    // A row with no stored value on either side would only add noise.
    return definitions
      .map((row) => ({
        ...row,
        bookedRaw: row.read(offer.booked),
        offeredRaw: row.read(offer.offered),
      }))
      .filter((row) => row.bookedRaw != null || row.offeredRaw != null);
  }, [offer, t, money, dateTime]);

  const cell = (raw, format) => {
    if (raw == null) return t("alternativeOffer.notSpecified");
    return format ? format(raw) : String(raw);
  };

  return (
    <Table size="small" sx={{ "& td, & th": { px: { xs: 1, sm: 2 } } }}>
      <TableHead>
        <TableRow>
          <TableCell sx={{ width: { xs: "34%", sm: "30%" } }} />
          <TableCell sx={{ fontWeight: 700, fontSize: { xs: "0.72rem", sm: "0.8rem" } }}>
            {t("alternativeOffer.bookedHeading")}
          </TableCell>
          <TableCell
            sx={{
              fontWeight: 700,
              fontSize: { xs: "0.72rem", sm: "0.8rem" },
              color: "primary.main",
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06),
            }}
          >
            {t("alternativeOffer.offeredHeading")}
          </TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => {
          const booked = cell(row.bookedRaw, row.format);
          const offered = cell(row.offeredRaw, row.format);
          const differs =
            row.bookedRaw != null && row.offeredRaw != null && booked !== offered;

          return (
            <TableRow key={row.key}>
              <TableCell
                component="th"
                scope="row"
                sx={{
                  color: "text.secondary",
                  fontSize: { xs: "0.75rem", sm: "0.85rem" },
                  fontWeight: 500,
                }}
              >
                {row.label}
              </TableCell>
              <TableCell
                sx={{
                  fontSize: { xs: "0.78rem", sm: "0.9rem" },
                  fontWeight: row.emphasis ? 700 : 400,
                  color: row.bookedRaw == null ? "text.disabled" : "text.primary",
                }}
              >
                {booked}
              </TableCell>
              <TableCell
                sx={{
                  fontSize: { xs: "0.78rem", sm: "0.9rem" },
                  fontWeight: row.emphasis || differs ? 700 : 400,
                  color:
                    row.offeredRaw == null
                      ? "text.disabled"
                      : differs
                      ? "primary.main"
                      : "text.primary",
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06),
                }}
              >
                {offered}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/** Absolute deadline plus a live countdown once the page is interactive. */
function DeadlineBanner({ expiresAt, timezone, expired }) {
  const { t } = useTranslation();
  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    if (!expiresAt) return undefined;
    const tick = () => setRemaining(new Date(expiresAt).getTime() - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const countdown = useMemo(() => {
    if (remaining == null || remaining <= 0) return null;
    const totalMinutes = Math.floor(remaining / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) return t("alternativeOffer.countdownDays", { days, hours });
    if (hours > 0) return t("alternativeOffer.countdownHours", { hours, minutes });
    return t("alternativeOffer.countdownMinutes", { minutes });
  }, [remaining, t]);

  const urgent = expired || (remaining != null && remaining < URGENT_MS);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 1.5, sm: 2 },
        borderColor: urgent ? "error.main" : "divider",
        bgcolor: (theme) =>
          alpha(urgent ? theme.palette.error.main : theme.palette.primary.main, 0.05),
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        alignItems={{ xs: "flex-start", sm: "center" }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
          <AccessTimeIcon fontSize="small" color={urgent ? "error" : "primary"} />
          <Typography sx={{ fontSize: { xs: "0.85rem", sm: "0.95rem" }, fontWeight: 600 }}>
            {expired
              ? t("alternativeOffer.expiredOn", {
                  datetime: formatDateTime(expiresAt, "DD MMM YYYY, HH:mm", timezone),
                })
              : t("alternativeOffer.respondBy", {
                  datetime: formatDateTime(expiresAt, "DD MMM YYYY, HH:mm", timezone),
                })}
          </Typography>
        </Stack>
        {countdown && !expired && (
          <Chip
            size="small"
            color={urgent ? "error" : "primary"}
            variant="outlined"
            label={t("alternativeOffer.timeLeft", { time: countdown })}
            sx={{ fontWeight: 700 }}
          />
        )}
      </Stack>
    </Paper>
  );
}

/**
 * Customer view of one alternative vehicle offer.
 *
 * Opening the page never changes anything: the accept and decline buttons are
 * the only things that POST, and each one restates its consequences in a
 * confirmation step before it is sent.
 */
export default function AlternativeOfferClient({ offer, locale = "en" }) {
  const { t } = useTranslation();

  const [outcome, setOutcome] = useState(null);
  const [confirming, setConfirming] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [expiredNow, setExpiredNow] = useState(false);

  // The page can sit open past the deadline; the server refuses either way.
  useEffect(() => {
    if (!offer.expiresAt || !offer.decidable) return undefined;
    const check = () => {
      if (new Date(offer.expiresAt).getTime() <= Date.now()) setExpiredNow(true);
    };
    check();
    const id = setInterval(check, 1000);
    return () => clearInterval(id);
  }, [offer.expiresAt, offer.decidable]);


  const status = outcome?.status || (expiredNow ? "EXPIRED" : offer.status);
  const decidable = status === "OFFERED";
  const refundDue =
    status === "DECLINED" && (outcome ? outcome.refundRequired : offer.afterPayment);

  const submit = async (decision) => {
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        `${DECISION_ENDPOINT}/${encodeURIComponent(offer.offerId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision,
            reason: decision === "decline" ? declineReason.trim() : "",
          }),
        }
      );
      const body = await response.json().catch(() => ({}));

      if (!response.ok || !body.success) {
        if (body.code === "expired" || response.status === 410) {
          setExpiredNow(true);
          setConfirming("");
          return;
        }
        throw new Error(
          body.code === "RATE_LIMIT"
            ? t("alternativeOffer.errorRateLimit")
            : body.message || t("alternativeOffer.errorGeneric")
        );
      }

      setOutcome({
        status: body.status,
        idempotent: Boolean(body.idempotent),
        refundRequired:
          Boolean(body.refundRequired) ||
          (body.status === "DECLINED" && offer.afterPayment),
      });
      setConfirming("");
    } catch (err) {
      setError(err?.message || t("alternativeOffer.errorGeneric"));
    } finally {
      setPending(false);
    }
  };


  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, md: 6 } }}>
      <Stack spacing={{ xs: 2, md: 3 }}>
        <Box>
          {offer.orderNumber && (
            <Chip
              size="small"
              variant="outlined"
              label={t("alternativeOffer.bookingRef", { orderNumber: offer.orderNumber })}
              sx={{ mb: 1 }}
            />
          )}
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {t("alternativeOffer.pageTitle")}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {t("alternativeOffer.intro")}
          </Typography>
        </Box>

        {offer.reasonForReplacement && (
          <Alert
            severity={decidable ? "warning" : "info"}
            icon={<ReportProblemOutlinedIcon />}
          >
            <AlertTitle sx={{ fontWeight: 700 }}>
              {t("alternativeOffer.reasonTitle")}
            </AlertTitle>
            {offer.reasonForReplacement}
          </Alert>
        )}


        {status === "ACCEPTED" && (
          <Alert severity="success" icon={<CheckCircleOutlineIcon />}>
            <AlertTitle sx={{ fontWeight: 700 }}>
              {t("alternativeOffer.acceptedTitle")}
            </AlertTitle>
            <Typography variant="body2" sx={{ mb: 1 }}>
              {offer.afterPayment
                ? t("alternativeOffer.acceptedBodyPaid")
                : t("alternativeOffer.acceptedBodyUnpaid")}
            </Typography>
            {outcome?.idempotent && (
              <Typography variant="body2" color="text.secondary">
                {t("alternativeOffer.alreadyRecorded")}
              </Typography>
            )}
            {offer.decidedAt && !outcome && (
              <Typography variant="body2" color="text.secondary">
                {t("alternativeOffer.decidedOn", {
                  datetime: formatDateTime(
                    offer.decidedAt,
                    "DD MMM YYYY, HH:mm",
                    offer.timezone
                  ),
                })}
              </Typography>
            )}
          </Alert>
        )}

        {status === "DECLINED" && (
          <Alert severity="info" icon={<CancelOutlinedIcon />}>
            <AlertTitle sx={{ fontWeight: 700 }}>
              {t("alternativeOffer.declinedTitle")}
            </AlertTitle>
            <Typography variant="body2" sx={{ mb: 1 }}>
              {refundDue
                ? t("alternativeOffer.declinedBodyRefund")
                : t("alternativeOffer.declinedBodyNoPayment")}
            </Typography>
            {refundDue && (
              <Box component="ol" sx={{ pl: 2.5, m: 0, "& li": { mb: 0.5 } }}>
                <Typography component="li" variant="body2">
                  {t("alternativeOffer.refundStep1")}
                </Typography>
                <Typography component="li" variant="body2">
                  {t("alternativeOffer.refundStep2")}
                </Typography>
                <Typography component="li" variant="body2">
                  {t("alternativeOffer.refundStep3")}
                </Typography>
              </Box>
            )}
            {outcome?.idempotent && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {t("alternativeOffer.alreadyRecorded")}
              </Typography>
            )}
          </Alert>
        )}

        {status === "EXPIRED" && (
          <Alert severity="error">
            <AlertTitle sx={{ fontWeight: 700 }}>
              {t("alternativeOffer.expiredTitle")}
            </AlertTitle>
            {offer.afterPayment
              ? t("alternativeOffer.expiredBodyPaid")
              : t("alternativeOffer.expiredBodyUnpaid")}
          </Alert>
        )}

        {status === "WITHDRAWN" && (
          <Alert severity="info">
            <AlertTitle sx={{ fontWeight: 700 }}>
              {t("alternativeOffer.withdrawnTitle")}
            </AlertTitle>
            {t("alternativeOffer.withdrawnBody")}
          </Alert>
        )}


        {offer.expiresAt && (decidable || status === "EXPIRED") && (
          <DeadlineBanner
            expiresAt={offer.expiresAt}
            timezone={offer.timezone}
            expired={status === "EXPIRED"}
          />
        )}

        <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 } }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: { xs: 1.5, sm: 3 },
              mb: 2,
            }}
          >
            <VehiclePanel
              heading={t("alternativeOffer.bookedHeading")}
              side={offer.booked}
              fallbackName=""
            />
            <VehiclePanel
              heading={t("alternativeOffer.offeredHeading")}
              side={offer.offered}
              highlight
              fallbackName=""
            />
          </Box>

          <Divider sx={{ mb: 1 }} />
          <Box sx={{ overflowX: "auto", mx: { xs: -1, sm: 0 } }}>
            <ComparisonTable offer={offer} />
          </Box>

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mt: 1.5 }}
          >
            {t("alternativeOffer.priceGuarantee")}
          </Typography>
        </Paper>

        {decidable && (
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
              {t("alternativeOffer.decisionTitle")}
            </Typography>

            <Stack spacing={2} sx={{ mb: 2.5 }}>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: "0.95rem" }}>
                  {t("alternativeOffer.acceptHeading")}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {offer.afterPayment
                    ? t("alternativeOffer.acceptBodyPaid")
                    : t("alternativeOffer.acceptBodyUnpaid")}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: "0.95rem" }}>
                  {t("alternativeOffer.declineHeading")}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {offer.afterPayment
                    ? t("alternativeOffer.declineBodyPaid")
                    : t("alternativeOffer.declineBodyUnpaid")}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: "0.95rem" }}>
                  {t("alternativeOffer.doNothingHeading")}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t("alternativeOffer.doNothingBody")}
                </Typography>
              </Box>
            </Stack>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Button
                variant="contained"
                color="primary"
                size="large"
                fullWidth
                disabled={pending}
                onClick={() => setConfirming("accept")}
              >
                {t("alternativeOffer.accept")}
              </Button>
              <Button
                variant="outlined"
                color="error"
                size="large"
                fullWidth
                disabled={pending}
                onClick={() => setConfirming("decline")}
              >
                {t("alternativeOffer.decline")}
              </Button>
            </Stack>
          </Paper>
        )}

        <Typography variant="caption" color="text.secondary">
          {t("alternativeOffer.supportNote")}{" "}
          <Box
            component={Link}
            href={`/${locale}/booking-terms`}
            sx={{ color: "primary.main", fontWeight: 600 }}
          >
            {t("alternativeOffer.bookingTermsLink")}
          </Box>
        </Typography>
      </Stack>

      <Dialog
        open={confirming === "accept"}
        onClose={() => (pending ? null : setConfirming(""))}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {t("alternativeOffer.confirmAcceptTitle")}
        </DialogTitle>
        <DialogContent>
          <DialogContentText variant="body2">
            {offer.afterPayment
              ? t("alternativeOffer.acceptBodyPaid")
              : t("alternativeOffer.acceptBodyUnpaid")}
          </DialogContentText>
          <DialogContentText variant="body2" sx={{ mt: 1.5, fontWeight: 700 }}>
            {t("alternativeOffer.confirmAcceptConsent")}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirming("")} disabled={pending}>
            {t("alternativeOffer.goBack")}
          </Button>
          <Button
            variant="contained"
            onClick={() => submit("accept")}
            disabled={pending}
            startIcon={pending ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {pending ? t("alternativeOffer.submitting") : t("alternativeOffer.confirmAcceptCta")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={confirming === "decline"}
        onClose={() => (pending ? null : setConfirming(""))}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {t("alternativeOffer.confirmDeclineTitle")}
        </DialogTitle>
        <DialogContent>
          <DialogContentText variant="body2">
            {offer.afterPayment
              ? t("alternativeOffer.declineBodyPaid")
              : t("alternativeOffer.declineBodyUnpaid")}
          </DialogContentText>
          <TextField
            fullWidth
            multiline
            minRows={2}
            size="small"
            sx={{ mt: 2 }}
            label={t("alternativeOffer.declineReasonLabel")}
            value={declineReason}
            onChange={(event) => setDeclineReason(event.target.value)}
            disabled={pending}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirming("")} disabled={pending}>
            {t("alternativeOffer.goBack")}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => submit("decline")}
            disabled={pending}
            startIcon={pending ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {pending ? t("alternativeOffer.submitting") : t("alternativeOffer.confirmDeclineCta")}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
