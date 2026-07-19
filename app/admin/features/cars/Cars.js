"use client";
import React, { useEffect, useMemo, useState } from "react";
import {
  Grid,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { useSession } from "next-auth/react";
import { useMainContext } from "@app/Context";
import Loading from "@app/loading";
import Error from "@app/error";
import CarItem from "./CarItem";
import { ROLE } from "@/domain/orders/admin-rbac";

function resolveCompanyName(car, companyNameById, fallbackCompany) {
  const oid = car?.ownerId ? String(car.ownerId) : "";
  if (!oid) return "Unassigned";
  if (companyNameById[oid]) return companyNameById[oid];
  if (fallbackCompany?._id && String(fallbackCompany._id) === oid) {
    return fallbackCompany.name || oid;
  }
  return "Unknown company";
}

function Cars({ onCarDelete, setUpdateStatus }) {
  const { cars, isLoading, error, company } = useMainContext();
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === ROLE.SUPERADMIN;

  const [companies, setCompanies] = useState([]);
  const [companyNameById, setCompanyNameById] = useState({});
  const [ownerFilter, setOwnerFilter] = useState("");

  useEffect(() => {
    if (!isSuperAdmin) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/owners");
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled && body?.success && Array.isArray(body.companies)) {
          setCompanies(body.companies);
          const map = {};
          for (const c of body.companies) {
            if (c?._id) map[String(c._id)] = c.name || String(c._id);
          }
          setCompanyNameById((prev) => ({ ...prev, ...map }));
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin]);

  // Resolve company names for cars (works for company admin too)
  useEffect(() => {
    const ids = [
      ...new Set(
        (cars || [])
          .map((c) => (c?.ownerId ? String(c.ownerId) : ""))
          .filter(Boolean)
      ),
    ];
    if (!ids.length) return undefined;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await fetch(`/api/company/${id}`);
            if (!res.ok) return [id, null];
            const body = await res.json();
            return [id, body?.name || null];
          } catch {
            return [id, null];
          }
        })
      );
      if (cancelled) return;
      setCompanyNameById((prev) => {
        const next = { ...prev };
        for (const [id, name] of entries) {
          if (name) next[id] = name;
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [cars]);

  useEffect(() => {
    if (company?._id) {
      setCompanyNameById((prev) => ({
        ...prev,
        [String(company._id)]: company.name || prev[String(company._id)],
      }));
    }
  }, [company]);

  const sortedCars = useMemo(() => {
    let list = [...cars];
    if (ownerFilter) {
      list = list.filter(
        (c) => String(c.ownerId || "") === String(ownerFilter)
      );
    }
    return list.sort((a, b) => a.model.localeCompare(b.model));
  }, [cars, ownerFilter]);

  useEffect(() => {
    const savedScroll = localStorage.getItem("carsScrollY");
    if (savedScroll) {
      window.scrollTo({ top: Number(savedScroll), behavior: "auto" });
    }
    const handleScroll = () => {
      localStorage.setItem("carsScrollY", window.scrollY);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (isLoading) return <Loading />;
  if (error) return <Error />;

  return (
    <Box
      sx={{ width: "100%", maxWidth: 1100, mx: "auto", px: { xs: 1, sm: 2 } }}
    >
      {isSuperAdmin && companies.length > 0 && (
        <FormControl
          size="small"
          sx={{ mb: 1.5, minWidth: 220, mt: { xs: 8, md: 12 } }}
        >
          <InputLabel id="cars-company-filter">Company</InputLabel>
          <Select
            labelId="cars-company-filter"
            label="Company"
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
          >
            <MenuItem value="">All companies</MenuItem>
            {companies.map((c) => (
              <MenuItem key={String(c._id)} value={String(c._id)}>
                {c.name || String(c._id)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      <Grid
        container
        spacing={1.25}
        sx={{
          mt: isSuperAdmin && companies.length > 0 ? 0 : { xs: 8, md: 14 },
          alignItems: "stretch",
        }}
      >
        {sortedCars.map((car) => (
          <Grid item xs={12} md={6} key={car._id}>
            <CarItem
              car={car}
              onCarDelete={onCarDelete}
              setUpdateStatus={setUpdateStatus}
              companyName={resolveCompanyName(car, companyNameById, company)}
              companies={companies}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

export default Cars;
