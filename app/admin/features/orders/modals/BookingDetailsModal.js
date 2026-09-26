"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { styled, useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import { useSession } from "next-auth/react";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import { SummaryField, SummaryList } from "@/app/components/ui";
import CopyableContact from "@/app/admin/features/orders/components/CopyableContact";
import BookingDetailsActivity from "@/app/admin/features/orders/components/BookingDetailsActivity";
import MarketplacePaymentOpsPanel from "@/app/admin/features/orders/MarketplacePaymentOpsPanel";
import { buildBookingDetailsView } from "@/domain/booking/bookingDetailsView";
import { isPlatformBooking } from "@/domain/admin/rovaroContractorAdmin";
import {
  BOOKING_CAPABILITY,
  resolveOrderCapabilities,
} from "@/domain/orders/bookingCapabilities";
import { ROLE } from "@models/user";
import { LEGACY_FALLBACK_TZ } from "@/domain/time/resolveBusinessTimezone";
import {
  BOOKING_DETAILS_FOOTER_CLEARANCE,
  BOOKING_DETAILS_MODAL_MAX_WIDTH,
  BOOKING_DETAILS_SECTION_GRID_BREAKPOINT,
  BOOKING_DETAILS_SECTION_GRID_COLUMNS,
  BOOKING_DETAILS_SHEET_BREAKPOINT,
} from "@/domain/admin/bookingDetailsLayout";
import {
  AMENDMENT_REQUESTER,
  REPLACEMENT_KIND,
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY,
  amendPlatformBooking,
  amendPaidPlatformBooking,
  confirmRequestedVehicle,
  contactRovaroAboutBooking,
  declineBookingRequest,
  loadAdminOrder,
  loadOperationalAmendmentVehicles,
  loadReplacementFleetCars,
  loadSignedDrivingLicence,
  proposeEquivalentReplacement,
  reportBookingProblem,
} from "@/app/admin/features/orders/actions/bookingDetailsActions";

dayjs.extend(utc);
dayjs.extend(timezone);

const StickyHeader = styled(Box)(({ theme }) => ({
  position: "sticky",
  top: 0,
  zIndex: theme.zIndex.appBar,
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  gap: theme.spacing(0.75),
  padding: theme.spacing(1.5, 2),
  backgroundColor: theme.palette.background.paper,
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const HeaderTopRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: theme.spacing(1),
  minWidth: 0,
}));

const StickyFooter = styled(DialogActions)(({ theme }) => ({
  position: "sticky",
  bottom: 0,
  zIndex: theme.zIndex.appBar,
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "flex-end",
  gap: theme.spacing(0.75),
  padding: theme.spacing(1, 2),
  backgroundColor: theme.palette.background.paper,
  borderTop: `1px solid ${theme.palette.divider}`,
}));

const ContentColumn = styled(DialogContent)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1),
  padding: theme.spacing(1.25, 1.75),
  overflowX: "hidden",
  // The footer floats over the end of the content, so the content has to end
  // above it. Without this the last price line is unreadable when scrolled.
  paddingBottom: BOOKING_DETAILS_FOOTER_CLEARANCE,
}));

const SectionsGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: theme.spacing(0.85),
  width: "100%",
  [theme.breakpoints.up(BOOKING_DETAILS_SECTION_GRID_BREAKPOINT)]: {
    gridTemplateColumns: `repeat(${BOOKING_DETAILS_SECTION_GRID_COLUMNS}, minmax(0, 1fr))`,
    gap: theme.spacing(1),
  },
}));

const SectionPanel = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(0.15),
  minWidth: 0,
  padding: theme.spacing(0.65, 1),
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
}));

const GridFullWidth = styled(Box)({
  gridColumn: "1 / -1",
});

const SectionTitle = styled(Typography)(({ theme }) => ({
  fontWeight: theme.typography.fontWeightBold,
  color: theme.palette.text.primary,
  fontSize: "0.8rem",
  marginBottom: theme.spacing(0.25),
}));

const ReferenceText = styled(Typography)(({ theme }) => ({
  fontWeight: theme.typography.fontWeightBold,
  lineHeight: theme.typography.h6.lineHeight,
  minWidth: 0,
  overflowWrap: "break-word",
  wordBreak: "normal",
}));

/** Title and metadata use full header width; badges sit on their own row. */
const HeaderIdentity = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(0.25),
  minWidth: 0,
  flex: "1 1 auto",
}));

const HeaderMeta = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  overflowWrap: "break-word",
  wordBreak: "normal",
  lineHeight: 1.4,
}));

const HeaderAside = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  gap: theme.spacing(0.5),
  flexShrink: 0,
}));

const BadgeRow = styled(Box)(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "flex-start",
  gap: theme.spacing(0.5),
  minWidth: 0,
  width: "100%",
}));

const TONE_PALETTE = {
  status: "info",
  platform: "primary",
  internal: "secondary",
  pending: "warning",
  paymentExpired: "warning",
  settled: "success",
};

const HeaderBadge = styled(Chip, {
  shouldForwardProp: (prop) => prop !== "tone",
})(({ theme, tone }) => {
  const palette = theme.palette[TONE_PALETTE[tone] || "info"];
  return {
    fontWeight: theme.typography.fontWeightMedium,
    color: palette.contrastText,
    backgroundColor: palette.main,
  };
});

/**
 * The single most important number for a rental company: what the customer
 * still hands over at the desk. It is the only figure in the modal given
 * display weight.
 */
const SupplierPayout = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(0.25),
  padding: theme.spacing(1.25, 1.5),
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.primary.main}`,
  backgroundColor: theme.palette.action.hover,
}));

const SupplierPayoutAmount = styled(Typography)(({ theme }) => ({
  color: theme.palette.primary.main,
  fontWeight: theme.typography.fontWeightBold,
  lineHeight: 1.15,
  margin: 0,
}));

const TotalRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: theme.spacing(1),
  marginTop: theme.spacing(0.75),
}));

const TotalAmount = styled(Typography)(({ theme }) => ({
  fontWeight: theme.typography.fontWeightBold,
}));

const DocumentPreview = styled("img")(({ theme }) => ({
  width: "100%",
  maxWidth: "100%",
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`,
}));

const EMPTY_REPLACEMENT = Object.freeze({
  replacementSource: REPLACEMENT_KIND.GUARANTEED_CLASS,
  proposedCarId: "",
  proposedCarNumber: "",
  supplierMessage: "",
  guaranteeAck: false,
});

/** Matches the minimum the amendment validator enforces server-side. */
const AMENDMENT_REASON_MIN = 10;

const EMPTY_AMENDMENT = Object.freeze({
  reason: "",
  requestedBy: AMENDMENT_REQUESTER.CUSTOMER,
  consentRecorded: false,
  consentNote: "",
});

