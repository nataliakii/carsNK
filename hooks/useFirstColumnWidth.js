"use client";
import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { measureTextWidth, getComputedStyles } from "@/utils/textMeasurement";

/**
 * Hook to calculate and maintain first column width based on longest vehicle name
 * Handles: vehicle list changes, window resize, theme changes
 * 
 * @param {Array} vehicles - Array of vehicle objects with model and regNumber
 * @param {Object} options - Configuration options
 * @param {number} options.minWidth - Minimum width in px (default: 160)
 * @param {number} options.maxWidth - Maximum width in px (default: 400)
 * @param {number} options.debounceMs - Debounce delay for resize (default: 150)
 * @returns {number|null} Calculated width in pixels or null if not ready
 */
export function useFirstColumnWidth(vehicles, options = {}) {
  const {
    minWidth = 160,
    maxWidth = 400,
    debounceMs = 150,
  } = options;

  const [width, setWidth] = useState(null);
  const measurementRef = useRef(null);
  const resizeTimeoutRef = useRef(null);
  const observerRef = useRef(null);

  const calculateWidth = useCallback(() => {
    if (typeof window === "undefined") return;
    
    // Need vehicles and measurement element
    if (!vehicles || vehicles.length === 0) {
      setWidth(minWidth);
      return;
    }

    // If no measurement element yet, wait
    if (!measurementRef.current) {
      return;
    }

    // Get computed styles from actual DOM element
    const computedStyle = getComputedStyles(measurementRef.current);
    if (!computedStyle) {
      setWidth(minWidth);
      return;
    }

    // Measure each vehicle name
    let maxTextWidth = 0;
    vehicles.forEach((vehicle) => {
      const vehicleText = `${vehicle.model || ""} ${vehicle.regNumber || ""}`.trim();
      if (!vehicleText) return;

      const textWidth = measureTextWidth(vehicleText, computedStyle);
      if (textWidth > maxTextWidth) {
        maxTextWidth = textWidth;
      }
    });

    // Add horizontal padding from computed styles
    const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
    const paddingRight = parseFloat(computedStyle.paddingRight) || 0;
    const totalPadding = paddingLeft + paddingRight;

    // Calculate final width with padding
    const calculatedWidth = Math.ceil(maxTextWidth + totalPadding);

    // Apply min/max bounds
    const boundedWidth = Math.max(minWidth, Math.min(maxWidth, calculatedWidth));
    
    setWidth(boundedWidth);
  }, [vehicles, minWidth, maxWidth]);

  // Get reference element for measurement (first column cell)
  const setMeasurementRef = useCallback((element) => {
    if (measurementRef.current === element) return;
    
    // Cleanup old observer
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    measurementRef.current = element;

    // Set up ResizeObserver to detect theme/font changes
    if (element && typeof window !== "undefined" && window.ResizeObserver) {
      observerRef.current = new ResizeObserver(() => {
        // Debounce resize observer callbacks
        if (resizeTimeoutRef.current) {
          clearTimeout(resizeTimeoutRef.current);
        }
        resizeTimeoutRef.current = setTimeout(() => {
          calculateWidth();
        }, debounceMs);
      });
      observerRef.current.observe(element);
    }
  }, [calculateWidth, debounceMs]);

  // Initial calculation and recalculation on vehicle changes
  useLayoutEffect(() => {
    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      calculateWidth();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [calculateWidth]);

  // Handle window resize with debouncing
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      resizeTimeoutRef.current = setTimeout(() => {
        calculateWidth();
      }, debounceMs);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [calculateWidth, debounceMs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, []);

  return { width, setMeasurementRef };
}
