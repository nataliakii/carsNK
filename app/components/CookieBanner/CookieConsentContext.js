"use client";

/**
 * CookieConsentContext
 * 
 * Provides cookie consent state management across the app.
 * - Consent is stored in localStorage
 * - Analytics can ONLY load when consent === "accepted"
 * - No cookies/analytics before explicit consent (GDPR compliance)
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const CONSENT_KEY = "cookie-consent";

// Possible consent states
export const CONSENT_STATUS = {
  PENDING: null,      // User hasn't made a choice yet
  ACCEPTED: "accepted",
  REJECTED: "rejected",
};

const CookieConsentContext = createContext({
  consent: CONSENT_STATUS.PENDING,
  hasConsented: false,
  acceptCookies: () => {},
  rejectCookies: () => {},
  resetConsent: () => {},
});

export function useCookieConsent() {
  return useContext(CookieConsentContext);
}

export function CookieConsentProvider({ children }) {
  const [consent, setConsent] = useState(CONSENT_STATUS.PENDING);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load consent from localStorage on mount (client-side only)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(CONSENT_KEY);
      if (stored === CONSENT_STATUS.ACCEPTED || stored === CONSENT_STATUS.REJECTED) {
        setConsent(stored);
      }
      setIsLoaded(true);
    }
  }, []);

  const acceptCookies = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(CONSENT_KEY, CONSENT_STATUS.ACCEPTED);
      setConsent(CONSENT_STATUS.ACCEPTED);
    }
  }, []);

  const rejectCookies = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(CONSENT_KEY, CONSENT_STATUS.REJECTED);
      setConsent(CONSENT_STATUS.REJECTED);
    }
  }, []);

  const resetConsent = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(CONSENT_KEY);
      setConsent(CONSENT_STATUS.PENDING);
    }
  }, []);

  const value = {
    consent,
    hasConsented: consent !== CONSENT_STATUS.PENDING,
    isAccepted: consent === CONSENT_STATUS.ACCEPTED,
    isRejected: consent === CONSENT_STATUS.REJECTED,
    isLoaded,
    acceptCookies,
    rejectCookies,
    resetConsent,
  };

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
    </CookieConsentContext.Provider>
  );
}
