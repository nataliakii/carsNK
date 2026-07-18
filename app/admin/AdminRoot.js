/**
 * AdminRoot - Single dynamic entry point for ALL admin-only code
 * 
 * 🎯 PURPOSE: Complete bundle isolation
 * - Public pages must NOT import or execute ANY admin code
 * - Admin code loads ONLY when:
 *   1. User is admin (isAdmin === true)
 *   2. Admin UI is actually needed
 * 
 * ✅ BENEFITS:
 * - Reduces TBT (Total Blocking Time) on public pages
 * - Eliminates unused JS in public bundle
 * - Prevents admin Context/hooks from executing on public pages
 * 
 * ⚠️ IMPORTANT:
 * - This component MUST be loaded via dynamic() with ssr: false
 * - This is the ONLY place where admin UI components should be imported
 * - Public components should conditionally render <AdminRoot /> instead of importing admin code
 */

"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import { useMainContext } from "@app/Context";

// ============================================================
// DYNAMIC ADMIN UI COMPONENTS
// All admin UI must be loaded here, not in public components
// ============================================================

const LegendCalendarAdmin = dynamic(
  () => import("@/app/components/calendar-ui/LegendCalendarAdmin"),
  { ssr: false }
);

const DiscountModal = dynamic(
  () => import("@/app/admin/features/settings/DiscountModal"),
  { ssr: false }
);

/**
 * AdminRoot Component
 * 
 * Manages all admin-only UI features:
 * - LegendCalendarAdmin (calendar legend)
 * - DiscountModal (discount settings)
 * - Any other admin UI that needs to be conditionally rendered
 * 
 * ⚠️ STATE OWNERSHIP:
 * - Discount state is owned by parent (Navbar) to avoid refactoring
 * - AdminRoot only renders admin UI components
 * 
 * @param {Object} props
 * @param {boolean} props.showLegend - Whether to show calendar legend
 * @param {boolean} props.isMain - Whether this is main page (for legend styling)
 * @param {boolean} props.discountModalOpen - Discount modal open state (from parent)
 * @param {Function} props.setDiscountModalOpen - Discount modal setter (from parent)
 * @param {number} props.selectedDiscount - Selected discount value (from parent)
 * @param {Function} props.setSelectedDiscount - Discount setter (from parent)
 * @param {Date|null} props.discountStartDate - Discount start date (from parent)
 * @param {Function} props.setDiscountStartDate - Start date setter (from parent)
 * @param {Date|null} props.discountEndDate - Discount end date (from parent)
 * @param {Function} props.setDiscountEndDate - End date setter (from parent)
 * @param {Function} props.onSaveDiscount - Save discount handler (from parent)
 * @param {boolean} props.discountActiveNow - Today falls within discount period (from parent)
 * @param {Array} props.discountHistory - Discount history (from parent/global state)
 * @param {Object|null} props.activeDiscount - Active discount (from parent/global state)
 */
export default function AdminRoot({
  showLegend = false,
  isMain = false,
  discountModalOpen = false,
  setDiscountModalOpen,
  selectedDiscount = 0,
  setSelectedDiscount,
  discountStartDate = null,
  setDiscountStartDate,
  discountEndDate = null,
  setDiscountEndDate,
  onSaveDiscount,
  discountActiveNow = false,
  discountHistory = [],
  activeDiscount = null,
}) {
  const { data: session } = useSession();

  // Don't render anything if not admin
  if (!session?.user?.isAdmin) {
    return null;
  }

  return (
    <>
      {/* Calendar Legend - only render if showLegend is true */}
      {showLegend && (
        <LegendCalendarAdmin client={isMain} />
      )}

      {/* Discount Modal - state managed by parent */}
      {setDiscountModalOpen && setSelectedDiscount && setDiscountStartDate && setDiscountEndDate && onSaveDiscount && (
        <DiscountModal
          open={discountModalOpen}
          onClose={() => setDiscountModalOpen(false)}
          selectedDiscount={selectedDiscount}
          setSelectedDiscount={setSelectedDiscount}
          discountStartDate={discountStartDate}
          setDiscountStartDate={setDiscountStartDate}
          discountEndDate={discountEndDate}
          setDiscountEndDate={setDiscountEndDate}
          onSave={onSaveDiscount}
          discountActiveNow={discountActiveNow}
          discountHistory={discountHistory}
          activeDiscount={activeDiscount}
        />
      )}
    </>
  );
}

