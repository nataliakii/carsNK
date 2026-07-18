"use client";

import React, { createContext, useContext } from "react";

/** @typedef {{ href: string, label: string, children?: Array<{ href: string, label: string }> }} NavLocationGroup */

const NavLocationsContext = createContext({
  /** @type {NavLocationGroup[]} */
  locationGroups: [],
  navLocationsDescription: "",
});

export function useNavLocations() {
  return useContext(NavLocationsContext);
}

export function NavLocationsProvider({
  locationGroups = [],
  navLocationsDescription = "",
  children,
}) {
  const value = React.useMemo(
    () => ({ locationGroups, navLocationsDescription }),
    [locationGroups, navLocationsDescription]
  );
  return (
    <NavLocationsContext.Provider value={value}>
      {children}
    </NavLocationsContext.Provider>
  );
}
