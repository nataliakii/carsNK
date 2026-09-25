"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { styled } from "@mui/material/styles";
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Autocomplete,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Chip,
  Stack,
  Typography,
  IconButton,
  Tooltip,
  InputAdornment,
  CircularProgress,
  alpha,
  Switch,
  FormControlLabel,
  Popover,
  Modal,
  Grid,
} from "@mui/material";
import {
  Search as SearchIcon,
  FilterAlt as FilterIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Clear as ClearIcon,
  Block as BlockIcon,
  Lock as LockIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Autorenew as AutorenewIcon,
  FileDownload as FileDownloadIcon,
  History as HistoryIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import { useMainContext } from "@app/Context";
import { getOrderColor } from "@/domain/orders/getOrderColor";
import {
  ROLE,
  isClientOrder,
} from "@/domain/orders";
import { getOrderAccess } from "@/domain/orders/orderAccessPolicy";
import { getOrderNumberOfDaysOrZero } from "@/domain/orders/numberOfDays";
import { getTimeBucket } from "@/domain/time/athensTime";
import { updateOrderInline, updateOrderConfirmation, calculateTotalPrice, updateOrderSupplierResponse } from "@/utils/action";
import { useSession } from "next-auth/react";
import { palette } from "@/theme";
import { useSnackbar } from "notistack";
import InlineEditCell from "@/app/components/orderFields/InlineEditCell";
import { downloadOrdersTableXlsx } from "@/app/admin/features/orders/utils/exportOrdersTableXlsx";
import {
  getEffectivePrice,
  getStoredAutoPrice,
  resolveOrderOwnerId,
  summarizeFilteredOrders,
} from "@/domain/orders/ordersTableStats";
import {
  contractorOrderMoneyRow,
  contractorTableStatusLabelKey,
  isInternalBooking,
  isPlatformBooking,
  matchesBookingSourceFilter,
  buildContractorOrdersExport,
  PLATFORM_WORKFLOW_STAGE,
  resolvePlatformWorkflowStage,
} from "@/domain/admin/rovaroContractorAdmin";
import { extractArraysOfStartEndConfPending } from "@/domain/calendar";
import EditOrderModal from "@/app/admin/features/orders/modals/EditOrderModal";
import BookingDetailsModal from "@/app/admin/features/orders/modals/BookingDetailsModal";
import { loadAdminOrder } from "@/app/admin/features/orders/actions/loadAdminOrder";
import {
  mergeOrderRow,
  searchWithOrderId,
  searchWithoutOrderId,
} from "@/domain/admin/ordersModalQuery";
import OrderUnsavedCloseDialog from "@/app/admin/features/orders/components/OrderUnsavedCloseDialog";
import { isPast } from "@utils/businessTime";
import { useAdminCountryFilter } from "@app/hooks/useAdminCountryFilter";
import { isPlatformAdminUser, policyRoleFromUser } from "@/domain/admin/adminViewMode";
import SupplierResponseCell from "@/app/admin/features/orders/components/SupplierResponseCell";
import { orderRequiresCompanyAction } from "@/domain/orders/companyRentalActions";
import OrdersFinancialSummary from "@/app/admin/features/orders/components/OrdersFinancialSummary";

function browserSearchString() {
  if (typeof window === "undefined") return "";
  const search = window.location.search || "";
  return search.startsWith("?") ? search.slice(1) : search;
}
import {
  recordRemainingAmountPaid,
  reportPlatformBookingProblem,
} from "@/app/admin/features/orders/actions/bookingCompletionActions";

// Dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

const ATHENS_TZ = "Europe/Athens";

/** Возврат уже в прошлом (по timeOut или концу дня rentalEndDate). */
function isOrderEndedInPast(order) {
  if (!order) return false;
  const now = dayjs().tz(ATHENS_TZ);
  const end = order.timeOut
    ? dayjs(order.timeOut).tz(ATHENS_TZ)
    : dayjs(order.rentalEndDate).tz(ATHENS_TZ).endOf("day");
  return end.isBefore(now);
}

/**
 * OrdersTableSection - Admin orders table with inline editing
 * 
 * Features:
 * - Filter by car (autocomplete)
 * - Filter by date range (pickup/return overlap)
 * - Filter by status (confirmed/pending)
 * - Filter by origin (my_order: client/admin)
 * - Text search (customerName, phone, email, orderNumber, car model/regNumber)
 * - Pagination (10/25/50 per page)
 * - Visual indicator using getOrderColor
 * - Inline editing with RBAC (only one row editable at a time)
 * - Confirmed column with Switch toggle
 * - Field-level permission checks
 *
 * Orders data: MainContext.allOrders (same as BigCalendar — getAllOrders + visibility;
 * refresh uses fetchAndUpdateOrders → /api/order/refetch).
 */
export default function OrdersTableSection() {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const {
    cars,
    allOrders,
    setAllOrders,
    fetchAndUpdateOrders,
    isLoading: ordersLoading,
    pendingConfirmBlockById,
    setConflictHighlightsFromResult,
    clearConflictHighlights,
    conflictHighlightById,
  } = useMainContext();
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routerQuery = searchParams?.toString() || "";
  // useSearchParams can stay empty inside the dynamically loaded orders table.
  // The address bar is the source for orderId; router.replace keeps Next in sync.
  const [locationSearch, setLocationSearch] = useState(browserSearchString);
  const queryString = locationSearch || routerQuery;
  const orderIdQuery = new URLSearchParams(queryString).get("orderId") || "";
  const deepLinkGeneration = useRef(0);
  const allOrdersRef = useRef(allOrders);
  allOrdersRef.current = allOrders;
  const isPlatformAdmin = isPlatformAdminUser(session?.user);
  const showSuperAdminFilters = isPlatformAdmin;
  const { country: adminCountry } = useAdminCountryFilter();
  
  // ─────────────────────────────────────────────────────────────
  // DATA: same pipeline as calendar (MainContext.allOrders + fetchAndUpdateOrders → /api/order/refetch → getAllOrders)
  // ─────────────────────────────────────────────────────────────
  const orders = allOrders;
  /** Full-table skeleton only when loading and no orders yet (refresh keeps table visible). */
  const showTableSkeleton = ordersLoading && (!orders || orders.length === 0);
  
  // ─────────────────────────────────────────────────────────────
  // INLINE EDITING STATE (per-field, not per-row)
  // ─────────────────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState({}); // Track saving per field: { orderId_field: true }
  const [isTogglingConfirm, setIsTogglingConfirm] = useState({});
  const [isTogglingSupplier, setIsTogglingSupplier] = useState({});
  /** Live auto-price preview only — never writes to DB. { [orderId]: { loading, live, error } } */
  const [autoPricePreviewById, setAutoPricePreviewById] = useState({});
  /** Price history popover: { orderId, anchorEl, loading, items, error } */
  const [priceHistoryUi, setPriceHistoryUi] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  /** Status + source + car + pickup + return + customer + price + fee + due + supplier + customer confirmation (+ company). */
  const tableColCount = isPlatformAdmin ? 11 : 9;

  // ─────────────────────────────────────────────────────────────
  // CONFLICT STATE (persistent, per-order)
  // ─────────────────────────────────────────────────────────────
  // ⚠️ RBAC SOURCE OF TRUTH: session.user.role is the ONLY source for UI permissions
  // adminRole from API is NOT used for permissions (only for debugging if needed)
  const [conflictsByOrderId, setConflictsByOrderId] = useState({}); // { orderId: { message, conflicts: [] } }

  // ─────────────────────────────────────────────────────────────
  // EDIT ORDER MODAL (same as calendar)
  // ─────────────────────────────────────────────────────────────
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedOrderForEdit, setSelectedOrderForEdit] = useState(null);
  const [isConflictOrder, setIsConflictOrder] = useState(false);
  const editCloseGuardsRef = useRef(new Map());
  const [unsavedEditDialogOpen, setUnsavedEditDialogOpen] = useState(false);
  const [unsavedEditSaving, setUnsavedEditSaving] = useState(false);
  const [startEndDates, setStartEndDates] = useState([]);

  const registerEditOrderCloseGuard = useCallback((orderId, guard) => {
    const id = String(orderId);
    editCloseGuardsRef.current.set(id, guard);
    return () => {
      editCloseGuardsRef.current.delete(id);
    };
  }, []);

  const replaceOrdersQuery = useCallback(
    (nextSearch) => {
      const qs = String(nextSearch || "");
      setLocationSearch(qs);
      router.replace(qs ? `${pathname}?${qs}` : pathname || "/admin/orders", {
        scroll: false,
      });
    },
    [pathname, router]
  );

  useEffect(() => {
    const syncFromBrowser = () => {
      const next = browserSearchString();
      setLocationSearch((prev) => (prev === next ? prev : next));
    };
    syncFromBrowser();
    window.addEventListener("popstate", syncFromBrowser);
    return () => window.removeEventListener("popstate", syncFromBrowser);
  }, [pathname]);

  const performEditModalClose = useCallback(() => {
    setEditModalOpen(false);
    setSelectedOrderForEdit(null);
    replaceOrdersQuery(searchWithoutOrderId(queryString));
  }, [queryString, replaceOrdersQuery]);

  const tryCloseEditModal = useCallback(() => {
    const guards = [...editCloseGuardsRef.current.values()];
    const dirty = guards.some((g) => g.isDirty());
    if (!dirty) {
      performEditModalClose();
      return;
    }
    setUnsavedEditDialogOpen(true);
  }, [performEditModalClose]);

  const handleEditModalBackdropClose = useCallback(
    (_event, reason) => {
      if (reason === "backdropClick" || reason === "escapeKeyDown") {
        tryCloseEditModal();
      }
    },
    [tryCloseEditModal]
  );

  const handleUnsavedEditDiscard = useCallback(() => {
    setUnsavedEditDialogOpen(false);
    performEditModalClose();
  }, [performEditModalClose]);

  const handleUnsavedEditCancel = useCallback(() => {
    setUnsavedEditDialogOpen(false);
  }, []);

  const handleUnsavedEditSave = useCallback(async () => {
    const guards = [...editCloseGuardsRef.current.values()];
    const dirtyGuards = guards.filter((g) => g.isDirty());
    setUnsavedEditSaving(true);
    try {
      let allSaved = true;
      for (const g of dirtyGuards) {
        const guardSaved = await g.save();
        if (!guardSaved) {
          allSaved = false;
          break;
        }
      }
      if (!allSaved) {
        setUnsavedEditDialogOpen(false);
        return;
      }
      setUnsavedEditDialogOpen(false);
      performEditModalClose();
    } catch (err) {
      setUnsavedEditDialogOpen(false);
      enqueueSnackbar(err?.message || t("order.unsavedSaveBlocked"), {
        variant: "error",
      });
    } finally {
      setUnsavedEditSaving(false);
    }
  }, [performEditModalClose, enqueueSnackbar, t]);

  useEffect(() => {
    if (!editModalOpen) {
      setUnsavedEditDialogOpen(false);
      setUnsavedEditSaving(false);
    }
  }, [editModalOpen]);

  useEffect(() => {
    if (!allOrders) return;
    const { startEnd } = extractArraysOfStartEndConfPending(allOrders);
    setStartEndDates(startEnd);
  }, [allOrders]);

  const handleSaveOrderFromModal = useCallback(
    async (updatedOrder) => {
      setSelectedOrderForEdit(updatedOrder);
      await fetchAndUpdateOrders();
    },
    [fetchAndUpdateOrders]
  );

  const openOrderModal = useCallback(
    (order, event) => {
      const target = event?.target;
      if (
        target?.closest?.(
          'button, a, input, textarea, select, [role="switch"], [role="checkbox"], [data-stop-order-modal]'
        )
      ) {
        return;
      }
      if (!order?._id) return;
      setSelectedOrderForEdit(order);
      setEditModalOpen(true);
      replaceOrdersQuery(searchWithOrderId(queryString, order._id));
    },
    [queryString, replaceOrdersQuery]
  );

  const refreshOrderAfterSupplierAction = useCallback(
    async (orderId) => {
      window.dispatchEvent(new Event("rovaro-inbox-refresh"));
      const loaded = await loadAdminOrder(orderId);
      if (!loaded.ok || !loaded.order) {
        await fetchAndUpdateOrders();
        return null;
      }
      setAllOrders((prev) => mergeOrderRow(prev, orderId, loaded.order));
      setSelectedOrderForEdit((prev) =>
        prev && String(prev._id) === String(orderId) ? loaded.order : prev
      );
      return loaded.order;
    },
    [fetchAndUpdateOrders, setAllOrders]
  );

  useEffect(() => {
    if (!orderIdQuery) {
      deepLinkGeneration.current += 1;
      setEditModalOpen((open) => (open ? false : open));
      setSelectedOrderForEdit((prev) => (prev ? null : prev));
      return undefined;
    }
    const generation = ++deepLinkGeneration.current;
    const requestedId = orderIdQuery;
    (async () => {
      const known = (allOrdersRef.current || []).find(
        (order) => String(order?._id) === requestedId
      );
      if (known && deepLinkGeneration.current === generation) {
        setSelectedOrderForEdit(known);
        setEditModalOpen(true);
      }
      const loaded = await loadAdminOrder(requestedId);
      if (deepLinkGeneration.current !== generation) return;
      if (!loaded.ok || !loaded.order) {
        if (loaded.status === 401 || known) return;
        enqueueSnackbar(loaded.message || "Not found", { variant: "error" });
        replaceOrdersQuery(searchWithoutOrderId(queryString));
        return;
      }
      setSelectedOrderForEdit(loaded.order);
      setEditModalOpen(true);
      setAllOrders((prev) => mergeOrderRow(prev, requestedId, loaded.order));
    })();
    return undefined;
  }, [enqueueSnackbar, orderIdQuery, queryString, replaceOrdersQuery, setAllOrders]);
  
  // Get current user for permission checks
  // ⚠️ RBAC SOURCE OF TRUTH: session.user.role is the single source of truth for UI permissions
  // adminRole from API is NOT used for permissions
  const currentUser = useMemo(() => {
    if (!session?.user?.isAdmin) {
      return null;
    }
    const user = {
      isAdmin: true,
      role: session.user.role, // SINGLE SOURCE OF TRUTH: Use session.user.role directly
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      ownerId: session.user.ownerId,
      viewAsCompanyId: session.user.viewAsCompanyId,
    };
    
    // Dev-only: Log role source once (not spammy)
    if (process.env.NODE_ENV !== "production") {
      console.log("[RBAC] sessionRole:", session.user.role, "currentUser.role:", user.role);
    }
    
    return user;
  }, [session]);

  
  // 🔧 FIXED: Use orderAccessPolicy directly (no legacy shims)
  // Permission check helpers using SSOT: getOrderAccess + getTimeBucket
  const getAccessForOrder = useCallback((order) => {
    if (!currentUser || !order) return null;
    const timeBucket = getTimeBucket(order);
    const isPast = timeBucket === "PAST";
    return getOrderAccess({
      role: policyRoleFromUser(currentUser) === ROLE.SUPERADMIN ? "SUPERADMIN" : "ADMIN",
      isClientOrder: order.my_order === true,
      confirmed: order.confirmed === true,
      isPast,
      timeBucket,
      bookingMode: order.bookingMode || "",
      partnerConfirmed: Boolean(
        order.partnerConfirmedAt || order.companyEmailDecision === "accepted"
      ),
      paymentStatus: order.payment?.status || "",
    });
  }, [currentUser]);
  
  const canEdit = useCallback((order) => {
    const access = getAccessForOrder(order);
    if (!access) return false;
    return !access.isViewOnly;
  }, [getAccessForOrder]);
  
  const canDelete = useCallback((order) => {
    const access = getAccessForOrder(order);
    if (!access) return false;
    return access.canDelete;
  }, [getAccessForOrder]);
  
  /**
   * Get field-level permission for an order
   * Uses orderAccessPolicy.disabledFields (SSOT)
   * 
   * @param {Object} order
   * @param {string} fieldName
   * @returns {{ allowed: boolean, reason: string|null }}
   */
  const getFieldPermission = useCallback((order, fieldName) => {
    const access = getAccessForOrder(order);
    if (!access) {
      return { allowed: false, reason: "Not authenticated" };
    }
    // Check if field is in disabledFields
    const isDisabled = access.disabledFields?.includes(fieldName);
    return { allowed: !isDisabled, reason: isDisabled ? "Field is disabled by policy" : null };
  }, [getAccessForOrder]);
  
  const canEditField = useCallback((order, fieldName) => {
    if (!currentUser) {
      console.warn("[canEditField] currentUser is null", { orderId: order._id, fieldName });
      return false;
    }
    const permission = getFieldPermission(order, fieldName);
    if (!permission.allowed && process.env.NODE_ENV !== "production") {
      console.log("[canEditField] Permission denied", {
        orderId: order._id,
        fieldName,
        userRole: currentUser.role,
        orderMyOrder: order.my_order,
        reason: permission.reason,
      });
    }
    return permission.allowed;
  }, [currentUser, getFieldPermission]);
  

  // ─────────────────────────────────────────────────────────────
  // FIELD CONFIGURATION MAP
  // ─────────────────────────────────────────────────────────────
  /**
   * Field configuration map for table columns
   * Defines which fields are editable and their types
   */
  const FIELD_CONFIG = {
    customerName: { type: "text", editable: true },
    phone: { type: "text", editable: true },
    email: { type: "email", editable: true },
    rentalStartDate: { type: "date", editable: true },
    rentalEndDate: { type: "date", editable: true },
    timeIn: { type: "time", editable: true },
    timeOut: { type: "time", editable: true },
    totalPrice: { type: "number", editable: true },
    // Non-editable fields (explicitly marked)
    orderNumber: { type: "text", editable: false }, // System-generated, not editable
    carModel: { type: "text", editable: false }, // Car selection handled separately
    carNumber: { type: "text", editable: false }, // Car selection handled separately
    numberOfDays: { type: "number", editable: false }, // Calculated field, not directly editable
    confirmed: { type: "boolean", editable: true }, // Editable via Switch, not InlineEditCell
  };

  // ─────────────────────────────────────────────────────────────
  // FILTER STATE
  // ─────────────────────────────────────────────────────────────
  const [selectedCar, setSelectedCar] = useState(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [originFilter, setOriginFilter] = useState("all");
  const sourceDefaultApplied = useRef(false);
  const [searchQuery, setSearchQuery] = useState("");
  /** Если true — не показываем заказы, у которых возврат уже в прошлом. */
  const [hidePastOrders, setHidePastOrders] = useState(false);

  useEffect(() => {
    if (sourceDefaultApplied.current) return;
    if (!session?.user) return;
    if (isPlatformAdmin) setOriginFilter("platform");
    sourceDefaultApplied.current = true;
  }, [session, isPlatformAdmin]);

  useEffect(() => {
    let cancelled = false;
    if (!showSuperAdminFilters) {
      setCompanies([]);
      setSelectedOwnerId("");
      return undefined;
    }
    setCompanies([]);
    (async () => {
      try {
        const qs =
          adminCountry === "ALL"
            ? "country=ALL"
            : `country=${encodeURIComponent(adminCountry)}`;
        const res = await fetch(`/api/admin/owners?${qs}`);
        if (res.ok) {
          const body = await res.json();
          if (!cancelled && body?.success && Array.isArray(body.companies)) {
            setCompanies(body.companies);
            return;
          }
        }
      } catch {
        /* fall through */
      }
      if (cancelled) return;
      const map = new Map();
      for (const c of cars || []) {
        if (!c?.ownerId) continue;
        const id = String(c.ownerId);
        if (!map.has(id)) map.set(id, { _id: id, name: id });
      }
      setCompanies(Array.from(map.values()));
    })();
    return () => {
      cancelled = true;
    };
  }, [cars, showSuperAdminFilters, adminCountry]);

  const companyNameById = useMemo(() => {
    const map = new Map();
    for (const c of companies || []) {
      const id = String(c?._id || "").trim();
      if (!id) continue;
      const name = String(c?.name || "").trim();
      if (name) map.set(id, name);
    }
    for (const car of cars || []) {
      const id = String(car?.ownerId || "").trim();
      if (!id || map.has(id)) continue;
      const name = String(
        car?.ownerName || car?.companyName || car?.owner?.name || ""
      ).trim();
      if (name) map.set(id, name);
    }
    return map;
  }, [companies, cars]);

  const resolveOrderCompanyName = useCallback(
    (order) => {
      const ownerId = String(order?.ownerId || order?.car?.ownerId || "").trim();
      const fromOrder = String(
        order?.companyName || order?.ownerName || order?.company?.name || ""
      ).trim();
      if (fromOrder) return fromOrder;
      if (ownerId && companyNameById.has(ownerId)) {
        return companyNameById.get(ownerId);
      }
      return ownerId || "—";
    },
    [companyNameById]
  );

  useEffect(() => {
    setSelectedOwnerId("");
  }, [adminCountry]);

  // ─────────────────────────────────────────────────────────────
  // PAGINATION STATE
  // ─────────────────────────────────────────────────────────────
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // ─────────────────────────────────────────────────────────────
  // CAR OPTIONS FOR AUTOCOMPLETE
  // ─────────────────────────────────────────────────────────────
  const carOptions = useMemo(() => {
    // Get unique cars from orders
    const carsFromOrders = orders.reduce((acc, order) => {
      const carId = order.car?._id || order.car;
      if (carId && !acc.find((c) => c._id === carId)) {
        // Try to get car details from cars array or order itself
        const carDetails = cars.find((c) => c._id === carId);
        acc.push({
          _id: carId,
          model: carDetails?.model || order.carModel || "Unknown",
          regNumber: carDetails?.regNumber || order.carNumber || "",
          label: `${carDetails?.model || order.carModel || "Unknown"} (${carDetails?.regNumber || order.carNumber || ""})`,
        });
      }
      return acc;
    }, []);
    return carsFromOrders.sort((a, b) => a.model.localeCompare(b.model));
  }, [orders, cars]);

  // ─────────────────────────────────────────────────────────────
  // FILTERING LOGIC
  // ─────────────────────────────────────────────────────────────
  const filteredOrders = useMemo(() => {
    const countryOwnerIds =
      showSuperAdminFilters && adminCountry !== "ALL"
        ? new Set(companies.map((c) => String(c._id)))
        : null;

    return orders.filter((order) => {
      // 0. Superadmin country filter (navbar Spain/Greece/All)
      if (countryOwnerIds) {
        const oid = resolveOrderOwnerId(order, cars);
        if (oid && !countryOwnerIds.has(String(oid))) return false;
      }

      // 1. Car filter
      if (selectedCar) {
        const orderCarId = order.car?._id || order.car;
        if (orderCarId !== selectedCar._id) return false;
      }

      // 1b. Company / owner filter
      if (selectedOwnerId) {
        const oid = resolveOrderOwnerId(order, cars);
        if (String(oid || "") !== String(selectedOwnerId)) return false;
      }

      // 2. Status filter (legacy confirmed/pending, or table status label key)
      if (statusFilter && statusFilter !== "all") {
        if (statusFilter === "confirmed") {
          if (!order.confirmed) return false;
        } else if (statusFilter === "pending") {
          if (order.confirmed) return false;
        } else if (contractorTableStatusLabelKey(order) !== statusFilter) {
          return false;
        }
      }

      if (!matchesBookingSourceFilter(order, originFilter)) return false;

      // 4. Date range filter (overlap: orderPickup <= filterEnd AND orderReturn >= filterStart)
      // If only dateFrom is set, show orders that end on or after dateFrom
      // If only dateTo is set, show orders that start on or before dateTo
      // If both are set, show orders that overlap with the range
      if (dateFrom || dateTo) {
        const orderStart = dayjs(order.rentalStartDate).tz(ATHENS_TZ).startOf("day");
        const orderEnd = dayjs(order.rentalEndDate).tz(ATHENS_TZ).startOf("day");

        if (dateFrom) {
          const filterStart = dayjs(dateFrom).startOf("day");
          // Order must end on or after filterStart
          if (orderEnd.isBefore(filterStart)) return false;
        }

        if (dateTo) {
          const filterEnd = dayjs(dateTo).startOf("day");
          // Order must start on or before filterEnd
          if (orderStart.isAfter(filterEnd)) return false;
        }
      }

      // 6. Text search (case-insensitive)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const searchFields = [
          order.customerName,
          order.phone,
          order.email,
          order.orderNumber,
          order.carModel,
          order.carNumber,
          order.car?.model,
          order.car?.regNumber,
          isPlatformAdmin ? resolveOrderCompanyName(order) : null,
        ].filter(Boolean);

        const matchesSearch = searchFields.some((field) =>
          String(field).toLowerCase().includes(query)
        );
        if (!matchesSearch) return false;
      }

      if (hidePastOrders && isOrderEndedInPast(order)) {
        return false;
      }

      return true;
    })
    // Sort by start date (rentalStartDate) - ascending, so neighboring orders are together
    .sort((a, b) => {
      const dateA = dayjs(a.rentalStartDate).tz(ATHENS_TZ);
      const dateB = dayjs(b.rentalStartDate).tz(ATHENS_TZ);
      // Primary sort: by start date
      if (dateA.isBefore(dateB)) return -1;
      if (dateA.isAfter(dateB)) return 1;
      // Secondary sort: by start time (timeIn) if dates are equal
      const timeA = a.timeIn ? dayjs(a.timeIn).tz(ATHENS_TZ) : null;
      const timeB = b.timeIn ? dayjs(b.timeIn).tz(ATHENS_TZ) : null;
      if (timeA && timeB) {
        if (timeA.isBefore(timeB)) return -1;
        if (timeA.isAfter(timeB)) return 1;
      }
      return 0;
    });
  }, [
    orders,
    cars,
    selectedCar,
    selectedOwnerId,
    statusFilter,
    originFilter,
    dateFrom,
    dateTo,
    searchQuery,
    hidePastOrders,
    showSuperAdminFilters,
    adminCountry,
    companies,
    isPlatformAdmin,
    resolveOrderCompanyName,
  ]);

  const filteredSummary = useMemo(
    () => summarizeFilteredOrders(filteredOrders),
    [filteredOrders]
  );

  // ─────────────────────────────────────────────────────────────
  // PAGINATED ORDERS
  // ─────────────────────────────────────────────────────────────
  const paginatedOrders = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return filteredOrders.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredOrders, page, rowsPerPage]);

  // ─────────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────────
  const handleResetFilters = useCallback(() => {
    setSelectedCar(null);
    setSelectedOwnerId("");
    setDateFrom("");
    setDateTo("");
    setStatusFilter("all");
    setOriginFilter("all");
    setSearchQuery("");
    setHidePastOrders(false);
    setPage(0);
  }, []);

  const handlePageChange = useCallback((event, newPage) => {
    setPage(newPage);
  }, []);

  const handleRowsPerPageChange = useCallback((event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  const handleRefresh = useCallback(async () => {
    await fetchAndUpdateOrders();
  }, [fetchAndUpdateOrders]);

  // Reset page when filters change
  const handleFilterChange = useCallback((setter) => (value) => {
    setter(value);
    setPage(0);
  }, []);

  const handleStatusChipClick = useCallback(
    (e, statusKey) => {
      e?.stopPropagation?.();
      if (!statusKey) return;
      setStatusFilter((prev) => (prev === statusKey ? "all" : statusKey));
      setPage(0);
    },
    []
  );

  const statusFilterOptions = useMemo(
    () => [
      { value: "all", label: t("table.all") },
      { value: "table.toneNewRequest", label: t("table.toneNewRequest", { defaultValue: "New request" }) },
      {
        value: "table.toneAwaitingPayment",
        label: t("table.toneAwaitingPayment", { defaultValue: "Awaiting payment" }),
      },
      {
        value: "table.toneConfirmedPaid",
        label: t("table.toneConfirmedPaid", { defaultValue: "Confirmed" }),
      },
      {
        value: "table.toneAlternative",
        label: t("table.toneAlternative", { defaultValue: "Alternative offered" }),
      },
      {
        value: "table.toneCompletionPending",
        label: t("table.toneCompletionPending", { defaultValue: "Completion pending" }),
      },
      { value: "table.toneCompleted", label: t("table.toneCompleted", { defaultValue: "Completed" }) },
      { value: "table.toneDeclined", label: t("table.toneDeclined", { defaultValue: "Declined" }) },
      { value: "table.toneExpired", label: t("table.toneExpired", { defaultValue: "Payment expired" }) },
      { value: "table.toneCancelled", label: t("table.toneCancelled", { defaultValue: "Cancelled" }) },
      {
        value: "table.internalTentative",
        label: t("table.internalTentative", { defaultValue: "Tentative" }),
      },
      {
        value: "table.internalConfirmed",
        label: t("table.internalConfirmed", { defaultValue: "Confirmed" }),
      },
      {
        value: "table.internalCompleted",
        label: t("table.internalCompleted", { defaultValue: "Completed" }),
      },
      {
        value: "table.internalCancelled",
        label: t("table.internalCancelled", { defaultValue: "Cancelled" }),
      },
      { value: "confirmed", label: t("table.confirmed") },
      { value: "pending", label: t("table.pending") },
    ],
    [t]
  );
  
  // ─────────────────────────────────────────────────────────────
  // INLINE EDITING HANDLERS
  // ─────────────────────────────────────────────────────────────
  
  /**
   * Handle individual field update (called by InlineEditCell onCommit)
   * 
   * @param {string} orderId - Order ID
   * @param {string} field - Field name
   * @param {any} value - Field value
   * @param {Object} options - Options object
   * @param {string} options.source - Source of update: "manual" | "recalculate" | undefined
   */
  const handleFieldUpdate = useCallback(async (orderId, field, value, options = {}) => {
    const savingKey = `${orderId}_${field}`;
    setIsSaving((prev) => ({ ...prev, [savingKey]: true }));
    try {
      const fieldsToSend = {};
      const order = orders.find((o) => o._id === orderId);
      
      // Format value based on field type
      if (field === "rentalStartDate" || field === "rentalEndDate") {
        // Date field: "YYYY-MM-DD" -> ISO string in Athens timezone
        if (value) {
          const dateTime = dayjs.tz(value, ATHENS_TZ).startOf("day");
          fieldsToSend[field] = dateTime.utc().toISOString();
        }
      } else if (field === "timeIn" || field === "timeOut") {
        // Time field: "HH:mm" -> combine with existing date -> ISO string
        if (order && value) {
          const dateField = field === "timeIn" ? "rentalStartDate" : "rentalEndDate";
          const existingDate = dayjs(order[dateField]).tz(ATHENS_TZ);
          const [hours, minutes] = value.split(":");
          const dateTime = existingDate.hour(parseInt(hours, 10)).minute(parseInt(minutes, 10));
          fieldsToSend[field] = dateTime.utc().toISOString();
        }
      } else {
        // Other fields: pass as-is
        fieldsToSend[field] = value;
      }
      
      // 🔧 PRICE ARCHITECTURE: Handle totalPrice field based on source
      // - manual input → set OverridePrice (isOverridePrice: true)
      // - recalculate → update totalPrice only (isOverridePrice: false)
      if (field === "totalPrice") {
        if (options.source === "manual") {
          // Manual input: save to OverridePrice
          fieldsToSend.isOverridePrice = true;
        } else if (options.source === "recalculate") {
          // Recalculate: update totalPrice only, clear OverridePrice
          fieldsToSend.isOverridePrice = false;
        } else {
          // Default (backward compatibility): treat as manual input
          fieldsToSend.isOverridePrice = true;
        }
      }
      
      // Debug logging (dev only)
      if (process.env.NODE_ENV !== "production") {
        console.log("[handleFieldUpdate] Update request:", {
          orderId,
          field,
          rawValue: value,
          fieldsToSend,
          isOverridePrice: field === "totalPrice",
        });
      }
      
      const result = await updateOrderInline(orderId, fieldsToSend);
      
      // Debug logging (dev only)
      if (process.env.NODE_ENV !== "production") {
        console.log("[handleFieldUpdate] Update response:", {
          orderId,
          field,
          success: result?.success,
          dataKeys: result?.data ? Object.keys(result.data) : [],
          resultData: result?.data,
        });
      }
      
      if (result && typeof result.success === "boolean") {
        if (!result.success) {
          // Conflict: Store persistently (no auto-clear)
          const message = result.message || "Cannot update order";
          setConflictsByOrderId((prev) => ({
            ...prev,
            [orderId]: {
              message: message,
              conflicts: result.conflicts || [],
            },
          }));
          setConflictHighlightsFromResult({ sourceOrderId: orderId, result });
          // NO snackbar for conflicts - only inline display
          return;
        }
        
        // Success: Clear conflicts for this order
        setConflictsByOrderId((prev) => {
          const next = { ...prev };
          delete next[orderId];
          return next;
        });
        clearConflictHighlights();
        
        // Prefer server order; never let client totalPrice overwrite stored auto on manual override.
        const serverOrder =
          result.data && typeof result.data === "object" ? result.data : {};
        const mergedUpdate = { ...serverOrder };
        delete mergedUpdate.isOverridePrice;
        if (
          field === "totalPrice" &&
          options.source === "manual" &&
          (mergedUpdate.OverridePrice === null ||
            mergedUpdate.OverridePrice === undefined)
        ) {
          mergedUpdate.OverridePrice = value;
        }
        if (
          field === "totalPrice" &&
          options.source === "recalculate"
        ) {
          mergedUpdate.OverridePrice = null;
          if (
            mergedUpdate.totalPrice === null ||
            mergedUpdate.totalPrice === undefined
          ) {
            mergedUpdate.totalPrice = value;
          }
        }
        // Fallback for non-price fields if server body was empty
        if (Object.keys(serverOrder).length === 0) {
          Object.assign(mergedUpdate, fieldsToSend);
          delete mergedUpdate.isOverridePrice;
        }
        
        // Debug logging (dev only)
        if (process.env.NODE_ENV !== "production") {
          console.log("[handleFieldUpdate] Merged update:", {
            orderId,
            field,
            fieldsToSend,
            resultData: result.data,
            mergedUpdate,
          });
        }
        
        setAllOrders((prev) =>
          prev.map((order) =>
            order._id === orderId ? { ...order, ...mergedUpdate } : order
          )
        );

        const priceNum = Number(
          field === "totalPrice"
            ? options.source === "manual"
              ? mergedUpdate.OverridePrice ?? value
              : mergedUpdate.totalPrice ?? value
            : 0
        );
        const successMsg =
          field === "totalPrice" && options.source === "recalculate"
            ? t("table.priceRecalculated", {
                price: priceNum.toFixed(2),
              })
            : field === "totalPrice"
              ? t("table.priceSavedManual", {
                  price: priceNum.toFixed(2),
                })
              : field === "rentalStartDate" ||
                  field === "rentalEndDate" ||
                  field === "timeIn" ||
                  field === "timeOut"
                ? t("order.changeDates")
                : t("order.orderUpdated");
        enqueueSnackbar(successMsg, { variant: "success" });
      }
    } catch (error) {
      console.error("Error updating order field:", error);
      enqueueSnackbar(error.message || t("table.updateFailed"), {
        variant: "error",
      });
    } finally {
      setIsSaving((prev) => ({ ...prev, [savingKey]: false }));
    }
  }, [
    orders,
    enqueueSnackbar,
    setConflictHighlightsFromResult,
    clearConflictHighlights,
    setAllOrders,
    t,
  ]);
  
  /**
   * Preview live auto price from /api/order/calcTotalPrice.
   * Does NOT write totalPrice / OverridePrice — display only.
   * @returns {Promise<number|null>}
   */
  const handlePreviewAutoPrice = useCallback(async (order) => {
    const orderId = order._id;

    setAutoPricePreviewById((prev) => ({
      ...prev,
      [orderId]: { loading: true, live: prev[orderId]?.live ?? null, error: null },
    }));

    try {
      let carNumber = null;
      if (order.car?.carNumber) {
        carNumber = order.car.carNumber;
      } else if (order.carNumber) {
        carNumber = order.carNumber;
      } else if (order.car?._id || order.car) {
        const carId = order.car?._id || order.car;
        const car = cars.find((c) => c._id?.toString() === carId?.toString());
        if (car?.carNumber) {
          carNumber = car.carNumber;
        }
      }

      if (!carNumber) {
        throw new Error(t("table.priceCarUnknown"));
      }

      const rentalStartDate = order.rentalStartDate
        ? dayjs.utc(order.rentalStartDate).tz(ATHENS_TZ).format("YYYY-MM-DD")
        : null;
      const rentalEndDate = order.rentalEndDate
        ? dayjs.utc(order.rentalEndDate).tz(ATHENS_TZ).format("YYYY-MM-DD")
        : null;

      if (!rentalStartDate || !rentalEndDate) {
        throw new Error(t("table.priceDatesMissing"));
      }

      const data = await calculateTotalPrice(
        carNumber,
        rentalStartDate,
        rentalEndDate,
        order.insurance || "TPL",
        order.ChildSeats || 0,
        {
          secondDriver: Boolean(order.secondDriver),
          timeIn: order.timeIn,
          timeOut: order.timeOut,
          placeIn: order.placeIn,
          placeOut: order.placeOut,
        }
      );

      if (!data.ok) {
        throw new Error(data.error || t("table.priceCalcFailed"));
      }

      const live = Number(data.totalPrice) || 0;
      setAutoPricePreviewById((prev) => ({
        ...prev,
        [orderId]: {
          loading: false,
          live,
          error: null,
        },
      }));
      return live;
    } catch (error) {
      console.error("Error previewing auto price:", error);
      setAutoPricePreviewById((prev) => ({
        ...prev,
        [orderId]: {
          loading: false,
          live: null,
          error: error.message || t("table.priceCalcFailed"),
        },
      }));
      enqueueSnackbar(error.message || t("table.priceCalcFailed"), {
        variant: "error",
      });
      return null;
    }
  }, [cars, enqueueSnackbar, t]);

  /** Save system-calculated price as auto (clears manual override). */
  const handleApplySystemPrice = useCallback(
    async (order) => {
      const live = await handlePreviewAutoPrice(order);
      if (live == null || !Number.isFinite(live)) return;
      await handleFieldUpdate(order._id, "totalPrice", live, {
        source: "recalculate",
      });
    },
    [handleFieldUpdate, handlePreviewAutoPrice]
  );

  const handleOpenPriceHistory = useCallback(
    async (event, orderId) => {
      const anchorEl = event.currentTarget;
      setPriceHistoryUi({
        orderId,
        anchorEl,
        loading: true,
        items: [],
        error: null,
      });
      try {
        const res = await fetch(
          `/api/admin/orders/${orderId}/price-breakdown`,
          { credentials: "include" }
        );
        const body = await res.json();
        if (!res.ok || body.success === false) {
          throw new Error(body.message || t("table.priceHistoryFailed"));
        }
        const history = Array.isArray(body.data?.history)
          ? body.data.history
          : [];
        const current =
          body.data && body.data.totalPrice != null
            ? [
                {
                  totalPrice: body.data.totalPrice,
                  source: body.data.source || "current",
                  createdAt: body.data.updatedAt || body.data.frozenAt,
                  isCurrent: true,
                },
              ]
            : [];
        const items = [...history].reverse().slice(0, 12);
        setPriceHistoryUi({
          orderId,
          anchorEl,
          loading: false,
          items: items.length ? items : current,
          error: null,
        });
      } catch (err) {
        setPriceHistoryUi({
          orderId,
          anchorEl,
          loading: false,
          items: [],
          error: err.message || t("table.priceHistoryFailed"),
        });
      }
    },
    [t]
  );

  const handleToggleConfirm = useCallback(async (orderId) => {
    setIsTogglingConfirm((prev) => ({ ...prev, [orderId]: true }));
    
    try {
      const result = await updateOrderConfirmation(orderId);
      
      // If not successful, show error in table, set conflict highlights, and return (do NOT update state)
      // Manual test: 403/409 should NOT flip the Switch
      if (!result?.success) {
        const message = result.message || "Cannot update order confirmation";
        console.log("[handleToggleConfirm] Error result:", { result, message });
        
        // Conflict: Store persistently (no auto-clear)
        setConflictsByOrderId((prev) => ({
          ...prev,
          [orderId]: {
            message: message,
            conflicts: result.conflicts || [],
          },
        }));
        
        // Set conflict highlights for calendar (if needed later)
        setConflictHighlightsFromResult({ sourceOrderId: orderId, result });
        
        // NO snackbar for conflicts - only inline display
        return;
      }
      
      // Success - clear conflicts for this order
      setConflictsByOrderId((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
      
      // Success - clear conflict highlights and update confirmed field from result.data
      // Manual test: 200/202 should flip the Switch
      clearConflictHighlights();
      
      if (result.data) {
        setAllOrders((prev) =>
          prev.map((order) =>
            order._id === orderId
              ? { ...order, confirmed: result.data.confirmed }
              : order
          )
        );
        
        // Show appropriate message based on level
        if (result.level === "warning") {
          // For warnings, show in table (persistent conflict panel)
          setConflictsByOrderId((prev) => ({
            ...prev,
            [orderId]: {
              message: result.message || "Order confirmed with warnings",
              conflicts: result.affectedOrders || [],
            },
          }));
          // Set highlights for affected pending orders
          setConflictHighlightsFromResult({ sourceOrderId: orderId, result });
          // NO snackbar for warnings - only inline display
        } else {
          // Success snackbar only
          enqueueSnackbar(
            result.message || "Order status updated successfully",
            { variant: "success" }
          );
        }
      }
    } catch (error) {
      console.error("Error toggling confirmation:", error);
      // On error, do NOT update UI
      enqueueSnackbar(error.message || "Failed to toggle confirmation", { variant: "error" });
    } finally {
      setIsTogglingConfirm((prev) => ({ ...prev, [orderId]: false }));
    }
  }, [
    enqueueSnackbar,
    setConflictHighlightsFromResult,
    clearConflictHighlights,
    setAllOrders,
  ]);

  const handleSupplierResponse = useCallback(
    async (orderId, response, reason) => {
      setIsTogglingSupplier((prev) => ({ ...prev, [orderId]: true }));
      try {
        const result = await updateOrderSupplierResponse(orderId, {
          response,
          reason,
        });
        if (!result?.success) {
          enqueueSnackbar(result?.message || t("table.updateFailed"), {
            variant: "error",
          });
          return;
        }
        if (result.data) {
          const patch = {
            confirmed: result.data.confirmed,
            companyEmailDecision: result.data.companyEmailDecision,
            partnerConfirmedAt: result.data.partnerConfirmedAt,
            declineReason: result.data.supplierDeclineReason,
            companyEmailDecisionAt: result.data.supplierRespondedAt,
            ...(result.data.bookingStatus
              ? { bookingStatus: result.data.bookingStatus }
              : {}),
            partnerConfirmMeta: {
              actor: {
                name: result.data.supplierRespondedByName,
                email: result.data.supplierRespondedByEmail,
              },
            },
          };
          setAllOrders((prev) =>
            prev.map((order) =>
              order._id === orderId
                ? {
                    ...order,
                    ...patch,
                    partnerConfirmMeta: {
                      ...(order.partnerConfirmMeta || {}),
                      ...patch.partnerConfirmMeta,
                    },
                  }
                : order
            )
          );
          setSelectedOrderForEdit((prev) =>
            prev && String(prev._id) === String(orderId)
              ? {
                  ...prev,
                  ...patch,
                  partnerConfirmMeta: {
                    ...(prev.partnerConfirmMeta || {}),
                    ...patch.partnerConfirmMeta,
                  },
                }
              : prev
          );
        }
        enqueueSnackbar(result.message, { variant: "success" });
        await refreshOrderAfterSupplierAction(orderId);
      } catch (error) {
        enqueueSnackbar(error.message || t("table.updateFailed"), {
          variant: "error",
        });
      } finally {
        setIsTogglingSupplier((prev) => ({ ...prev, [orderId]: false }));
      }
    },
    [enqueueSnackbar, refreshOrderAfterSupplierAction, setAllOrders, t]
  );

  // ─────────────────────────────────────────────────────────────
  // FORMAT HELPERS
  // ─────────────────────────────────────────────────────────────
  const formatDate = useCallback((date) => {
    if (!date) return "-";
    return dayjs(date).tz(ATHENS_TZ).format("DD.MM.YYYY");
  }, []);

  const formatTime = useCallback((date) => {
    if (!date) return "-";
    return dayjs(date).tz(ATHENS_TZ).format("HH:mm");
  }, []);

  const formatDateTime = useCallback((date, time) => {
    const dateStr = formatDate(date);
    const timeStr = time ? formatTime(time) : "";
    return timeStr ? `${dateStr} ${timeStr}` : dateStr;
  }, [formatDate, formatTime]);

  const handleHidePastToggle = useCallback((event) => {
    setHidePastOrders(event.target.checked);
    setPage(0);
  }, []);

  const handleExportExcel = useCallback(async () => {
    try {
      const exported = buildContractorOrdersExport(filteredOrders);
      const headers = [
        t("table.status", { defaultValue: "Status" }),
        t("table.filterByOrigin", { defaultValue: "Source" }),
        ...(isPlatformAdmin ? [t("table.company")] : []),
        t("table.orderNumber", { defaultValue: "Order #" }),
        t("table.price", { defaultValue: "Rental total" }),
        ...(isPlatformAdmin
          ? [t("table.bookingFee", { defaultValue: "Rovaro Booking Fee" })]
          : []),
        t("table.dueToCompany", { defaultValue: "Due to company" }),
      ];
      const rows = filteredOrders.map((order, index) => {
        const row = exported.rows[index];
        return [
        t(row.statusKey, { defaultValue: row.statusKey }),
        row.source === "PLATFORM"
          ? t("table.sourceRovaroShort", { defaultValue: "Rovaro" })
          : row.source === "INTERNAL"
            ? t("table.sourceInternalShort", { defaultValue: "Internal" })
            : t("table.toneUnresolved", { defaultValue: "Needs review" }),
        ...(isPlatformAdmin ? [resolveOrderCompanyName(order)] : []),
        row.orderNumber,
        row.rentalTotal,
        ...(isPlatformAdmin ? [row.bookingFee] : []),
        row.dueToCompany,
      ];
      });
      const blank = Array(headers.length).fill("");
      const platformRow = [...blank];
      platformRow[0] = t("table.rovaroBookingsTitle", { defaultValue: "Rovaro bookings" });
      if (isPlatformAdmin) {
        platformRow[headers.length - 3] = exported.totals.platformBookingValue;
        platformRow[headers.length - 2] = exported.totals.rovaroBookingFees;
        platformRow[headers.length - 1] = exported.totals.supplierPlatformAmount;
      } else {
        platformRow[headers.length - 2] = exported.totals.platformBookingValue;
        platformRow[headers.length - 1] = exported.totals.supplierPlatformAmount;
      }
      const internalRow = [...blank];
      internalRow[0] = t("table.internalBookingsTitle", { defaultValue: "Internal bookings" });
      internalRow[headers.length - (isPlatformAdmin ? 3 : 2)] =
        exported.totals.internalBookingValue;
      const aoa = [headers, ...rows, platformRow, internalRow];
      const stamp = dayjs().tz(ATHENS_TZ).format("YYYY-MM-DD_HH-mm");
      await downloadOrdersTableXlsx(aoa, {
        filename: `orders_${stamp}.xlsx`,
        sheetName: "Orders",
      });
      enqueueSnackbar(t("table.exportExcelSuccess"), { variant: "success" });
    } catch (e) {
      console.error(e);
      enqueueSnackbar(t("table.exportExcelError"), { variant: "error" });
    }
  }, [
    filteredOrders,
    isPlatformAdmin,
    resolveOrderCompanyName,
    t,
    enqueueSnackbar,
  ]);

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <Box sx={{ px: { xs: 1, md: 2 }, pb: 6, pt: { xs: 1, md: 1.25 } }}>
      {/* Filters toolbar — no page title; the table itself is the page */}
      <Paper
        elevation={0}
        sx={{
          px: 1.25,
          py: 1,
          mb: 1.5,
          border: `1px solid ${palette.neutral.gray200}`,
          borderRadius: 2,
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 1,
            rowGap: 1,
          }}
        >
          <Autocomplete
            value={selectedCar}
            onChange={(e, newValue) => handleFilterChange(setSelectedCar)(newValue)}
            options={carOptions}
            getOptionLabel={(option) => option.label || ""}
            isOptionEqualToValue={(option, value) => option._id === value?._id}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t("table.filterByCar")}
                size="small"
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <>
                      <FilterIcon
                        sx={{ color: palette.neutral.gray500, mr: 0.5 }}
                        fontSize="small"
                      />
                      {params.InputProps.startAdornment}
                    </>
                  ),
                }}
              />
            )}
            sx={{ minWidth: { xs: "100%", sm: 200 }, maxWidth: { md: 280 }, flex: "1 1 200px" }}
            clearOnEscape
          />

          <TextField
            type="date"
            label={t("table.dateFrom")}
            value={dateFrom}
            onChange={(e) => handleFilterChange(setDateFrom)(e.target.value)}
            size="small"
            InputLabelProps={{ shrink: true }}
            sx={{ width: 148 }}
          />

          <TextField
            type="date"
            label={t("table.dateTo")}
            value={dateTo}
            onChange={(e) => handleFilterChange(setDateTo)(e.target.value)}
            size="small"
            InputLabelProps={{ shrink: true }}
            sx={{ width: 148 }}
          />

          {showSuperAdminFilters ? (
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Company</InputLabel>
              <Select
                value={selectedOwnerId}
                onChange={(e) =>
                  handleFilterChange(setSelectedOwnerId)(e.target.value)
                }
                label="Company"
              >
                <MenuItem value="">All companies</MenuItem>
                {companies.map((c) => (
                  <MenuItem key={String(c._id)} value={String(c._id)}>
                    {c.name || String(c._id)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : null}

          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>{t("table.filterByStatus")}</InputLabel>
            <Select
              value={statusFilter}
              onChange={(e) => handleFilterChange(setStatusFilter)(e.target.value)}
              label={t("table.filterByStatus")}
            >
              {statusFilterOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>
              {t("table.filterByOrigin", { defaultValue: "Source" })}
            </InputLabel>
            <Select
              value={originFilter}
              onChange={(e) => handleFilterChange(setOriginFilter)(e.target.value)}
              label={t("table.filterByOrigin", { defaultValue: "Source" })}
            >
              <MenuItem value="all">
                {t("table.sourceAll", { defaultValue: "All" })}
              </MenuItem>
              <MenuItem value="platform">
                {t("table.sourceRovaro", { defaultValue: "Rovaro bookings" })}
              </MenuItem>
              <MenuItem value="internal">
                {t("table.sourceInternal", { defaultValue: "Internal bookings" })}
              </MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={hidePastOrders}
                onChange={handleHidePastToggle}
                color="primary"
                size="small"
              />
            }
            label={t("table.hidePastOrders")}
            sx={{
              ml: 0,
              mr: 0.5,
              whiteSpace: "nowrap",
              "& .MuiFormControlLabel-label": { fontSize: "0.8125rem" },
            }}
          />

          <TextField
            placeholder={t("table.search")}
            value={searchQuery}
            onChange={(e) => handleFilterChange(setSearchQuery)(e.target.value)}
            size="small"
            sx={{ minWidth: 160, flex: "1 1 160px", maxWidth: 260 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon
                    sx={{ color: palette.neutral.gray500 }}
                    fontSize="small"
                  />
                </InputAdornment>
              ),
              endAdornment: searchQuery ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => handleFilterChange(setSearchQuery)("")}
                    aria-label={t("table.reset")}
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              ml: { md: "auto" },
              flexShrink: 0,
            }}
          >
            <Button
              variant="outlined"
              color="secondary"
              onClick={handleResetFilters}
              size="small"
              startIcon={<ClearIcon fontSize="small" />}
              sx={{ px: 1, minWidth: 0 }}
            >
              {t("table.reset")}
            </Button>

            <Tooltip title="Refresh">
              <span>
                <IconButton
                  onClick={handleRefresh}
                  disabled={ordersLoading}
                  size="small"
                  aria-label="Refresh"
                >
                  {ordersLoading ? (
                    <CircularProgress size={18} />
                  ) : (
                    <RefreshIcon fontSize="small" />
                  )}
                </IconButton>
              </span>
            </Tooltip>

            <Tooltip title={t("table.exportExcel")}>
              <span>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<FileDownloadIcon fontSize="small" />}
                  onClick={handleExportExcel}
                  disabled={filteredOrders.length === 0}
                  sx={{ px: 1, minWidth: 0 }}
                >
                  Excel
                </Button>
              </span>
            </Tooltip>
          </Box>
        </Box>

        <OrdersFinancialSummary
          summary={filteredSummary}
          filteredCount={filteredOrders.length}
          totalCount={orders.length}
          showBookingFee={isPlatformAdmin}
        />
      </Paper>

      {/* Orders Table */}
      <Paper 
        elevation={0} 
        sx={{ 
          border: `1px solid ${palette.neutral.gray200}`,
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <TableContainer sx={{ maxHeight: "60vh", minHeight: 300 }}>
          <Table stickyHeader size="small" sx={{
            "& .MuiTableCell-root": { py: 0.5, px: 1, verticalAlign: "middle" },
            "& .MuiTableCell-head": { py: 0.75 },
          }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, minWidth: 118 }}>
                  {t("table.yourResponse", { defaultValue: "Your response" })}
                </TableCell>
                <TableCell sx={{ fontWeight: 700, minWidth: 110 }}>
                  {t("table.status")}
                </TableCell>
                <TableCell sx={{ fontWeight: 700, minWidth: 72 }}>
                  {t("table.filterByOrigin", { defaultValue: "Source" })}
                </TableCell>
                {isPlatformAdmin ? (
                  <TableCell sx={{ fontWeight: 700, minWidth: 120 }}>
                    {t("table.company")}
                  </TableCell>
                ) : null}
                <TableCell sx={{ fontWeight: 700, minWidth: 120 }}>
                  {t("table.carModel")}
                </TableCell>
                <TableCell sx={{ fontWeight: 700, minWidth: 108 }}>
                  {t("table.pickup")}
                </TableCell>
                <TableCell sx={{ fontWeight: 700, minWidth: 108 }}>
                  {t("table.return")}
                </TableCell>
                <TableCell sx={{ fontWeight: 700, minWidth: 88, textAlign: "right" }}>
                  {t("table.price")}
                </TableCell>
                {isPlatformAdmin ? (
                  <TableCell sx={{ fontWeight: 700, minWidth: 80, textAlign: "right" }}>
                    {t("table.bookingFee", { defaultValue: "Rovaro Booking Fee" })}
                  </TableCell>
                ) : null}
                <TableCell sx={{ fontWeight: 700, minWidth: 80, textAlign: "right" }}>
                  {t("table.dueToCompany", { defaultValue: "Due to company" })}
                </TableCell>
                <TableCell sx={{ fontWeight: 700, minWidth: 130 }}>
                  {t("table.customer")}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {showTableSkeleton ? (
                <TableRow>
                  <TableCell colSpan={tableColCount} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={32} />
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {t("table.loadingOrders")}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : paginatedOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={tableColCount} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t("table.noOrders")}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedOrders.map((order) => {
                  const orderColor = getOrderColor(order);
                  const money = contractorOrderMoneyRow(order);
                  const statusKey = contractorTableStatusLabelKey(order);
                  const statusLabel = t(statusKey, {
                    defaultValue:
                      {
                        "table.toneNewRequest": "New request",
                        "table.toneAwaitingPayment": "Awaiting payment",
                        "table.toneConfirmedPaid": "Confirmed",
                        "table.toneAlternative": "Alternative offered",
                        "table.toneCompletionPending": "Completion pending",
                        "table.toneCompleted": "Completed",
                        "table.toneDeclined": "Declined",
                        "table.toneExpired": "Payment expired",
                        "table.toneCancelled": "Cancelled",
                        "table.internalTentative": "Tentative",
                        "table.internalConfirmed": "Confirmed",
                        "table.internalCompleted": "Completed",
                        "table.internalCancelled": "Cancelled",
                      }[statusKey] || "Unresolved",
                  });
                  const isBlocked = pendingConfirmBlockById?.[order._id];
                  const carDisplay = order.car?.model || order.carModel || "-";
                  const carRegNumber = order.car?.regNumber || order.carNumber || "";
                  
                  // Permission checks
                  const orderCanEdit = canEdit(order);
                  const isClient = isClientOrder(order);
                  
                  // Field-level permissions (computed for all editable fields)
                  const canEditCustomerName = canEditField(order, "customerName");
                  const canEditPhone = canEditField(order, "phone");
                  const canEditEmail = canEditField(order, "email");
                  const canEditStartDate = canEditField(order, "rentalStartDate");
                  const canEditEndDate = canEditField(order, "rentalEndDate");
                  const canEditTimeIn = canEditField(order, "timeIn");
                  const canEditTimeOut = canEditField(order, "timeOut");
                  const canEditTotalPrice = canEditField(order, "totalPrice");
                  
                  // Legacy aliases for backward compatibility
                  const canEditDates = canEditStartDate || canEditEndDate; // Any date editable
                  const canEditTimes = canEditTimeIn; // Used for both times
                  
                  // Dev-only: Permission audit log for first 1-2 orders (not spammy)
                  if (process.env.NODE_ENV !== "production" && paginatedOrders.indexOf(order) < 2) {
                    const permissionAudit = {
                      orderId: order._id,
                      orderNumber: order.orderNumber,
                      my_order: order.my_order,
                      confirmed: order.confirmed,
                      userRole: currentUser?.role,
                      customerName: canEditCustomerName,
                      phone: canEditPhone,
                      email: canEditEmail,
                      rentalStartDate: canEditStartDate,
                      rentalEndDate: canEditEndDate,
                      timeIn: canEditTimeIn,
                      timeOut: canEditTimeOut,
                      totalPrice: canEditTotalPrice,
                    };
                    console.log(`[Permission Audit] Order ${paginatedOrders.indexOf(order) + 1}:`, permissionAudit);
                  }
                  
                  // Check if this order has a conflict (from persistent conflictsByOrderId)
                  const orderConflict = conflictsByOrderId[order._id];
                  const isConflictSource = !!orderConflict;
                  
                  // Check if this order is in another order's conflicts list
                  const isConflictingOrder = Object.values(conflictsByOrderId).some((conflict) => {
                    return conflict.conflicts?.some((c) => {
                      const conflictId = c.orderId || c._id || c;
                      return String(conflictId) === String(order._id);
                    });
                  });
                  
                  // Check if this order is highlighted from context
                  const hasContextHighlight = conflictHighlightById[order._id];
                  
                  const hasConflict = isConflictSource || isConflictingOrder || hasContextHighlight;
                  const conflictInfo = conflictHighlightById[order._id];
                  const conflictMessage = orderConflict?.message || conflictInfo?.message;
                  const needsCompanyAction = orderRequiresCompanyAction(order);
                  const isAwaitingSupplierResponse =
                    needsCompanyAction &&
                    isClient &&
                    resolvePlatformWorkflowStage(order) ===
                      PLATFORM_WORKFLOW_STAGE.AWAITING_SUPPLIER_CONFIRMATION;
                  // Bright yellow so action-needed rows are obvious at a glance
                  const actionHighlightBg = "#FFE566";
                  const actionHighlightHover = "#FFD93D";

                  return (
                    <React.Fragment key={order._id}>
                      <TableRow
                        hover
                        onDoubleClick={(e) => openOrderModal(order, e)}
                        sx={{
                          cursor: "pointer",
                          borderLeft: `4px solid ${
                            needsCompanyAction && !hasConflict
                              ? palette.analogous.amberDark || palette.status.warning
                              : orderColor.main
                          }`,
                          ...(needsCompanyAction &&
                            !hasConflict && {
                              backgroundColor: actionHighlightBg,
                              "&:hover": {
                                backgroundColor: actionHighlightHover,
                              },
                            }),
                          ...(!needsCompanyAction && {
                            "&:hover": {
                              backgroundColor:
                                orderColor.bg || alpha(orderColor.main, 0.04),
                            },
                          }),
                          ...(hasConflict && {
                            backgroundColor: isConflictSource 
                              ? alpha(palette.status.error, 0.25)
                              : alpha(palette.status.error, 0.21),
                            border: `4px solid ${isConflictSource ? palette.status.error : palette.status.warning}`,
                            borderTop: `2px solid ${isConflictSource ? palette.status.error : palette.status.warning}`,
                            borderBottom: `2px solid ${isConflictSource ? palette.status.error : palette.status.warning}`,
                            color: "white"
                          }),
                        }}
                      >
                      {/* Your response — first column */}
                      <TableCell sx={{ verticalAlign: "middle" }}>
                        {isAwaitingSupplierResponse || isClient ? (
                          <SupplierResponseCell
                            order={order}
                            isClient={isClient}
                            busy={Boolean(isTogglingSupplier[order._id])}
                            compact
                            hideAwaitingLabel
                            onViewDetails={() => openOrderModal(order)}
                            onRespond={(response, reason) =>
                              handleSupplierResponse(order._id, response, reason)
                            }
                          />
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            —
                          </Typography>
                        )}
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
                            {needsCompanyAction ? (
                              <Chip
                                label={t("table.supplierAwaitingYours", {
                                  defaultValue: "Awaiting your response",
                                })}
                                size="small"
                                onClick={(e) => handleStatusChipClick(e, statusKey)}
                                sx={{
                                  backgroundColor: "#FFE566",
                                  color: palette.neutral?.black || "#111",
                                  fontWeight: 700,
                                  fontSize: "0.7rem",
                                  height: 22,
                                  cursor: "pointer",
                                  outline:
                                    statusFilter === statusKey
                                      ? `2px solid ${palette.analogous.amberDark || "#D4A03A"}`
                                      : "none",
                                }}
                              />
                            ) : (
                              <Chip
                                label={statusLabel}
                                size="small"
                                onClick={(e) => handleStatusChipClick(e, statusKey)}
                                sx={{
                                  backgroundColor: orderColor.bg,
                                  color: orderColor.text,
                                  fontWeight: 500,
                                  fontSize: "0.7rem",
                                  height: 22,
                                  cursor: "pointer",
                                  outline:
                                    statusFilter === statusKey
                                      ? `2px solid ${orderColor.main || orderColor.text}`
                                      : "none",
                                }}
                              />
                            )}
                            {orderColor.problem ? (
                              <Chip
                                label={t("calendar.legend.PROBLEM", { defaultValue: "Problem" })}
                                size="small"
                                variant="outlined"
                                sx={{
                                  fontSize: "0.65rem",
                                  height: 20,
                                  borderColor: "error.main",
                                  color: "error.main",
                                }}
                              />
                            ) : null}
                            {!orderCanEdit && isClient ? (
                              <Tooltip title="Admin cannot edit client orders">
                                <LockIcon
                                  fontSize="small"
                                  sx={{
                                    color: palette.neutral.gray500,
                                    fontSize: 14,
                                  }}
                                />
                              </Tooltip>
                            ) : null}
                            {!orderCanEdit && !isClient && isPlatformAdmin ? (
                              <Tooltip title={t("table.internalOrderLock")}>
                                <LockIcon
                                  fontSize="small"
                                  sx={{
                                    color: palette.neutral.gray500,
                                    fontSize: 14,
                                  }}
                                />
                              </Tooltip>
                            ) : null}
                            {isBlocked ? (
                              <Tooltip title={isBlocked}>
                                <BlockIcon
                                  fontSize="small"
                                  sx={{ color: palette.status.warning, fontSize: 16 }}
                                />
                              </Tooltip>
                            ) : null}
                        </Stack>
                      </TableCell>

                      <TableCell>
                        <Chip
                          label={
                            isPlatformBooking(order)
                              ? t("table.sourceRovaroShort", { defaultValue: "Rovaro" })
                              : isInternalBooking(order)
                                ? t("table.sourceInternalShort", { defaultValue: "Internal" })
                                : t("table.toneUnresolved", { defaultValue: "Needs review" })
                          }
                          size="small"
                          variant="outlined"
                          sx={{
                            fontSize: "0.7rem",
                            height: 22,
                            borderColor: isInternalBooking(order)
                              ? "secondary.main"
                              : "divider",
                          }}
                        />
                      </TableCell>

                      {isPlatformAdmin ? (
                        <TableCell>
                          <Typography
                            variant="body2"
                            fontWeight={500}
                            sx={{
                              maxWidth: 160,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={resolveOrderCompanyName(order)}
                          >
                            {resolveOrderCompanyName(order)}
                          </Typography>
                        </TableCell>
                      ) : null}

                      {/* Car - NOT EDITABLE: Car selection handled separately via modal */}
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {carDisplay}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {carRegNumber}
                        </Typography>
                      </TableCell>

                      {/* Pickup Date/Time */}
                      <TableCell>
                        <Stack spacing={0}>
                          <InlineEditCell
                            type="date"
                            value={order.rentalStartDate ? dayjs(order.rentalStartDate).tz(ATHENS_TZ).format("YYYY-MM-DD") : ""}
                            disabled={!canEditStartDate || isSaving[`${order._id}_rentalStartDate`]}
                            onDenied={() => {
                              const permission = getFieldPermission(order, "rentalStartDate");
                              enqueueSnackbar(permission.reason || "⛔ Нельзя редактировать дату начала", { variant: "warning" });
                            }}
                            onCommit={(val) => handleFieldUpdate(order._id, "rentalStartDate", val)}
                            formatDisplay={(val) => {
                              if (!val) return "-";
                              const date = dayjs(val, "YYYY-MM-DD");
                              return date.isValid() ? date.format("DD.MM.YYYY") : val;
                            }}
                          />
                          <InlineEditCell
                            type="time"
                            value={order.timeIn ? formatTime(order.timeIn) : ""}
                            disabled={!canEditTimeIn || isSaving[`${order._id}_timeIn`]}
                            onDenied={() => {
                              const permission = getFieldPermission(order, "timeIn");
                              enqueueSnackbar(permission.reason || "⛔ Нельзя редактировать время начала", { variant: "warning" });
                            }}
                            onCommit={(val) => handleFieldUpdate(order._id, "timeIn", val)}
                            formatDisplay={(val) => (val ? val : "-")}
                          />
                        </Stack>
                      </TableCell>

                      {/* Return Date/Time */}
                      <TableCell>
                        <Stack spacing={0}>
                          <InlineEditCell
                            type="date"
                            value={order.rentalEndDate ? dayjs(order.rentalEndDate).tz(ATHENS_TZ).format("YYYY-MM-DD") : ""}
                            disabled={!canEditEndDate || isSaving[`${order._id}_rentalEndDate`]}
                            onDenied={() => {
                              const permission = getFieldPermission(order, "rentalEndDate", currentUser);
                              enqueueSnackbar(permission.reason || "⛔ Нельзя редактировать дату окончания", { variant: "warning" });
                            }}
                            onCommit={(val) => handleFieldUpdate(order._id, "rentalEndDate", val)}
                            formatDisplay={(val) => {
                              if (!val) return "-";
                              const date = dayjs(val, "YYYY-MM-DD");
                              return date.isValid() ? date.format("DD.MM.YYYY") : val;
                            }}
                          />
                          <InlineEditCell
                            type="time"
                            value={order.timeOut ? formatTime(order.timeOut) : ""}
                            disabled={!canEditTimeOut || isSaving[`${order._id}_timeOut`]}
                            onDenied={() => {
                              const permission = getFieldPermission(order, "timeOut");
                              enqueueSnackbar(permission.reason || "⛔ Нельзя редактировать время окончания", { variant: "warning" });
                            }}
                            onCommit={(val) => handleFieldUpdate(order._id, "timeOut", val)}
                            formatDisplay={(val) => (val ? val : "-")}
                          />
                        </Stack>
                      </TableCell>

                      </TableCell>

                      {/* Price: charged + history; system line only for offline */}
                      <TableCell align="right" sx={{ minWidth: 110 }}>
                        {(() => {
                          const effectivePrice = getEffectivePrice(order);
                          const hasManualOverride =
                            order.OverridePrice !== null &&
                            order.OverridePrice !== undefined;
                          const storedAuto = getStoredAutoPrice(order);
                          const preview = autoPricePreviewById[order._id];
                          const systemPrice =
                            preview?.live != null
                              ? Number(preview.live)
                              : storedAuto;
                          const days = getOrderNumberOfDaysOrZero(order);
                          const showSystemPrice = Boolean(order.offline);

                          return (
                            <Stack spacing={0.15} alignItems="flex-end">
                              <Stack
                                direction="row"
                                spacing={0.35}
                                alignItems="center"
                              >
                                <InlineEditCell
                                  type="number"
                                  value={effectivePrice?.toString() || "0"}
                                  disabled={
                                    !canEditTotalPrice ||
                                    isSaving[`${order._id}_totalPrice`]
                                  }
                                  onDenied={() => {
                                    const permission = getFieldPermission(
                                      order,
                                      "totalPrice"
                                    );
                                    enqueueSnackbar(
                                      permission.reason ||
                                        t("table.cannotEditPrice"),
                                      { variant: "warning" }
                                    );
                                  }}
                                  onCommit={(val) => {
                                    const numericValue = val
                                      ? parseFloat(val)
                                      : null;
                                    if (
                                      numericValue === null ||
                                      isNaN(numericValue) ||
                                      val.trim() === ""
                                    ) {
                                      enqueueSnackbar(
                                        t("table.invalidPriceNumber"),
                                        { variant: "error" }
                                      );
                                      return;
                                    }
                                    if (numericValue < 0) {
                                      enqueueSnackbar(
                                        t("table.priceNotNegative"),
                                        { variant: "error" }
                                      );
                                      return;
                                    }
                                    handleFieldUpdate(
                                      order._id,
                                      "totalPrice",
                                      numericValue,
                                      { source: "manual" }
                                    );
                                  }}
                                  formatDisplay={(val) => {
                                    if (!val || val === "0") return "€0.00";
                                    const num = parseFloat(val);
                                    if (isNaN(num)) return "€0.00";
                                    return `€${num.toFixed(2)}`;
                                  }}
                                  inputProps={{
                                    step: "0.01",
                                    min: "0",
                                  }}
                                  sx={{ textAlign: "right" }}
                                  inputSx={{
                                    textAlign: "right",
                                    fontWeight: 700,
                                  }}
                                />
                                {hasManualOverride && (
                                  <Chip
                                    size="small"
                                    label={t("table.priceManual")}
                                    sx={{
                                      height: 20,
                                      fontSize: "0.65rem",
                                      bgcolor: alpha(
                                        palette.status.warning,
                                        0.15
                                      ),
                                      color: palette.status.warning,
                                    }}
                                  />
                                )}
                                {isPlatformAdmin ? (
                                  <Tooltip title={t("table.priceRecalcTooltip")}>
                                    <span>
                                      <IconButton
                                        size="small"
                                        onClick={() =>
                                          handleApplySystemPrice(order)
                                        }
                                        disabled={
                                          !canEditTotalPrice ||
                                          preview?.loading ||
                                          isSaving[`${order._id}_totalPrice`]
                                        }
                                        sx={{ p: 0.4 }}
                                      >
                                        {preview?.loading ? (
                                          <CircularProgress size={14} />
                                        ) : (
                                          <AutorenewIcon fontSize="small" />
                                        )}
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                ) : null}
                                <Tooltip title={t("table.priceHistory")}>
                                  <IconButton
                                    size="small"
                                    onClick={(e) =>
                                      handleOpenPriceHistory(e, order._id)
                                    }
                                    sx={{ p: 0.4 }}
                                  >
                                    <HistoryIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                              {showSystemPrice ? (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ lineHeight: 1.2, textAlign: "right", fontSize: "0.65rem" }}
                                >
                                  {t("table.priceSystem")}: €
                                  {Number(systemPrice || 0).toFixed(2)}
                                  {preview?.live != null &&
                                  Number(preview.live) !== Number(storedAuto)
                                    ? ` · ${t("table.priceSavedAuto")}: €${Number(
                                        storedAuto || 0
                                      ).toFixed(2)}`
                                    : hasManualOverride
                                      ? ` · ${t("table.priceSavedAuto")}: €${Number(
                                          storedAuto || 0
                                        ).toFixed(2)}`
                                      : ""}
                                  {" · "}
                                  {days} {t("table.days")}
                                </Typography>
                              ) : null}
                            </Stack>
                          );
                        })()}
                      </TableCell>

                      {isPlatformAdmin ? (
                        <TableCell align="right">
                          €{money.bookingFee.toFixed(2)}
                        </TableCell>
                      ) : null}
                      <TableCell align="right">
                        €{money.dueToCompany.toFixed(2)}
                      </TableCell>

                      {/* Customer — last column */}
                      <TableCell>
                        {order._visibility?.hideClientContacts ? (
                          <Typography variant="body2" color="text.secondary">—</Typography>
                        ) : (
                        <Stack spacing={0}>
                          <InlineEditCell
                            value={order.customerName || ""}
                            disabled={!canEditCustomerName || isSaving[`${order._id}_customerName`]}
                            onDenied={() => {
                              const permission = getFieldPermission(order, "customerName");
                              enqueueSnackbar(permission.reason || "⛔ Нельзя редактировать имя клиента", { variant: "warning" });
                            }}
                            onCommit={(val) => handleFieldUpdate(order._id, "customerName", val)}
                          />
                          <InlineEditCell
                            value={order.phone || ""}
                            disabled={!canEditPhone || isSaving[`${order._id}_phone`]}
                            onDenied={() => {
                              const permission = getFieldPermission(order, "phone");
                              enqueueSnackbar(permission.reason || "⛔ Нельзя редактировать телефон", { variant: "warning" });
                            }}
                            onCommit={(val) => handleFieldUpdate(order._id, "phone", val)}
                          />
                          <InlineEditCell
                            type="email"
                            value={order.email || ""}
                            disabled={!canEditEmail || isSaving[`${order._id}_email`]}
                            onDenied={() => {
                              const permission = getFieldPermission(order, "email", currentUser);
                              enqueueSnackbar(permission.reason || "⛔ Нельзя редактировать email", { variant: "warning" });
                            }}
                            onCommit={(val) => handleFieldUpdate(order._id, "email", val)}
                          />
                        </Stack>
                        )}
                      </TableCell>
                    </TableRow>
                    
                    {/* Persistent Conflict Panel - only for source order */}
                    {isConflictSource && orderConflict && (
                      <TableRow>
                        <TableCell colSpan={tableColCount} sx={{ py: 1.5, px: 2, backgroundColor: alpha(palette.status.error, 0.08) }}>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" justifyContent="space-between">
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                              <BlockIcon sx={{ color: palette.status.error, fontSize: 18 }} />
                              <Typography variant="body2" sx={{ color: palette.status.error, fontWeight: 500 }}>
                                {orderConflict.message}
                              </Typography>
                              {orderConflict.conflicts && orderConflict.conflicts.length > 0 && (
                                <>
                                  <Typography variant="caption" sx={{ color: palette.status.error, ml: 1 }}>
                                    ({orderConflict.conflicts.length} {orderConflict.conflicts.length === 1 ? "conflict" : "conflicts"})
                                  </Typography>
                                  {orderConflict.conflicts.length > 0 && (
                                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ ml: 1 }}>
                                      <Typography variant="caption" sx={{ color: palette.status.error }}>
                                        Conflicting orders:
                                      </Typography>
                                      {orderConflict.conflicts.slice(0, 5).map((conflict, idx) => {
                                        const conflictId = conflict.orderId || conflict._id || conflict;
                                        const conflictOrder = orders.find((o) => String(o._id) === String(conflictId));
                                        const conflictOrderNumber = conflictOrder?.orderNumber || conflictId;
                                        return (
                                          <Chip
                                            key={idx}
                                            label={conflictOrderNumber}
                                            size="small"
                                            sx={{
                                              height: 20,
                                              fontSize: "0.65rem",
                                              backgroundColor: alpha(palette.status.error, 0.2),
                                              color: palette.status.error,
                                            }}
                                          />
                                        );
                                      })}
                                      {orderConflict.conflicts.length > 5 && (
                                        <Typography variant="caption" sx={{ color: palette.status.error }}>
                                          +{orderConflict.conflicts.length - 5} more
                                        </Typography>
                                      )}
                                    </Stack>
                                  )}
                                </>
                              )}
                            </Stack>
                            {/* Clear button */}
                            <IconButton
                              size="small"
                              onClick={() => {
                                setConflictsByOrderId((prev) => {
                                  const next = { ...prev };
                                  delete next[order._id];
                                  return next;
                                });
                                clearConflictHighlights();
                              }}
                              sx={{
                                color: palette.status.error,
                                "&:hover": {
                                  backgroundColor: alpha(palette.status.error, 0.1),
                                },
                              }}
                            >
                              <ClearIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    )}
                    
                    {/* Conflict indicator for conflicting orders (not source) */}
                    {isConflictingOrder && !isConflictSource && (
                      <TableRow>
                        <TableCell colSpan={tableColCount} sx={{ py: 0.5, px: 2, backgroundColor: alpha(palette.status.warning, 0.05) }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <BlockIcon sx={{ color: palette.status.warning, fontSize: 16 }} />
                            <Typography variant="caption" sx={{ color: palette.status.warning, fontStyle: "italic" }}>
                              This order conflicts with the update attempt above
                            </Typography>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <TablePagination
          component="div"
          count={filteredOrders.length}
          page={page}
          onPageChange={handlePageChange}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleRowsPerPageChange}
          rowsPerPageOptions={[10, 25, 50]}
          labelRowsPerPage={t("table.rowsPerPage")}
          sx={{
            borderTop: `1px solid ${palette.neutral.gray200}`,
          }}
        />
      </Paper>

      <Popover
        open={Boolean(priceHistoryUi?.anchorEl)}
        anchorEl={priceHistoryUi?.anchorEl || null}
        onClose={() => setPriceHistoryUi(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Box sx={{ p: 1.5, minWidth: 240, maxWidth: 320 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
            {t("table.priceHistory")}
          </Typography>
          {priceHistoryUi?.loading ? (
            <Stack alignItems="center" py={2}>
              <CircularProgress size={22} />
            </Stack>
          ) : priceHistoryUi?.error ? (
            <Typography variant="body2" color="error">
              {priceHistoryUi.error}
            </Typography>
          ) : !(priceHistoryUi?.items || []).length ? (
            <Typography variant="body2" color="text.secondary">
              {t("table.priceHistoryEmpty")}
            </Typography>
          ) : (
            <Stack spacing={0.75}>
              {(priceHistoryUi.items || []).map((item, idx) => {
                const ts = item.createdAt || item.savedAt;
                const when = ts
                  ? dayjs(ts).tz(ATHENS_TZ).format("DD.MM.YYYY HH:mm")
                  : "—";
                const src = item.isCurrent
                  ? t("table.priceHistoryCurrent")
                  : item.source || "—";
                return (
                  <Box
                    key={`${when}-${idx}`}
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 1,
                      borderBottom: "1px solid",
                      borderColor: "divider",
                      pb: 0.5,
                    }}
                  >
                    <Box>
                      <Typography variant="caption" display="block">
                        {when}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                      >
                        {src}
                      </Typography>
                    </Box>
                    <Typography variant="body2" fontWeight={700}>
                      €{Number(item.totalPrice || 0).toFixed(2)}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
          )}
        </Box>
      </Popover>

      <Modal
        open={editModalOpen && !!selectedOrderForEdit}
        onClose={handleEditModalBackdropClose}
        sx={{
          display: "flex",
          alignItems: { xs: "flex-start", sm: "center" },
          justifyContent: "center",
          overflowY: { xs: "auto", sm: "hidden" },
        }}
      >
        <Box
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              tryCloseEditModal();
            }
          }}
          sx={{
            display: "flex",
            alignItems: { xs: "flex-start", sm: "center" },
            justifyContent: { xs: "flex-start", sm: "center" },
            width: "100%",
            minHeight: "100%",
            overflowY: "auto",
            overflowX: "hidden",
            p: { xs: 0.75, sm: 2 },
          }}
        >
          <Grid
            container
            justifyContent="center"
            alignItems="flex-start"
            onClick={(e) => e.stopPropagation()}
            sx={{
              width: "100%",
              maxWidth: { xs: "95vw", sm: "92vw", md: "1100px" },
              maxHeight: { xs: "none", sm: "100%" },
              overflowX: "hidden",
              my: { xs: 0.5, sm: 0 },
            }}
          >
            {selectedOrderForEdit && (
              <Grid item xs={12}>
                {isPlatformBooking(selectedOrderForEdit) ? (
                  <BookingDetailsModal
                    order={selectedOrderForEdit}
                    open={editModalOpen}
                    onClose={performEditModalClose}
                    onChanged={refreshOrderAfterSupplierAction}
                  />
                ) : (
                <EditOrderModal
                  order={selectedOrderForEdit}
                  open={editModalOpen}
                  onClose={performEditModalClose}
                  onRequestClose={tryCloseEditModal}
                  registerEditOrderCloseGuard={registerEditOrderCloseGuard}
                  onSave={handleSaveOrderFromModal}
                  onSupplierRespond={handleSupplierResponse}
                  onSupplierChanged={refreshOrderAfterSupplierAction}
                  supplierBusy={Boolean(
                    isTogglingSupplier[selectedOrderForEdit?._id]
                  )}
                  isConflictOrder={isConflictOrder}
                  setIsConflictOrder={setIsConflictOrder}
                  startEndDates={startEndDates}
                  cars={cars}
                  isViewOnly={isPast(selectedOrderForEdit.rentalEndDate)}
                  ordersInBatch={1}
                />
                )}
              </Grid>
            )}
          </Grid>
        </Box>
      </Modal>

      <OrderUnsavedCloseDialog
        open={unsavedEditDialogOpen}
        onClose={handleUnsavedEditCancel}
        onDiscard={handleUnsavedEditDiscard}
        onSaveAndExit={handleUnsavedEditSave}
        saving={unsavedEditSaving}
      />
    </Box>
  );
}
