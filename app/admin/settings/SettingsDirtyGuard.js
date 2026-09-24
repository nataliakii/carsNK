"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const SettingsDirtyContext = createContext({
  isDirty: false,
  setDirty: () => {},
  confirmLeave: () => true,
});

const LEAVE_MESSAGE =
  "You have unsaved changes. Leave this tab and discard them?";

export function SettingsDirtyProvider({ children }) {
  const [dirtyKeys, setDirtyKeys] = useState(() => new Set());
  const dirtyRef = useRef(false);

  const isDirty = dirtyKeys.size > 0;
  dirtyRef.current = isDirty;

  const setDirty = useCallback((key, dirty) => {
    const id = String(key || "default");
    setDirtyKeys((prev) => {
      const next = new Set(prev);
      if (dirty) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const confirmLeave = useCallback(() => {
    if (!dirtyRef.current) return true;
    return window.confirm(LEAVE_MESSAGE);
  }, []);

  useEffect(() => {
    if (!isDirty) return undefined;
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const value = useMemo(
    () => ({ isDirty, setDirty, confirmLeave }),
    [isDirty, setDirty, confirmLeave]
  );

  return (
    <SettingsDirtyContext.Provider value={value}>
      {children}
    </SettingsDirtyContext.Provider>
  );
}

export function useSettingsDirty() {
  return useContext(SettingsDirtyContext);
}

/**
 * Registers a dirty flag under `key` while mounted. Clears on unmount.
 */
export function useRegisterSettingsDirty(key, dirty) {
  const { setDirty } = useSettingsDirty();
  useEffect(() => {
    setDirty(key, Boolean(dirty));
    return () => setDirty(key, false);
  }, [key, dirty, setDirty]);
}
