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
  FormControlLabel,
  IconButton,
  MenuItem,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { styled, useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import { useSession } from "next-auth/react";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import { CollapsibleSection, SummaryField, SummaryList } from "@/app/components/ui";
import CopyableContact from "@/app/admin/features/orders/components/CopyableContact";
import BookingDetailsActivity from "@/app/admin/features/orders/components/BookingDetailsActivity";
import { buildBookingDetailsView } from "@/domain/booking/bookingDetailsView";
import { isPlatformBooking } from "@/domain/admin/rovaroContractorAdmin";
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
  confirmRequestedVehicle,
  contactRovaroAboutBooking,
  declineBookingRequest,
  loadAdminOrder,
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
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: theme.spacing(1.5),
  padding: theme.spacing(1.5, 2),
  backgroundColor: theme.palette.background.paper,
  borderBottom: `1px solid ${theme.palette.divider}`,
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
  padding: theme.spacing(0.75, 1),
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
}));

const GridFullWidth = styled(Box)({
  gridColumn: "1 / -1",
});

/**
 * Specs share one dense two-column list. Nested SummaryField rows stay stacked
 * (label above value) so class/transmission values are not crushed.
 */
const VehicleSpecGrid = styled(SummaryList)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  columnGap: theme.spacing(1),
  rowGap: 0,
  "& > *": {
    gridTemplateColumns: "1fr !important",
    gap: theme.spacing(0.05),
    alignItems: "start",
    maxWidth: "none",
  },
}));

const PriceLayout = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: theme.spacing(1),
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  fontWeight: theme.typography.fontWeightBold,
  color: theme.palette.text.primary,
  fontSize: "0.8rem",
  marginBottom: theme.spacing(0.25),
}));

const ReferenceText = styled(Typography)(({ theme }) => ({
  fontWeight: theme.typography.fontWeightBold,
  lineHeight: theme.typography.h6.lineHeight,
}));

/** Title, company and metadata stacked tight; nothing else competes for room. */
const HeaderIdentity = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(0.25),
  minWidth: 0,
}));

const HeaderMeta = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  overflowWrap: "anywhere",
}));

const HeaderAside = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  gap: theme.spacing(1),
  flexShrink: 0,
}));

const BadgeRow = styled(Box)(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "flex-end",
  gap: theme.spacing(0.5),
  minWidth: 0,
}));

