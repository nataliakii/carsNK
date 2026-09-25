"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getDefaultAdminSectionOpen,
  readAdminSectionOpenFromStorage,
  writeAdminSectionOpenToStorage,
} from "@/domain/admin/adminSectionCollapse";

/**
 * Состояние сворачиваемой секции админки.
 * SSR-safe: первый рендер (сервер и клиент) всегда закрыт, сохранённый выбор
 * применяется уже после монтирования — поэтому гидрация не расходится.
 */
export function useAdminSectionOpen(sectionId) {
  const [open, setOpen] = useState(getDefaultAdminSectionOpen);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setOpen(readAdminSectionOpenFromStorage(sectionId));
    setHydrated(true);
  }, [sectionId]);

  useEffect(() => {
    if (!hydrated) return;
    writeAdminSectionOpenToStorage(sectionId, open);
  }, [hydrated, open, sectionId]);

  const toggleOpen = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  return { open, toggleOpen, hydrated };
}