function useBookingClock(order) {
  const zone = order?.timezone || LEGACY_FALLBACK_TZ;
  return useCallback(
    (value) =>
      value ? dayjs.utc(value).tz(zone).format("DD.MM.YYYY HH:mm") : "",
    [zone]
  );
}

function messengerList(customer, t) {
  if (!customer) return "";
  const names = [];
  if (customer.whatsapp) names.push(t("bookingDetails.customer.whatsapp"));
  if (customer.viber) names.push(t("bookingDetails.customer.viber"));
  if (customer.telegram) names.push(t("bookingDetails.customer.telegram"));
  return names.join(", ");
}

function summaryHasValue(value) {
  return value != null && value !== "";
}

/**
 * The one Booking Details modal. Calendar, Orders list and the email deep link
 * all render this component against the current server state, so a booking
 * looks and behaves the same wherever it was opened from. INTERNAL bookings
 * keep their own company-owned editing flow in EditOrderModal.
 */
export default function BookingDetailsModal({
  order,
  open,
  onClose,
  onChanged,
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isSheet = useMediaQuery(
    theme.breakpoints.down(BOOKING_DETAILS_SHEET_BREAKPOINT)
  );
  const { data: session } = useSession();

  const [current, setCurrent] = useState(order || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState(null);
  const [supportCategory, setSupportCategory] = useState(
    SUPPORT_CATEGORY.BOOKING_DETAILS
  );
  const [reportedIssueType, setReportedIssueType] = useState("OTHER");
  const [supportMessage, setSupportMessage] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [licenceUrls, setLicenceUrls] = useState([]);
  const [priceOpen, setPriceOpen] = useState(false);
  const [vehicleDetailsOpen, setVehicleDetailsOpen] = useState(false);
  const [replacement, setReplacement] = useState(EMPTY_REPLACEMENT);
  const [fleetCars, setFleetCars] = useState([]);
  const [fleetLoading, setFleetLoading] = useState(false);
  const [fleetError, setFleetError] = useState("");
  const [amendment, setAmendment] = useState(EMPTY_AMENDMENT);
  const [operationalDraft, setOperationalDraft] = useState({});
  const [operationalVehicles, setOperationalVehicles] = useState([]);
  const [operationalFleetLoading, setOperationalFleetLoading] = useState(false);
  const [customerAgreementChecked, setCustomerAgreementChecked] =
    useState(false);
  const [operationalAmendmentNote, setOperationalAmendmentNote] = useState("");

  const orderId = order?._id ? String(order._id) : "";

  // Every entry point fetches the current server state; the URL only ever
  // carries the id.
  useEffect(() => {
    if (!open || !orderId) return undefined;
    let alive = true;
    setCurrent(order);
    loadAdminOrder(orderId).then((result) => {
      if (alive && result?.ok && result.order) setCurrent(result.order);
    });
    return () => {
      alive = false;
    };
  }, [open, orderId, order]);

  const view = useMemo(
    () => (current ? buildBookingDetailsView(current, session?.user) : null),
    [current, session?.user]
  );
  const isSuperAdmin = Number(session?.user?.role) === ROLE.SUPERADMIN;
  const canViewActivity = Boolean(
    current &&
      session?.user &&
      resolveOrderCapabilities(current, session.user)[
        BOOKING_CAPABILITY.VIEW_AUDIT_HISTORY
      ]
  );

  useEffect(() => {
    if (!open || dialog !== "amend" || isSuperAdmin) return undefined;
    let alive = true;
    setOperationalFleetLoading(true);
    loadOperationalAmendmentVehicles(orderId).then((result) => {
      if (!alive) return;
      setOperationalFleetLoading(false);
      setOperationalVehicles(result?.ok ? result.vehicles : []);
      if (!result?.ok)
        setError(result?.message || "Could not load fleet vehicles");
    });
    return () => {
      alive = false;
    };
  }, [open, dialog, isSuperAdmin, orderId]);

  useEffect(() => {
    if (!open || !orderId || !view?.showLicence) {
      setLicenceUrls([]);
      return;
    }
    let alive = true;
    loadSignedDrivingLicence(orderId).then((urls) => {
      if (alive) setLicenceUrls(urls);
    });
    return () => {
      alive = false;
    };
  }, [open, orderId, view?.showLicence]);

  useEffect(() => {
    if (dialog !== "replace") return undefined;
    setReplacement(EMPTY_REPLACEMENT);
    setFleetCars([]);
    setFleetError("");
    let alive = true;
    setFleetLoading(true);
    loadReplacementFleetCars(orderId).then((result) => {
      if (!alive) return;
      setFleetLoading(false);
      if (!result?.ok) {
        setFleetError(result?.message || "Could not load fleet cars");
        return;
      }
      setFleetCars(Array.isArray(result.cars) ? result.cars : []);
    });
    return () => {
      alive = false;
    };
  }, [dialog, orderId]);

  const formatMoment = useBookingClock(current);

  // One metadata line rather than three: when, for how long, and where.
  const headerMetaLine = useMemo(() => {
    const header = view?.header;
    if (!header) return "";
    const window = [header.pickupAt, header.returnAt]
      .map((moment) => (moment ? formatMoment(moment) : ""))
      .filter(Boolean)
      .join(" → ");
    const days =
      header.rentalDays != null
        ? t("bookingDetails.header.days", { count: header.rentalDays })
        : "";
    return [window, days, header.city].filter(Boolean).join(" · ");
  }, [view?.header, formatMoment, t]);

  const refresh = useCallback(async () => {
    const fresh = await loadAdminOrder(orderId);
    if (fresh?.ok) setCurrent(fresh.order);
    onChanged?.(orderId);
  }, [orderId, onChanged]);

  const run = useCallback(
    async (operation, successKey) => {
      setBusy(true);
      setError("");
      const result = await operation();
      setBusy(false);
      if (!result?.ok) {
        setError(result?.message || t("bookingDetails.errors.generic"));
        return false;
      }
      setDialog(null);
      if (successKey) setNotice(t(successKey));
      await refresh();
      return true;
    },
    [refresh, t]
  );

  if (!open || !current || !view || !isPlatformBooking(current)) return null;

  const { price } = view;
  const fleetSelected =
    replacement.replacementSource === REPLACEMENT_KIND.COMPANY_VEHICLE &&
    Boolean(replacement.proposedCarId);
  const classGuaranteed =
    replacement.replacementSource === REPLACEMENT_KIND.GUARANTEED_CLASS &&
    replacement.guaranteeAck === true;
  const replacementReady = fleetSelected || classGuaranteed;
  const priceBreakdown = (
    <Box sx={{ mt: 0.75 }} id="booking-details-price">
      {price.lines.map((line) => (
        <Typography
          key={line.key}
          variant="caption"
          color="text.secondary"
          sx={{
            display: "flex",
            justifyContent: "space-between",
            gap: 1,
            lineHeight: 1.45,
          }}
        >
          <span>{t(line.labelKey, { defaultValue: line.label })}</span>
          <span>{line.free ? t("bookingDetails.price.free") : line.text}</span>
        </Typography>
      ))}
      {price.paidToRovaroText ? (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: "flex",
            justifyContent: "space-between",
            gap: 1,
            lineHeight: 1.45,
          }}
        >
          <span>
            {t("bookingDetails.price.paidToRovaro", {
              rate: price.feePercentLabel,
            })}
          </span>
          <span>{price.paidToRovaroText}</span>
        </Typography>
      ) : null}
    </Box>
  );

  const vehicle = view.vehicle;
  const showVehiclePanel = Boolean(vehicle);

  const priceTotal = price.totalText ? (
    <TotalRow data-testid="total-rental-price">
      <Typography variant="body2" color="text.secondary">
        {t("bookingDetails.price.totalRentalPrice")}
      </Typography>
      <TotalAmount variant="body1">{price.totalText}</TotalAmount>
    </TotalRow>
  ) : null;

  const moneyPanel = (
    <GridFullWidth>
      <SectionPanel data-testid="booking-money">
        {price.payableToSupplierText ? (
          <SupplierPayout data-testid="payable-to-supplier">
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontWeight: 600 }}
            >
              {t("bookingDetails.price.payableToSupplier")}
            </Typography>
            <SupplierPayoutAmount variant="h4" component="p">
              {price.payableToSupplierText}
            </SupplierPayoutAmount>
            <Typography variant="caption" color="text.secondary">
              {t("bookingDetails.price.payableToSupplierHint")}
            </Typography>
          </SupplierPayout>
        ) : null}
        {priceTotal}
        <Button
          size="small"
          onClick={() => setPriceOpen((was) => !was)}
          sx={{ mt: 0.5, px: 0, minWidth: 0, textTransform: "none" }}
          aria-expanded={priceOpen}
          aria-controls="booking-details-price"
        >
          {priceOpen
            ? t("bookingDetails.price.hideBreakdown", {
                defaultValue: "Hide price details",
              })
            : t("bookingDetails.price.showBreakdown", {
                defaultValue: "Price details",
              })}
        </Button>
        {priceOpen ? priceBreakdown : null}
      </SectionPanel>
    </GridFullWidth>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      fullScreen={isSheet}
      maxWidth={false}
      aria-labelledby="booking-details-title"
      PaperProps={{
        "data-testid": "booking-details-modal",
        sx: {
          width: "100%",
          maxWidth: BOOKING_DETAILS_MODAL_MAX_WIDTH,
          overflowX: "hidden",
        },
      }}
    >
      <StickyHeader>
        <HeaderTopRow>
          <HeaderIdentity>
            <ReferenceText
              variant="h6"
              component="h2"
              id="booking-details-title"
            >
              {[view.header.vehicleName, view.header.reference]
                .filter(Boolean)
                .join(" · ")}
            </ReferenceText>
            {view.header.companyName ? (
              <HeaderMeta variant="body2" component="div">
                {view.header.companyName}
              </HeaderMeta>
            ) : null}
            {headerMetaLine ? (
              <HeaderMeta variant="body2" component="div">
                {headerMetaLine}
              </HeaderMeta>
            ) : null}
          </HeaderIdentity>
          <HeaderAside>
            <IconButton
              onClick={onClose}
              size="small"
              aria-label={t("bookingDetails.close")}
            >
              <CloseIcon />
            </IconButton>
          </HeaderAside>
        </HeaderTopRow>
        {view.header.badges?.length ? (
          <BadgeRow>
            {view.header.badges.map((badge) => (
              <HeaderBadge
                key={badge.id}
                size="small"
                tone={badge.tone}
                label={t(badge.labelKey, { defaultValue: badge.label })}
              />
            ))}
          </BadgeRow>
        ) : null}
      </StickyHeader>

      <ContentColumn dividers={false}>
        {view.showPrivacyNotice ? (
          <Typography
            variant="caption"
            color="text.secondary"
            data-testid="privacy-notice"
            sx={{ display: "block", lineHeight: 1.4, px: 0.25 }}
          >
            {t("bookingDetails.privacyNotice")}
          </Typography>
        ) : null}
        {price.dataWarning ? (
          <Alert severity="warning" data-testid="price-data-warning">
            {t("bookingDetails.price.dataWarning")}
          </Alert>
        ) : null}
        {error && !dialog ? <Alert severity="error">{error}</Alert> : null}
        {notice ? <Alert severity="success">{notice}</Alert> : null}

        <SectionsGrid>
          {moneyPanel}

          {isPlatformBooking(current) ? (
            <GridFullWidth>
              <MarketplacePaymentOpsPanel
                order={current}
                currentUser={session?.user}
                isSuperAdmin={isSuperAdmin}
                onOrderUpdated={(updated) => {
                  if (updated) {
                    setCurrent(updated);
                    onChanged?.(updated);
                  }
                }}
              />
            </GridFullWidth>
          ) : null}

          {showVehiclePanel ? (
            <SectionPanel data-testid="vehicle-snapshot">
              <SectionTitle variant="subtitle2">
                {t(
                  view.replacement
                    ? "bookingDetails.replacement.originallyRequested"
                    : "bookingDetails.sections.vehicle"
                )}
              </SectionTitle>
              <Button
                fullWidth
                onClick={() => setVehicleDetailsOpen(true)}
                sx={{
                  justifyContent: "space-between",
                  textAlign: "left",
                  textTransform: "none",
                  px: 0,
                  py: 0.25,
                  color: "text.primary",
                  "&:hover": { backgroundColor: "transparent", opacity: 0.85 },
                }}
                endIcon={
                  <InfoOutlinedIcon
                    sx={{ fontSize: 18, color: "text.secondary" }}
                  />
                }
                data-testid="vehicle-specs-info"
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 700, lineHeight: 1.25, fontSize: "1rem" }}
                  >
                    {vehicle.displayName}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="primary"
                    sx={{ lineHeight: 1.3 }}
                  >
                    {t("bookingDetails.vehicle.viewSpecs", {
                      defaultValue: "View specs",
                    })}
                  </Typography>
                </Box>
              </Button>
              {current.actualVehicle ? (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  data-testid="actual-supplied-vehicle"
                  sx={{ display: "block", mt: 0.75 }}
                >
                  {t("bookingDetails.vehicle.actualSupplied", {
                    defaultValue: "Vehicle actually supplied",
                  })}
                  :{" "}
                  {[
                    current.actualVehicle.make,
                    current.actualVehicle.model,
                    current.actualVehicle.carNumber,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </Typography>
              ) : null}
            </SectionPanel>
          ) : null}

          {(() => {
            const pickup = [current.placeIn, current.placeInDetail]
              .filter(Boolean)
              .join(" — ");
            const dropoff = [current.placeOut, current.placeOutDetail]
              .filter(Boolean)
              .join(" — ");
            if (!pickup && !dropoff) return null;
            const samePlace = pickup && dropoff && pickup === dropoff;
            return (
              <SectionPanel data-testid="booking-locations">
                <SectionTitle variant="subtitle2">
                  {t("bookingDetails.sections.locations", {
                    defaultValue: "Locations",
                  })}
                </SectionTitle>
                {samePlace ? (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ lineHeight: 1.35 }}
                  >
                    {pickup}
                  </Typography>
                ) : (
                  <Box>
                    {pickup ? (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ lineHeight: 1.35 }}
                      >
                        {t("bookingDetails.dates.pickupShort", {
                          defaultValue: "Pickup",
                        })}
                        : {pickup}
                      </Typography>
                    ) : null}
                    {dropoff ? (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ lineHeight: 1.35 }}
                      >
                        {t("bookingDetails.dates.returnShort", {
                          defaultValue: "Return",
                        })}
                        : {dropoff}
                      </Typography>
                    ) : null}
                  </Box>
                )}
              </SectionPanel>
            );
          })()}

          {view.replacement ? (
            <GridFullWidth>
              <SectionPanel data-testid="replacement-proposal">
                <SectionTitle variant="subtitle2">
                  {t("bookingDetails.replacement.confirmedAs")}
                </SectionTitle>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {view.replacement.model}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {[
                    view.replacement.category,
                    view.replacement.transmission,
                    view.replacement.seats != null
                      ? t("bookingDetails.vehicle.seatsShort", {
                          count: view.replacement.seats,
                        })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Typography>
                {view.replacement.supplierMessage ? (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 0.5 }}
                  >
                    {view.replacement.supplierMessage}
                  </Typography>
                ) : null}
              </SectionPanel>
            </GridFullWidth>
          ) : null}

          <GridFullWidth>
            <SectionPanel>
              <SectionTitle variant="subtitle2">
                {t("bookingDetails.sections.options")}
              </SectionTitle>
              <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.5}>
                {current.insurance ? (
                  <Chip
                    size="small"
                    label={`${t("bookingDetails.options.insurance")}: ${
                      current.insurance
                    }`}
                    sx={{ height: 22, fontSize: "0.7rem" }}
                  />
                ) : null}
                {current.franchiseOrder != null &&
                current.franchiseOrder !== "" ? (
                  <Chip
                    size="small"
                    label={`${t("bookingDetails.options.excess")}: ${
                      current.franchiseOrder
                    }`}
                    sx={{ height: 22, fontSize: "0.7rem" }}
                  />
                ) : null}
                {current.ChildSeats != null &&
                Number(current.ChildSeats) > 0 ? (
                  <Chip
                    size="small"
                    label={`${t("bookingDetails.options.childSeats")}: ${
                      current.ChildSeats
                    }`}
                    sx={{ height: 22, fontSize: "0.7rem" }}
                  />
                ) : null}
                {current.secondDriver ? (
                  <Chip
                    size="small"
                    label={t("bookingDetails.options.secondDriver")}
                    sx={{ height: 22, fontSize: "0.7rem" }}
                  />
                ) : null}
                {!current.insurance &&
                (current.franchiseOrder == null ||
                  current.franchiseOrder === "") &&
                !(
                  current.ChildSeats != null && Number(current.ChildSeats) > 0
                ) &&
                !current.secondDriver ? (
                  <Typography variant="caption" color="text.secondary">
                    —
                  </Typography>
                ) : null}
              </Stack>
            </SectionPanel>
          </GridFullWidth>

          {view.customer ? (
            <GridFullWidth>
              <SectionPanel>
                <SectionTitle variant="subtitle2">
                  {t("bookingDetails.sections.customer")}
                </SectionTitle>
                <SummaryList component="dl">
                  <SummaryField
                    label={t("bookingDetails.customer.name")}
                    value={view.customer.name}
                  />
                  {/* CONTACT_CUSTOMER is what makes a contact reachable and
                    copyable, so it stays the gate even without a button. */}
                  {view.canContactCustomer ? (
                    <>
                      <SummaryField label={t("bookingDetails.customer.phone")}>
                        <CopyableContact
                          value={view.customer.phone}
                          href={`tel:${view.customer.phone}`}
                          copyLabel={t("bookingDetails.customer.copyPhone")}
                          copiedLabel={t("bookingDetails.customer.copied")}
                        />
                      </SummaryField>
                      <SummaryField label={t("bookingDetails.customer.email")}>
                        <CopyableContact
                          value={view.customer.email}
                          href={`mailto:${view.customer.email}`}
                          copyLabel={t("bookingDetails.customer.copyEmail")}
                          copiedLabel={t("bookingDetails.customer.copied")}
                        />
                      </SummaryField>
                    </>
                  ) : null}
                  <SummaryField
                    label={t("bookingDetails.customer.messengers")}
                    value={messengerList(view.customer, t)}
                  />
                  <SummaryField
                    label={t("bookingDetails.customer.notes")}
                    value={view.customer.notes}
                  />
                </SummaryList>
              </SectionPanel>
            </GridFullWidth>
          ) : null}

          {view.showLicence ? (
            <GridFullWidth>
              <SectionPanel>
                <SectionTitle variant="subtitle2">
                  {t("bookingDetails.sections.documents")}
                </SectionTitle>
                <SummaryList component="dl">
                  <SummaryField
                    label={t("bookingDetails.documents.holder")}
                    value={view.licence?.holderName}
                  />
                  <SummaryField
                    label={t("bookingDetails.documents.number")}
                    value={view.licence?.licenceNumber}
                  />
                  <SummaryField
                    label={t("bookingDetails.documents.country")}
                    value={view.licence?.issuingCountry}
                  />
                  <SummaryField
                    label={t("bookingDetails.documents.expires")}
                    value={view.licence?.expiryDate}
                  />
                </SummaryList>
                {licenceUrls.map((url) => (
                  <DocumentPreview
                    key={url}
                    src={url}
                    alt={t("bookingDetails.documents.preview")}
                  />
                ))}
                {!view.licence?.holderName &&
                !view.licence?.licenceNumber &&
                licenceUrls.length === 0 ? (
                  <Typography variant="caption" color="text.secondary">
                    {current?.hasDrivingLicence
                      ? t("bookingDetails.documents.onFile", {
                          defaultValue:
                            "Driving licence is on file. Open the preview once images load.",
                        })
                      : t("bookingDetails.documents.noneUploaded", {
                          defaultValue:
                            "No driving licence was uploaded for this booking.",
                        })}
                  </Typography>
                ) : null}
              </SectionPanel>
            </GridFullWidth>
          ) : null}

          {canViewActivity && orderId ? (
            <GridFullWidth>
              <SectionPanel data-testid="booking-activity">
                <SectionTitle variant="subtitle2">
                  {t("bookingDetails.sections.activity", {
                    defaultValue: "Change log",
                  })}
                </SectionTitle>
                <BookingDetailsActivity orderId={orderId} />
              </SectionPanel>
            </GridFullWidth>
          ) : null}

          {Array.isArray(current?.operationalAmendments) &&
          current.operationalAmendments.length > 0 ? (
            <GridFullWidth>
              <SectionPanel data-testid="operational-amendment-history">
                <SectionTitle variant="subtitle2">
                  Operational amendment history
                </SectionTitle>
                {[...current.operationalAmendments]
                  .reverse()
                  .map((revision, index) => (
                    <Box
                      key={`${revision.checksum || revision.at}-${index}`}
                      sx={{
                        py: 0.75,
                        borderBottom: "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ display: "block", fontWeight: 700 }}
                      >
                        {formatMoment(revision.at)} ·{" "}
                        {revision.actor?.email || "—"} ·{" "}
                        {(revision.fieldsChanged || []).join(", ")}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Customer agreement recorded
                        {revision.note ? ` · ${revision.note}` : ""}
                      </Typography>
                    </Box>
                  ))}
              </SectionPanel>
            </GridFullWidth>
          ) : null}
        </SectionsGrid>
      </ContentColumn>

      <StickyFooter>
        {busy ? <CircularProgress size={theme.typography.h6.fontSize} /> : null}
        {view.actions.map((action) => {
          const isDecline = action.id === "decline";
          const isConfirm = action.id === "confirm";
          const isReplace = action.id === "replace";
          const isMainAction = isConfirm || isReplace || isDecline;
          return (
            <Button
              key={action.id}
              variant={isMainAction ? "outlined" : "text"}
              color={isDecline ? "error" : isConfirm ? "success" : "inherit"}
              data-testid={`booking-action-${action.id}`}
              disabled={busy}
              onClick={() => {
                setError("");
                setNotice("");
                if (action.id === "amend") {
                  setOperationalDraft({
                    customerName: current.customerName || "",
                    phone: current.phone || "",
                    email: current.email || "",
                    actualCarId: current.actualVehicle?.carId || "",
                    placeInDetail: current.placeInDetail || "",
                    placeOutDetail: current.placeOutDetail || "",
                    flightNumber: current.flightNumber || "",
                    hotelInformation: current.hotelInformation || "",
                    pickupNotes: current.pickupNotes || "",
                    returnNotes: current.returnNotes || "",
                    operationalNotes: current.operationalNotes || "",
                    insurance: current.insurance || "",
                    ChildSeats: Number(
                      current.ChildSeats ?? current.childSeats ?? 0
                    ),
                    secondDriver: Boolean(current.secondDriver),
                    drivingLicenceVerificationStatus:
                      current.drivingLicenceVerificationStatus || "PENDING",
                  });
                  setOperationalVehicles([]);
                  setCustomerAgreementChecked(false);
                  setOperationalAmendmentNote("");
                  setAmendment(EMPTY_AMENDMENT);
                }
                setDialog(action.id);
              }}
            >
              {t(action.labelKey, { defaultValue: action.label })}
            </Button>
          );
        })}
        <Button onClick={onClose} disabled={busy}>
          {t("bookingDetails.close")}
        </Button>
      </StickyFooter>

      <Dialog
        open={dialog === "confirm"}
        onClose={() => setDialog(null)}
        fullWidth
        maxWidth="xs"
      >
        <StickyHeader>
          <Typography variant="h6" component="h3">
            {t("bookingDetails.confirmDialog.title")}
          </Typography>
        </StickyHeader>
        <ContentColumn>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Typography variant="body2" color="text.secondary">
            {t("bookingDetails.confirmDialog.obligation", {
              defaultValue:
                "You are committing to provide this car for the dates, locations, and price shown. If something happens and you cannot, you must promptly offer an equivalent replacement or decline — do not leave the customer without a vehicle.",
            })}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 700, mt: 1 }}>
            {current.carModel || current.car?.model || vehicle?.displayName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {[
              formatMoment(current.pickupAtUtc || current.timeIn),
              formatMoment(current.returnAtUtc || current.timeOut),
            ]
              .filter(Boolean)
              .join(" → ")}
          </Typography>
          {price.payableToSupplierText || price.totalText ? (
            <Typography variant="body2" sx={{ fontWeight: 700, mt: 0.5 }}>
              {price.payableToSupplierText || price.totalText}
              {price.payableToSupplierText
                ? ` · ${t("bookingDetails.price.payableToSupplier")}`
                : ""}
            </Typography>
          ) : null}
        </ContentColumn>
        <StickyFooter>
          <Button onClick={() => setDialog(null)} disabled={busy}>
            {t("bookingDetails.back")}
          </Button>
          <Button
            variant="outlined"
            color="success"
            disabled={busy}
            data-testid="confirm-requested-vehicle"
            onClick={() =>
              run(
                () => confirmRequestedVehicle(orderId),
                "bookingDetails.notices.confirmed"
              )
            }
          >
            {t("bookingDetails.confirmDialog.confirm", {
              defaultValue: "Yes, I commit to provide this vehicle",
            })}
          </Button>
        </StickyFooter>
      </Dialog>

      <Dialog
        open={vehicleDetailsOpen}
        onClose={() => setVehicleDetailsOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <StickyHeader>
          <Typography variant="h6" component="h3">
            {vehicle?.displayName || t("bookingDetails.sections.vehicle")}
          </Typography>
          <IconButton
            size="small"
            onClick={() => setVehicleDetailsOpen(false)}
            aria-label={t("bookingDetails.close")}
          >
            <CloseIcon />
          </IconButton>
        </StickyHeader>
        <ContentColumn>
          <Stack spacing={0.5}>
            {[
              vehicle?.class && [
                t("bookingDetails.vehicle.class"),
                vehicle.class,
              ],
              vehicle?.transmission && [
                t("bookingDetails.vehicle.transmission"),
                vehicle.transmission,
              ],
              vehicle?.fuelType && [
                t("bookingDetails.vehicle.fuel"),
                vehicle.fuelType,
              ],
              vehicle?.seats != null &&
                vehicle.seats !== "" && [
                  t("bookingDetails.vehicle.seats"),
                  String(vehicle.seats),
                ],
              vehicle?.doors != null &&
                vehicle.doors !== "" && [
                  t("bookingDetails.vehicle.doors"),
                  String(vehicle.doors),
                ],
              typeof vehicle?.airConditioning === "boolean" && [
                t("bookingDetails.vehicle.airConditioning"),
                t(
                  vehicle.airConditioning
                    ? "bookingDetails.options.yes"
                    : "bookingDetails.options.no"
                ),
              ],
            ]
              .filter(Boolean)
              .map(([label, value]) => (
                <Stack
                  key={label}
                  direction="row"
                  justifyContent="space-between"
                  spacing={2}
                >
                  <Typography variant="body2" color="text.secondary">
                    {label}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {value}
                  </Typography>
                </Stack>
              ))}
          </Stack>
        </ContentColumn>
        <StickyFooter>
          <Button onClick={() => setVehicleDetailsOpen(false)}>
            {t("bookingDetails.close")}
          </Button>
        </StickyFooter>
      </Dialog>

      <Dialog
        open={dialog === "replace"}
        onClose={() => setDialog(null)}
        fullWidth
      >
        <StickyHeader>
          <Typography variant="h6" component="h3">
            {t("bookingDetails.actions.replace")}
          </Typography>
        </StickyHeader>
        <ContentColumn>
          <Typography variant="body2">
            {t("bookingDetails.replacementDialog.introFleet", {
              defaultValue:
                "All cars in your fleet are shown. Cars that do not meet the requested terms cannot be offered; availability is checked again when the customer accepts.",
            })}
          </Typography>
          <Alert
            severity="info"
            sx={{ "& .MuiAlert-message": { width: "100%" } }}
          >
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
              {t("bookingDetails.replacementDialog.reminderTitle", {
                defaultValue: "Requested vehicle terms",
              })}
            </Typography>
            <Typography variant="body2" component="div">
              {t("bookingDetails.replacementDialog.reminderClass", {
                defaultValue: "Class: {{class}}",
                class: vehicle?.class || "—",
              })}
            </Typography>
            <Typography variant="body2" component="div">
              {t("bookingDetails.replacementDialog.reminderTransmission", {
                defaultValue: "Transmission: {{transmission}}",
                transmission: vehicle?.transmission || "—",
              })}
            </Typography>
            <Typography variant="body2" component="div">
              {t("bookingDetails.replacementDialog.reminderPrice", {
                defaultValue: "Total price ceiling: {{price}}",
                price: price.totalText || "—",
              })}
            </Typography>
          </Alert>
          {fleetLoading ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={18} />
              <Typography variant="body2" color="text.secondary">
                {t("bookingDetails.replacementDialog.loadingFleet", {
                  defaultValue: "Loading available cars…",
                })}
              </Typography>
            </Stack>
          ) : null}
          {fleetError ? <Alert severity="warning">{fleetError}</Alert> : null}
          {!fleetLoading && !fleetError ? (
            <FormControl fullWidth size="small">
              <InputLabel id="replacement-fleet-label">
                {t("bookingDetails.replacementDialog.kinds.COMPANY_VEHICLE", {
                  defaultValue: "A vehicle from your fleet",
                })}
              </InputLabel>
              <Select
                labelId="replacement-fleet-label"
                label={t(
                  "bookingDetails.replacementDialog.kinds.COMPANY_VEHICLE",
                  {
                    defaultValue: "A vehicle from your fleet",
                  }
                )}
                value={replacement.proposedCarId || ""}
                displayEmpty
                onChange={(event) => {
                  const carId = String(event.target.value || "");
                  const row = fleetCars.find((c) => c.carId === carId);
                  setReplacement((was) => ({
                    ...was,
                    proposedCarId: carId,
                    proposedCarNumber: row?.carNumber || "",
                    replacementSource: carId
                      ? REPLACEMENT_KIND.COMPANY_VEHICLE
                      : REPLACEMENT_KIND.GUARANTEED_CLASS,
                    guaranteeAck: carId ? false : was.guaranteeAck,
                  }));
                }}
              >
                <MenuItem value="">
                  <em>
                    {t("bookingDetails.replacementDialog.fleetPlaceholder", {
                      defaultValue: "Choose a vehicle",
                    })}
                  </em>
                </MenuItem>
                {fleetCars.map((row) => (
                  <MenuItem
                    key={row.carId}
                    value={row.carId}
                    disabled={!row.offerable}
                  >
                    {[
                      [row.name, row.carNumber, row.category, row.transmission]
                        .filter(Boolean)
                        .join(" · "),
                      row.exclusionMessage,
                    ]
                      .filter(Boolean)
                      .join(" — ")}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : null}
          {!fleetCars.length && !fleetLoading ? (
            <Typography variant="caption" color="text.secondary">
              {t("bookingDetails.replacementDialog.noFleetCars", {
                defaultValue:
                  "No cars were found in your fleet. You can still guarantee class below.",
              })}
            </Typography>
          ) : null}
          <FormControlLabel
            control={
              <Checkbox
                checked={Boolean(replacement.guaranteeAck)}
                disabled={Boolean(replacement.proposedCarId)}
                onChange={(event) =>
                  setReplacement((was) => ({
                    ...was,
                    guaranteeAck: event.target.checked,
                    replacementSource: REPLACEMENT_KIND.GUARANTEED_CLASS,
                    proposedCarId: "",
                    proposedCarNumber: "",
                  }))
                }
              />
            }
            label={t("bookingDetails.replacementDialog.guaranteeAck", {
              defaultValue:
                "I confirm the replacement will be the same or higher class, the same transmission, and the same or a lower total price.",
            })}
            sx={{
              alignItems: "flex-start",
              m: 0,
              "& .MuiFormControlLabel-label": { fontSize: "0.875rem" },
            }}
          />
          <TextField
            label={t("bookingDetails.replacementDialog.comment")}
            value={replacement.supplierMessage}
            onChange={(event) =>
              setReplacement((was) => ({
                ...was,
                supplierMessage: event.target.value,
              }))
            }
            fullWidth
            multiline
            minRows={2}
            helperText={t("bookingDetails.replacementDialog.commentHelp", {
              defaultValue: "Optional note for the customer.",
            })}
          />
        </ContentColumn>
        <StickyFooter>
          <Button onClick={() => setDialog(null)} disabled={busy}>
            {t("bookingDetails.back")}
          </Button>
          <Button
            variant="outlined"
            color="success"
            disabled={busy || !replacementReady}
            onClick={() =>
              run(
                () =>
                  proposeEquivalentReplacement(orderId, {
                    replacementSource: fleetSelected
                      ? REPLACEMENT_KIND.COMPANY_VEHICLE
                      : REPLACEMENT_KIND.GUARANTEED_CLASS,
                    proposedCarId: replacement.proposedCarId,
                    proposedCarNumber: replacement.proposedCarNumber,
                    guaranteeAck: replacement.guaranteeAck,
                    supplierMessage: replacement.supplierMessage,
                  }),
                "bookingDetails.notices.replacementOffered"
              )
            }
          >
            {t("bookingDetails.replacementDialog.submit")}
          </Button>
        </StickyFooter>
      </Dialog>

      <Dialog
        open={dialog === "amend"}
        onClose={() => setDialog(null)}
        fullWidth
      >
        <StickyHeader>
          <Typography variant="h6" component="h3">
            {t("bookingDetails.actions.amend")}
          </Typography>
        </StickyHeader>
        <ContentColumn>
          <Alert severity="warning">
            {isSuperAdmin
              ? t("bookingDetails.amendDialog.notice")
              : "Paid booking amendments are recorded with a before-and-after audit. Dates, rental duration and all financial values must be changed through Contact Rovaro."}
          </Alert>
          {isSuperAdmin ? (
            <>
              <TextField
                select
                label={t("bookingDetails.amendDialog.requestedBy")}
                value={amendment.requestedBy}
                onChange={(event) =>
                  setAmendment((was) => ({
                    ...was,
                    requestedBy: event.target.value,
                  }))
                }
                fullWidth
              >
                {Object.values(AMENDMENT_REQUESTER).map((who) => (
                  <MenuItem key={who} value={who}>
                    {t(`bookingDetails.amendDialog.requesters.${who}`)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label={t("bookingDetails.amendDialog.reason")}
                value={amendment.reason}
                onChange={(event) =>
                  setAmendment((was) => ({
                    ...was,
                    reason: event.target.value,
                  }))
                }
                fullWidth
                multiline
                minRows={3}
                helperText={t("bookingDetails.amendDialog.reasonHelp")}
              />
              <TextField
                label={t("bookingDetails.amendDialog.consentNote")}
                value={amendment.consentNote}
                onChange={(event) =>
                  setAmendment((was) => ({
                    ...was,
                    consentNote: event.target.value,
                    consentRecorded: event.target.value.trim().length > 0,
                  }))
                }
                fullWidth
                helperText={t("bookingDetails.amendDialog.consentHelp")}
              />
            </>
          ) : (
            <Stack spacing={1}>
              <TextField
                label="Customer name"
                value={operationalDraft.customerName || ""}
                onChange={(event) =>
                  setOperationalDraft((draft) => ({
                    ...draft,
                    customerName: event.target.value,
                  }))
                }
                fullWidth
                size="small"
              />
              <TextField
                label="Phone"
                value={operationalDraft.phone || ""}
                onChange={(event) =>
                  setOperationalDraft((draft) => ({
                    ...draft,
                    phone: event.target.value,
                  }))
                }
                fullWidth
                size="small"
              />
              <TextField
                label="Email"
                value={operationalDraft.email || ""}
                onChange={(event) =>
                  setOperationalDraft((draft) => ({
                    ...draft,
                    email: event.target.value,
                  }))
                }
                fullWidth
                size="small"
              />
              <TextField
                select
                label="Vehicle actually supplied"
                value={operationalDraft.actualCarId || ""}
                onChange={(event) =>
                  setOperationalDraft((draft) => ({
                    ...draft,
                    actualCarId: event.target.value,
                  }))
                }
                fullWidth
                size="small"
                disabled={operationalFleetLoading}
              >
                <MenuItem value="">Not recorded</MenuItem>
                {operationalDraft.actualCarId &&
                !operationalVehicles.some(
                  (vehicle) => vehicle.carId === operationalDraft.actualCarId
                ) ? (
                  <MenuItem value={operationalDraft.actualCarId}>
                    Previously recorded vehicle
                  </MenuItem>
                ) : null}
                {operationalVehicles.map((vehicle) => (
                  <MenuItem key={vehicle.carId} value={vehicle.carId}>
                    {vehicle.label || vehicle.carId}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Pickup instructions"
                value={operationalDraft.placeInDetail || ""}
                onChange={(event) =>
                  setOperationalDraft((draft) => ({
                    ...draft,
                    placeInDetail: event.target.value,
                  }))
                }
                fullWidth
                size="small"
              />
              <TextField
                label="Return instructions"
                value={operationalDraft.placeOutDetail || ""}
                onChange={(event) =>
                  setOperationalDraft((draft) => ({
                    ...draft,
                    placeOutDetail: event.target.value,
                  }))
                }
                fullWidth
                size="small"
              />
              <TextField
                label="Flight / hotel information"
                value={operationalDraft.flightNumber || ""}
                onChange={(event) =>
                  setOperationalDraft((draft) => ({
                    ...draft,
                    flightNumber: event.target.value,
                  }))
                }
                fullWidth
                size="small"
              />
              <TextField
                label="Hotel information"
                value={operationalDraft.hotelInformation || ""}
                onChange={(event) =>
                  setOperationalDraft((draft) => ({
                    ...draft,
                    hotelInformation: event.target.value,
                  }))
                }
                fullWidth
                size="small"
              />
              <TextField
                label="Collection / pickup notes"
                value={operationalDraft.pickupNotes || ""}
                onChange={(event) =>
                  setOperationalDraft((draft) => ({
                    ...draft,
                    pickupNotes: event.target.value,
                  }))
                }
                fullWidth
                size="small"
                multiline
                minRows={2}
              />
              <TextField
                label="Return notes"
                value={operationalDraft.returnNotes || ""}
                onChange={(event) =>
                  setOperationalDraft((draft) => ({
                    ...draft,
                    returnNotes: event.target.value,
                  }))
                }
                fullWidth
                size="small"
                multiline
                minRows={2}
              />
              <TextField
                label="Internal operational notes"
                value={operationalDraft.operationalNotes || ""}
                onChange={(event) =>
                  setOperationalDraft((draft) => ({
                    ...draft,
                    operationalNotes: event.target.value,
                  }))
                }
                fullWidth
                size="small"
                multiline
                minRows={2}
              />
              <TextField
                label="Insurance correction (does not change saved price)"
                value={operationalDraft.insurance || ""}
                onChange={(event) =>
                  setOperationalDraft((draft) => ({
                    ...draft,
                    insurance: event.target.value,
                  }))
                }
                fullWidth
                size="small"
              />
              <TextField
                label="Child seats"
                type="number"
                inputProps={{ min: 0, max: 5 }}
                value={operationalDraft.ChildSeats ?? 0}
                onChange={(event) =>
                  setOperationalDraft((draft) => ({
                    ...draft,
                    ChildSeats: event.target.value,
                  }))
                }
                fullWidth
                size="small"
              />
              <TextField
                select
                label="Driving document verification"
                value={
                  operationalDraft.drivingLicenceVerificationStatus || "PENDING"
                }
                onChange={(event) =>
                  setOperationalDraft((draft) => ({
                    ...draft,
                    drivingLicenceVerificationStatus: event.target.value,
                  }))
                }
                fullWidth
                size="small"
              >
                {["PENDING", "VERIFIED", "REJECTED"].map((status) => (
                  <MenuItem key={status} value={status}>
                    {status}
                  </MenuItem>
                ))}
              </TextField>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={Boolean(operationalDraft.secondDriver)}
                    onChange={(event) =>
                      setOperationalDraft((draft) => ({
                        ...draft,
                        secondDriver: event.target.checked,
                      }))
                    }
                  />
                }
                label="Second driver"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={customerAgreementChecked}
                    onChange={(event) =>
                      setCustomerAgreementChecked(event.target.checked)
                    }
                  />
                }
                label="I confirm that these changes have been agreed with the customer."
                sx={{ alignItems: "flex-start", m: 0 }}
              />
              <TextField
                label="Evidence / internal note (optional)"
                value={operationalAmendmentNote}
                onChange={(event) =>
                  setOperationalAmendmentNote(event.target.value)
                }
                fullWidth
                size="small"
                multiline
                minRows={2}
              />
            </Stack>
          )}
        </ContentColumn>
        <StickyFooter>
          <Button onClick={() => setDialog(null)} disabled={busy}>
            {t("bookingDetails.back")}
          </Button>
          <Button
            variant="outlined"
            disabled={
              busy ||
              (isSuperAdmin
                ? amendment.reason.trim().length < AMENDMENT_REASON_MIN
                : !customerAgreementChecked)
            }
            onClick={() =>
              run(
                () =>
                  isSuperAdmin
                    ? amendPlatformBooking(orderId, {
                        changes: {},
                        reason: amendment.reason.trim(),
                        requestedBy: amendment.requestedBy,
                        consent: {
                          recorded: amendment.consentRecorded,
                          note: amendment.consentNote.trim(),
                        },
                      })
                    : amendPaidPlatformBooking(orderId, {
                        changes: operationalDraft,
                        consentRecorded: customerAgreementChecked,
                        consentNote: operationalAmendmentNote.trim(),
                      }),
                "bookingDetails.notices.amended"
              )
            }
          >
            {t("bookingDetails.amendDialog.submit")}
          </Button>
        </StickyFooter>
      </Dialog>

      <Dialog
        open={dialog === "decline"}
        onClose={() => setDialog(null)}
        fullWidth
      >
        <StickyHeader>
          <Typography variant="h6" component="h3">
            {t("bookingDetails.declineDialog.title")}
          </Typography>
        </StickyHeader>
        <ContentColumn>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Typography variant="body2">
            {t("bookingDetails.declineDialog.intro")}
          </Typography>
          <TextField
            label={t("bookingDetails.declineDialog.reason")}
            value={declineReason}
            onChange={(event) => {
              setDeclineReason(event.target.value);
              if (error) setError("");
            }}
            error={Boolean(error)}
            fullWidth
            multiline
            minRows={3}
          />
        </ContentColumn>
        <StickyFooter>
          <Button onClick={() => setDialog(null)} disabled={busy}>
            {t("bookingDetails.back")}
          </Button>
          <Button
            variant="outlined"
            color="error"
            disabled={busy || !declineReason.trim()}
            onClick={() =>
              run(
                () => declineBookingRequest(orderId, declineReason.trim()),
                "bookingDetails.notices.declined"
              )
            }
          >
            {t("bookingDetails.actions.decline")}
          </Button>
        </StickyFooter>
      </Dialog>

      <Dialog
        open={dialog === "contactRovaro" || dialog === "reportProblem"}
        onClose={() => setDialog(null)}
        fullWidth
      >
        <StickyHeader>
          <Typography variant="h6" component="h3">
            {t(
              dialog === "reportProblem"
                ? "bookingDetails.actions.reportProblem"
                : "bookingDetails.actions.contactRovaro"
            )}
          </Typography>
        </StickyHeader>
        <ContentColumn>
          <SummaryField
            label={t("bookingDetails.contactDialog.reference")}
            value={view.reference}
          />
          {dialog === "reportProblem" ? (
            <TextField
              select
              label={t("bookingDetails.contactDialog.issueType", {
                defaultValue: "Issue type",
              })}
              value={reportedIssueType}
              onChange={(event) => setReportedIssueType(event.target.value)}
              fullWidth
            >
              {["DAMAGE", "PAYMENT", "LATE_RETURN", "OTHER"].map((type) => (
                <MenuItem key={type} value={type}>
                  {t(`bookingDetails.contactDialog.issueTypes.${type}`, {
                    defaultValue: type.replaceAll("_", " "),
                  })}
                </MenuItem>
              ))}
            </TextField>
          ) : null}
          {dialog !== "reportProblem" ? (
            <TextField
              select
              label={t("bookingDetails.contactDialog.category")}
              value={supportCategory}
              onChange={(event) => setSupportCategory(event.target.value)}
              fullWidth
            >
              {SUPPORT_CATEGORIES.map((category) => (
                <MenuItem key={category} value={category}>
                  {t(`bookingDetails.contactDialog.categories.${category}`)}
                </MenuItem>
              ))}
            </TextField>
          ) : null}
          <TextField
            label={t("bookingDetails.contactDialog.message")}
            value={supportMessage}
            onChange={(event) => setSupportMessage(event.target.value)}
            fullWidth
            multiline
            minRows={3}
          />
          {dialog === "reportProblem" ? (
            <Alert severity="info">
              {t("bookingDetails.contactDialog.problemNotice")}
            </Alert>
          ) : null}
        </ContentColumn>
        <StickyFooter>
          <Button onClick={() => setDialog(null)} disabled={busy}>
            {t("bookingDetails.back")}
          </Button>
          <Button
            variant="outlined"
            disabled={busy || !supportMessage.trim()}
            onClick={async () => {
              const message = supportMessage.trim();
              const sent = await run(
                () =>
                  dialog === "reportProblem"
                    ? reportBookingProblem(orderId, {
                        type: reportedIssueType,
                        message,
                      })
                    : contactRovaroAboutBooking(orderId, {
                        category: supportCategory,
                        message,
                      }),
                "bookingDetails.notices.messageSent"
              );
              if (sent) setSupportMessage("");
            }}
          >
            {t("bookingDetails.contactDialog.send")}
          </Button>
        </StickyFooter>
      </Dialog>
    </Dialog>
  );
}