const TONE_PALETTE = {
  status: "info",
  platform: "primary",
  internal: "secondary",
  pending: "warning",
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
  gap: theme.spacing(0.5),
  padding: theme.spacing(2),
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.primary.main}`,
  backgroundColor: theme.palette.action.hover,
}));

const SupplierPayoutAmount = styled(Typography)(({ theme }) => ({
  color: theme.palette.primary.main,
  fontWeight: theme.typography.fontWeightBold,
  lineHeight: theme.typography.h4.lineHeight,
}));

const TotalRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: theme.spacing(2),
  marginTop: theme.spacing(1),
  paddingTop: theme.spacing(1),
  borderTop: `1px solid ${theme.palette.divider}`,
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
    (value) => (value ? dayjs.utc(value).tz(zone).format("DD.MM.YYYY HH:mm") : ""),
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
export default function BookingDetailsModal({ order, open, onClose, onChanged }) {
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
  const [supportMessage, setSupportMessage] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [licenceUrls, setLicenceUrls] = useState([]);
  const [priceOpen, setPriceOpen] = useState(true);
  const [replacement, setReplacement] = useState(EMPTY_REPLACEMENT);
  const [amendment, setAmendment] = useState(EMPTY_AMENDMENT);

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
    return undefined;
  }, [dialog]);

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
  const replacementReady = replacement.guaranteeAck === true;
  const priceBreakdown = (
    <SummaryList component="dl">
      {price.lines.map((line) => (
        <SummaryField
          key={line.key}
          label={t(line.labelKey, { defaultValue: line.label })}
          value={line.free ? t("bookingDetails.price.free") : line.text}
        />
      ))}
      {price.paidToRovaroText ? (
        <SummaryField
          label={t("bookingDetails.price.paidToRovaro", {
            rate: price.feePercentLabel,
          })}
          value={price.paidToRovaroText}
        />
      ) : null}
    </SummaryList>
  );

  // The total stays outside the collapsible so it is visible on a phone even
  // when the breakdown is folded away.
  const vehicle = view.vehicle;
  const showVehiclePanel = Boolean(vehicle);
  // Fleet code and plate identify a specific physical car and belong to the
  // company that runs it, not to anyone else who can open the booking.
  const showFleetIdentity = view.showFleetIdentity === true;

  const priceTotal = price.totalText ? (
    <TotalRow data-testid="total-rental-price">
      <Typography variant="body1">
        {t("bookingDetails.price.totalRentalPrice")}
      </Typography>
      <TotalAmount variant="body1">{price.totalText}</TotalAmount>
    </TotalRow>
  ) : null;

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
        <HeaderIdentity>
          <ReferenceText variant="h6" component="h2" id="booking-details-title">
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
          <IconButton
            onClick={onClose}
            size="small"
            aria-label={t("bookingDetails.close")}
          >
            <CloseIcon />
          </IconButton>
        </HeaderAside>
      </StickyHeader>

      <ContentColumn dividers={false}>
        {view.showPrivacyNotice ? (
          <Alert severity="info" data-testid="privacy-notice">
            {t("bookingDetails.privacyNotice")}
          </Alert>
        ) : null}
        {price.dataWarning ? (
          <Alert severity="warning" data-testid="price-data-warning">
            {t("bookingDetails.price.dataWarning")}
          </Alert>
        ) : null}
        {error && !dialog ? <Alert severity="error">{error}</Alert> : null}
        {notice ? <Alert severity="success">{notice}</Alert> : null}

        <SectionsGrid>
          {showVehiclePanel ? (
            <SectionPanel data-testid="vehicle-snapshot">
              <SectionTitle variant="subtitle2">
                {t(
                  view.replacement
                    ? "bookingDetails.replacement.originallyRequested"
                    : "bookingDetails.sections.vehicle"
                )}
              </SectionTitle>
              {view.vehicleIsLegacy ? (
                <Alert severity="warning" data-testid="vehicle-legacy-notice">
                  {t("bookingDetails.vehicle.legacyNotice")}
                </Alert>
              ) : null}
              <SummaryField
                label={t("bookingDetails.vehicle.requested")}
                value={vehicle.displayName}
                strong
              />
              <VehicleSpecGrid component="dl">
                <SummaryField
                  label={t("bookingDetails.vehicle.class")}
                  value={vehicle.class}
                />
                <SummaryField
                  label={t("bookingDetails.vehicle.transmission")}
                  value={vehicle.transmission}
                />
                <SummaryField
                  label={t("bookingDetails.vehicle.fuel")}
                  value={vehicle.fuelType}
                />
                <SummaryField
                  label={t("bookingDetails.vehicle.seats")}
                  value={vehicle.seats}
                />
                <SummaryField
                  label={t("bookingDetails.vehicle.doors")}
                  value={vehicle.doors}
                />
                <SummaryField
                  label={t("bookingDetails.vehicle.luggage")}
                  value={vehicle.luggage}
                />
                {/* Absence is not the same as "no air conditioning", so
                    the row appears only when the answer was recorded. */}
                {typeof vehicle.airConditioning === "boolean" ? (
                  <SummaryField
                    label={t("bookingDetails.vehicle.airConditioning")}
                    value={t(
                      vehicle.airConditioning
                        ? "bookingDetails.options.yes"
                        : "bookingDetails.options.no"
                    )}
                  />
                ) : null}
                <SummaryField
                  label={t("bookingDetails.vehicle.modelYear")}
                  value={vehicle.modelYear}
                />
                <SummaryField
                  label={t("bookingDetails.vehicle.includedMileage")}
                  value={vehicle.includedMileage ?? vehicle.mileagePolicy}
                />
                <SummaryField
                  label={t("bookingDetails.vehicle.deposit")}
                  value={vehicle.deposit}
                />
                {showFleetIdentity ? (
                  <>
                    <SummaryField
                      label={t("bookingDetails.vehicle.fleetCode")}
                      value={vehicle.fleetCode}
                    />
                    <SummaryField
                      label={t("bookingDetails.vehicle.registration")}
                      value={vehicle.registrationNumber}
                    />
                  </>
                ) : null}
              </VehicleSpecGrid>
            </SectionPanel>
          ) : null}

          <SectionPanel>
            <SectionTitle variant="subtitle2">
              {t("bookingDetails.sections.dates")}
            </SectionTitle>
            <SummaryList component="dl">
              <SummaryField
                label={t("bookingDetails.dates.pickup")}
                value={formatMoment(current.pickupAtUtc || current.timeIn)}
              />
              <SummaryField
                label={t("bookingDetails.dates.return")}
                value={formatMoment(current.returnAtUtc || current.timeOut)}
              />
              <SummaryField
                label={t("bookingDetails.dates.days")}
                value={current.numberOfDays}
              />
              <SummaryField
                label={t("bookingDetails.dates.pickupLocation")}
                value={[current.placeIn, current.placeInDetail]
                  .filter(Boolean)
                  .join(" — ")}
              />
              <SummaryField
                label={t("bookingDetails.dates.returnLocation")}
                value={[current.placeOut, current.placeOutDetail]
                  .filter(Boolean)
                  .join(" — ")}
              />
            </SummaryList>
          </SectionPanel>

          {view.replacement ? (
            <GridFullWidth>
              <SectionPanel data-testid="replacement-proposal">
                <SectionTitle variant="subtitle2">
                  {t("bookingDetails.replacement.confirmedAs")}
                </SectionTitle>
                <SummaryList component="dl">
                  <SummaryField
                    label={t("bookingDetails.vehicle.requested")}
                    value={view.replacement.model}
                    strong
                  />
                  <SummaryField
                    label={t("bookingDetails.vehicle.class")}
                    value={view.replacement.category}
                  />
                  <SummaryField
                    label={t("bookingDetails.vehicle.transmission")}
                    value={view.replacement.transmission}
                  />
                  <SummaryField
                    label={t("bookingDetails.vehicle.seats")}
                    value={view.replacement.seats}
                  />
                  <SummaryField
                    label={t("bookingDetails.replacement.supplierComment")}
                    value={view.replacement.supplierMessage}
                  />
                </SummaryList>
              </SectionPanel>
            </GridFullWidth>
          ) : null}

          <SectionPanel>
            <SectionTitle variant="subtitle2">
              {t("bookingDetails.sections.options")}
            </SectionTitle>
            <SummaryList component="dl">
              <SummaryField
                label={t("bookingDetails.options.insurance")}
                value={current.insurance}
              />
              <SummaryField
                label={t("bookingDetails.options.excess")}
                value={current.franchiseOrder}
              />
              <SummaryField
                label={t("bookingDetails.options.childSeats")}
                value={current.ChildSeats}
              />
              <SummaryField
                label={t("bookingDetails.options.secondDriver")}
                value={t(
                  current.secondDriver
                    ? "bookingDetails.options.yes"
                    : "bookingDetails.options.no"
                )}
              />
            </SummaryList>
          </SectionPanel>

          {view.customer ? (
            <SectionPanel>
              <SectionTitle variant="subtitle2">
                {t("bookingDetails.sections.customer")}
              </SectionTitle>
              {view.platformSupportView ? (
                <Alert severity="info">
                  {t("bookingDetails.platformSupportNotice")}
                </Alert>
              ) : null}
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
          ) : null}

          <GridFullWidth>
            <SectionPanel>
              {isSheet ? (
                <CollapsibleSection
                  title={t("bookingDetails.sections.price")}
                  open={priceOpen}
                  onToggle={() => setPriceOpen((was) => !was)}
                  toggleLabel={t("bookingDetails.sections.price")}
                  contentId="booking-details-price"
                >
                  {priceBreakdown}
                </CollapsibleSection>
              ) : (
                <PriceLayout>
                  <Box>
                    <SectionTitle variant="subtitle2">
                      {t("bookingDetails.sections.price")}
                    </SectionTitle>
                    {priceBreakdown}
                    {priceTotal}
                  </Box>
                  {price.payableToSupplierText ? (
                    <SupplierPayout data-testid="payable-to-supplier">
                      <Typography variant="subtitle2" color="text.secondary">
                        {t("bookingDetails.price.payableToSupplier")}
                      </Typography>
                      <SupplierPayoutAmount variant="h4" component="p">
                        {price.payableToSupplierText}
                      </SupplierPayoutAmount>
                      <Typography variant="body2" color="text.secondary">
                        {t("bookingDetails.price.payableToSupplierHint")}
                      </Typography>
                    </SupplierPayout>
                  ) : null}
                </PriceLayout>
              )}
              {isSheet ? (
                <>
                  {priceTotal}
                  {price.payableToSupplierText ? (
                    <SupplierPayout data-testid="payable-to-supplier">
                      <Typography variant="subtitle2" color="text.secondary">
                        {t("bookingDetails.price.payableToSupplier")}
                      </Typography>
                      <SupplierPayoutAmount variant="h4" component="p">
                        {price.payableToSupplierText}
                      </SupplierPayoutAmount>
                      <Typography variant="body2" color="text.secondary">
                        {t("bookingDetails.price.payableToSupplierHint")}
                      </Typography>
                    </SupplierPayout>
                  ) : null}
                </>
              ) : null}
            </SectionPanel>
          </GridFullWidth>

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
                          defaultValue: "No driving licence was uploaded for this booking.",
                        })}
                  </Typography>
                ) : null}
              </SectionPanel>
            </GridFullWidth>
          ) : null}

          {isSuperAdmin && orderId ? (
            <GridFullWidth>
              <SectionPanel data-testid="booking-activity">
                <SectionTitle variant="subtitle2">
                  {t("bookingDetails.sections.activity")}
                </SectionTitle>
                <BookingDetailsActivity orderId={orderId} />
              </SectionPanel>
            </GridFullWidth>
          ) : null}
        </SectionsGrid>
      </ContentColumn>

      <StickyFooter>
        {busy ? <CircularProgress size={theme.typography.h6.fontSize} /> : null}
        {view.actions.map((action) => (
          <Button
            key={action.id}
            variant={action.primary ? "contained" : "text"}
            color={action.id === "decline" ? "error" : "primary"}
            data-testid={`booking-action-${action.id}`}
            disabled={busy}
            onClick={() => {
              setError("");
              setNotice("");
              setDialog(action.id);
            }}
          >
            {t(action.labelKey, { defaultValue: action.label })}
          </Button>
        ))}
        <Button onClick={onClose} disabled={busy}>
          {t("bookingDetails.close")}
        </Button>
      </StickyFooter>

      <Dialog open={dialog === "confirm"} onClose={() => setDialog(null)} fullWidth>
        <StickyHeader>
          <Typography variant="h6" component="h3">
            {t("bookingDetails.confirmDialog.title")}
          </Typography>
        </StickyHeader>
        <ContentColumn>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Alert severity="warning">
            {t("bookingDetails.confirmDialog.obligation", {
              defaultValue:
                "You are committing to provide this car for the dates, locations, and price shown. If something happens and you cannot, you must promptly offer an equivalent replacement or decline — do not leave the customer without a vehicle.",
            })}
          </Alert>
          <Typography variant="body2">
            {t("bookingDetails.confirmDialog.intro")}
          </Typography>
          <SummaryList component="dl">
            <SummaryField
              label={t("bookingDetails.vehicle.requested")}
              value={current.carModel || current.car?.model}
              strong
            />
            <SummaryField
              label={t("bookingDetails.vehicle.transmission")}
              value={current.car?.transmission}
            />
            <SummaryField
              label={t("bookingDetails.dates.pickup")}
              value={formatMoment(current.pickupAtUtc || current.timeIn)}
            />
            <SummaryField
              label={t("bookingDetails.dates.return")}
              value={formatMoment(current.returnAtUtc || current.timeOut)}
            />
            <SummaryField
              label={t("bookingDetails.price.totalRentalPrice")}
              value={price.totalText}
            />
            <SummaryField
              label={t("bookingDetails.price.payableToSupplier")}
              value={price.payableToSupplierText}
              strong
            />
          </SummaryList>
        </ContentColumn>
        <StickyFooter>
          <Button onClick={() => setDialog(null)} disabled={busy}>
            {t("bookingDetails.back")}
          </Button>
          <Button
            variant="contained"
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

      <Dialog open={dialog === "replace"} onClose={() => setDialog(null)} fullWidth>
        <StickyHeader>
          <Typography variant="h6" component="h3">
            {t("bookingDetails.actions.replace")}
          </Typography>
        </StickyHeader>
        <ContentColumn>
          <Typography variant="body2">
            {t("bookingDetails.replacementDialog.intro")}
          </Typography>
          <Alert severity="info" sx={{ "& .MuiAlert-message": { width: "100%" } }}>
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
          <FormControlLabel
            control={
              <Checkbox
                checked={Boolean(replacement.guaranteeAck)}
                onChange={(event) =>
                  setReplacement((was) => ({
                    ...was,
                    guaranteeAck: event.target.checked,
                    replacementSource: REPLACEMENT_KIND.GUARANTEED_CLASS,
                  }))
                }
              />
            }
            label={t("bookingDetails.replacementDialog.guaranteeAck", {
              defaultValue:
                "I confirm the replacement will be the same or higher class, the same transmission, and the same or a lower total price.",
            })}
            sx={{ alignItems: "flex-start", m: 0, "& .MuiFormControlLabel-label": { fontSize: "0.875rem" } }}
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
            variant="contained"
            disabled={busy || !replacementReady}
            onClick={() =>
              run(
                () =>
                  proposeEquivalentReplacement(orderId, {
                    replacementSource: REPLACEMENT_KIND.GUARANTEED_CLASS,
                    guaranteeAck: true,
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

      <Dialog open={dialog === "amend"} onClose={() => setDialog(null)} fullWidth>
        <StickyHeader>
          <Typography variant="h6" component="h3">
            {t("bookingDetails.actions.amend")}
          </Typography>
        </StickyHeader>
        <ContentColumn>
          <Alert severity="warning">
            {t("bookingDetails.amendDialog.notice")}
          </Alert>
          <TextField
            select
            label={t("bookingDetails.amendDialog.requestedBy")}
            value={amendment.requestedBy}
            onChange={(event) =>
              setAmendment((was) => ({ ...was, requestedBy: event.target.value }))
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
              setAmendment((was) => ({ ...was, reason: event.target.value }))
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
        </ContentColumn>
        <StickyFooter>
          <Button onClick={() => setDialog(null)} disabled={busy}>
            {t("bookingDetails.back")}
          </Button>
          <Button
            variant="contained"
            disabled={busy || amendment.reason.trim().length < AMENDMENT_REASON_MIN}
            onClick={() =>
              run(
                () =>
                  amendPlatformBooking(orderId, {
                    changes: {},
                    reason: amendment.reason.trim(),
                    requestedBy: amendment.requestedBy,
                    consent: {
                      recorded: amendment.consentRecorded,
                      note: amendment.consentNote.trim(),
                    },
                  }),
                "bookingDetails.notices.amended"
              )
            }
          >
            {t("bookingDetails.amendDialog.submit")}
          </Button>
        </StickyFooter>
      </Dialog>

      <Dialog open={dialog === "decline"} onClose={() => setDialog(null)} fullWidth>
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
            variant="contained"
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
            variant="contained"
            disabled={busy || !supportMessage.trim()}
            onClick={async () => {
              const message = supportMessage.trim();
              const sent = await run(
                () =>
                  dialog === "reportProblem"
                    ? reportBookingProblem(orderId, { message })
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
