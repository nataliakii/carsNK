"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { normalizeCompanyOffices } from "@/domain/company/companyOffices";
import { CAR_OFFICE_SCOPE } from "@/domain/company/officeConstants";
import { officeIdString } from "@/domain/company/officeRecord";

/**
 * Select eligible company offices by stable ID for a car.
 * Writes `officeIds` + `officeScope`, and mirrors a legacy `offices` name/address
 * snapshot for read compatibility (IDs remain source of truth).
 */
export default function CarCompanyOfficesPicker({
  companyId,
  companyOffices = [],
  officeIds = [],
  officeScope = CAR_OFFICE_SCOPE.ALL,
  onChange,
  disabled = false,
}) {
  const { t } = useTranslation();
  const [remoteOffices, setRemoteOffices] = useState([]);

  useEffect(() => {
    const id = companyId ? String(companyId) : "";
    if (!id) {
      setRemoteOffices([]);
      return undefined;
    }
    let cancelled = false;
    fetch(`/api/admin/offices?companyId=${encodeURIComponent(id)}`, {
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (cancelled || !body?.success) return;
        setRemoteOffices(Array.isArray(body.offices) ? body.offices : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const options = useMemo(() => {
    const fromCompany = normalizeCompanyOffices(companyOffices);
    const fromRemote = normalizeCompanyOffices(remoteOffices);
    const byId = new Map();
    for (const row of [...fromCompany, ...fromRemote]) {
      const id = officeIdString(row._id || row.id);
      if (!id) continue;
      if (String(row.status || "active").toLowerCase() === "archived") continue;
      byId.set(id, { ...row, _id: id, id });
    }
    return Array.from(byId.values());
  }, [companyOffices, remoteOffices]);

  const selectedIds = useMemo(
    () =>
      (Array.isArray(officeIds) ? officeIds : [])
        .map((id) => officeIdString(id))
        .filter(Boolean),
    [officeIds]
  );

  const selected = useMemo(
    () => options.filter((o) => selectedIds.includes(officeIdString(o._id))),
    [options, selectedIds]
  );

  const scope =
    String(officeScope || "").toLowerCase() === CAR_OFFICE_SCOPE.SELECTED
      ? CAR_OFFICE_SCOPE.SELECTED
      : CAR_OFFICE_SCOPE.ALL;

  const emit = (nextIds, nextScope) => {
    const ids = (nextIds || []).map(officeIdString).filter(Boolean);
    const legacy = options
      .filter((o) => ids.includes(officeIdString(o._id)))
      .map((o) => ({
        name: o.publicName || o.name,
        address: o.address || "",
        lat: o.lat || "",
        lon: o.lon || o.lng || "",
      }));
    onChange?.({
      officeIds: ids,
      officeScope: nextScope,
      offices: legacy,
    });
  };

  return (
    <>
      <FormControl fullWidth size="small" sx={{ mb: 1.5 }} disabled={disabled}>
        <InputLabel id="car-office-scope-label">
          {t("car.officeScope") || "Office eligibility"}
        </InputLabel>
        <Select
          labelId="car-office-scope-label"
          label={t("car.officeScope") || "Office eligibility"}
          value={scope}
          onChange={(e) => {
            const nextScope = e.target.value;
            emit(
              nextScope === CAR_OFFICE_SCOPE.ALL ? [] : selectedIds,
              nextScope
            );
          }}
        >
          <MenuItem value={CAR_OFFICE_SCOPE.ALL}>
            {t("car.officeScopeAll") || "All company offices"}
          </MenuItem>
          <MenuItem value={CAR_OFFICE_SCOPE.SELECTED}>
            {t("car.officeScopeSelected") || "Selected offices only"}
          </MenuItem>
        </Select>
      </FormControl>

      {scope === CAR_OFFICE_SCOPE.SELECTED ? (
        <Autocomplete
          multiple
          options={options}
          value={selected}
          disabled={disabled || !options.length}
          getOptionLabel={(opt) => {
            const name = opt?.publicName || opt?.name || "";
            const address = opt?.address ? ` — ${opt.address}` : "";
            return `${name}${address}`;
          }}
          isOptionEqualToValue={(a, b) =>
            officeIdString(a?._id) === officeIdString(b?._id)
          }
          onChange={(_, next) => {
            emit(
              (next || []).map((row) => officeIdString(row._id)),
              CAR_OFFICE_SCOPE.SELECTED
            );
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label={t("car.offices") || "Offices (pickup / return)"}
              helperText={
                t("car.officeIdsHelp") ||
                "Select company offices by stable ID."
              }
            />
          )}
        />
      ) : (
        <Typography variant="body2" color="text.secondary">
          {t("car.officesHelp") ||
            "All active company offices are eligible for this car."}
        </Typography>
      )}
    </>
  );
}
