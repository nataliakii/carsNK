"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  Link as MuiLink,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import NextLink from "next/link";
import { useTranslation } from "react-i18next";
import AdminSettingsSection, {
  adminFieldSx,
  adminFormGridSx,
  adminReadableTextSx,
  adminSurfaceSx,
} from "@/app/admin/shared/components/AdminSettingsSection";
import ServiceAreasPicker from "@/app/admin/shared/components/ServiceAreasPicker";
import OperatingCitiesPicker from "@/app/admin/shared/components/OperatingCitiesPicker";
import CoverageMapPreview from "@/app/admin/shared/components/CoverageMapPreview";
import useOperatingCityCatalog from "@/app/admin/shared/hooks/useOperatingCityCatalog";
import { compactServiceAreas } from "@/domain/geo/spainAdminDivisions";
import { resolveCompanyOffices } from "@/domain/company/companyOffices";

const EMPTY = {
  enabled: false,
  useRentalFleet: true,
  acceptAllTransferRequests: false,
  transferCoverageFollowsCompany: true,
  useDifferentEmail: false,
  transferNotifyEmail: "",
  supplierAgreementAccepted: false,
  maxPassengers: 7,
  vehicleCategories: ["STANDARD"],
  childSeatsAvailable: 0,
  serviceCities: [],
  airportsServed: [],
  serviceAreas: { communityCodes: [], provinceCodes: [] },
  stripeForPlatformFee: false,
  stripeForCompanyAmount: false,
};

function categoryLabel(code, options, t) {
  const found = (options || []).find((o) => o.code === code);
  if (found?.title) return found.title;
  return t(`companyProfile.transferCategory_${code}`, { defaultValue: code });
}

/**
 * Supplier transfer capability config — no customer price editing.
 */
export default function CompanyTransferServicesCard({
  companyId,
  embedded = false,
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [ts, setTs] = useState(EMPTY);
  const [fleet, setFleet] = useState({
    hasActiveCars: false,
    activeCarCount: 0,
    cars: [],
  });
  const [coverage, setCoverage] = useState({
    summary: "",
    company: {
      summary: "",
      communityCodes: [],
      provinceCodes: [],
      serviceCities: [],
    },
    editCoverageHref: "/admin/company?tab=delivery",
  });
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyCountry, setCompanyCountry] = useState("");
  const [offices, setOffices] = useState([]);
  const [canEditPayments, setCanEditPayments] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const { catalog } = useOperatingCityCatalog(companyCountry);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      setOk("");
      try {
        const res = await fetch(
          `/api/admin/transfer-services?companyId=${encodeURIComponent(companyId)}`
        );
        const body = await res.json();
        if (!res.ok || !body.success) {
          throw new Error(body.message || t("companyProfile.transferLoadFailed"));
        }
        if (cancelled) return;
        const s = body.transferServices || {};
        const defaults = s._formDefaults || {};
        const resolved = s._resolvedArea || body.coverage || {};
        setFleet(
          body.fleet || { hasActiveCars: false, activeCarCount: 0, cars: [] }
        );
        setCoverage(
          body.coverage || {
            summary: "",
            company: {},
            editCoverageHref: "/admin/company?tab=delivery",
          }
        );
        setCompanyEmail(body.companyEmail || "");
        setCompanyCountry(body.companyCountry || "");
        setOffices(
          resolveCompanyOffices({
            offices: body.offices || [],
            coords: body.coords,
          })
        );
        setCanEditPayments(Boolean(body.canEditPayments));
        setCategoryOptions(body.vehicleCategoryOptions || []);
        setTs({
          enabled: Boolean(s.enabled),
          useRentalFleet: Boolean(defaults.useRentalFleet),
          acceptAllTransferRequests: Boolean(s.acceptAllTransferRequests),
          transferCoverageFollowsCompany: Boolean(
            s.transferCoverageFollowsCompany
          ),
          useDifferentEmail: Boolean(defaults.useDifferentEmail),
          transferNotifyEmail: s.transferNotifyEmail || "",
          supplierAgreementAccepted: Boolean(s.supplierAgreementAcceptedAt),
          maxPassengers: s.maxPassengers ?? 7,
          vehicleCategories: Array.isArray(s.vehicleCategories)
            ? s.vehicleCategories
            : ["STANDARD"],
          childSeatsAvailable: s.childSeatsAvailable ?? 0,
          serviceCities: Array.isArray(resolved.serviceCities)
            ? resolved.serviceCities
            : Array.isArray(s.serviceCities)
              ? s.serviceCities
              : [],
          airportsServed: Array.isArray(resolved.airportsServed)
            ? resolved.airportsServed
            : Array.isArray(s.airportsServed)
              ? s.airportsServed
              : [],
          serviceAreas: compactServiceAreas(
            s.serviceAreas || {
              communityCodes: resolved.communityCodes || [],
              provinceCodes: resolved.provinceCodes || [],
            }
          ),
          stripeForPlatformFee: Boolean(s.payments?.stripeForPlatformFee),
          stripeForCompanyAmount: Boolean(s.payments?.stripeForCompanyAmount),
        });
      } catch (err) {
        if (!cancelled) {
          setError(err.message || t("companyProfile.transferLoadFailed"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, t]);

  const toggleCategory = (code) => {
    setTs((prev) => {
      const has = prev.vehicleCategories.includes(code);
      const next = has
        ? prev.vehicleCategories.filter((c) => c !== code)
        : [...prev.vehicleCategories, code];
      return { ...prev, vehicleCategories: next };
    });
  };

  const save = async () => {
    setBusy(true);
    setError("");
    setOk("");
    try {
      const transferServices = {
        enabled: ts.enabled,
        useRentalFleet: Boolean(ts.useRentalFleet),
        acceptAllTransferRequests: Boolean(ts.acceptAllTransferRequests),
        transferCoverageFollowsCompany: Boolean(
          ts.transferCoverageFollowsCompany
        ),
        supplierAgreementAcceptedAt: ts.supplierAgreementAccepted
          ? new Date()
          : null,
        supplierAgreementVersion: ts.supplierAgreementAccepted ? "v1" : "",
        transferNotifyEmail: ts.useDifferentEmail
          ? String(ts.transferNotifyEmail || "").trim()
          : "",
      };
      if (!ts.useRentalFleet) {
        transferServices.maxPassengers = Number(ts.maxPassengers) || 7;
        transferServices.vehicleCategories = ts.vehicleCategories;
        transferServices.childSeatsAvailable =
          Number(ts.childSeatsAvailable) || 0;
      }
      if (!ts.transferCoverageFollowsCompany) {
        transferServices.serviceCities = ts.serviceCities;
        transferServices.airportsServed = ts.airportsServed;
        transferServices.serviceAreas = compactServiceAreas(ts.serviceAreas);
      }
      if (canEditPayments) {
        transferServices.payments = {
          stripeForPlatformFee: Boolean(ts.stripeForPlatformFee),
          stripeForCompanyAmount: Boolean(ts.stripeForCompanyAmount),
        };
      }
      const res = await fetch("/api/admin/transfer-services", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, transferServices }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.message || t("companyProfile.transferSaveFailed"));
      }
      setOk(t("companyProfile.transferSaved"));
    } catch (err) {
      setError(err.message || t("companyProfile.transferSaveFailed"));
    } finally {
      setBusy(false);
    }
  };

  if (!companyId) return null;

  const companySummary =
    coverage?.company?.summary ||
    coverage?.summary ||
    t("companyProfile.serviceAreasNone");

  return (
    <Box sx={adminSurfaceSx(embedded)}>
      <AdminSettingsSection
        title={t("companyProfile.transferTitle")}
        description={t("companyProfile.transferHelp")}
      >
        {loading ? (
          <Stack direction="row" alignItems="center" gap={1.5} sx={{ py: 1 }}>
            <CircularProgress size={22} />
            <Typography variant="body2" color="text.secondary">
              {t("basic.loading", { defaultValue: "Loading…" })}
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={1.75}>
            {error ? <Alert severity="error">{error}</Alert> : null}
            {ok ? <Alert severity="success">{ok}</Alert> : null}

            <FormControlLabel
              control={
                <Switch
                  checked={ts.enabled}
                  onChange={(e) =>
                    setTs((p) => ({ ...p, enabled: e.target.checked }))
                  }
                />
              }
              label={t("companyProfile.transferEnabled")}
              sx={adminReadableTextSx}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={ts.supplierAgreementAccepted}
                  onChange={(e) =>
                    setTs((p) => ({
                      ...p,
                      supplierAgreementAccepted: e.target.checked,
                    }))
                  }
                />
              }
              label={t("companyProfile.transferAgreement")}
              sx={adminReadableTextSx}
            />

            {ts.enabled ? (
              <>
                <Box>
                  <Typography
                    variant="subtitle2"
                    fontWeight={700}
                    sx={{ mb: 0.5, ...adminReadableTextSx }}
                  >
                    {t("companyProfile.transferVehiclesTitle")}
                  </Typography>
                  <RadioGroup
                    value={ts.useRentalFleet ? "fleet" : "manual"}
                    onChange={(e) =>
                      setTs((p) => ({
                        ...p,
                        useRentalFleet: e.target.value === "fleet",
                      }))
                    }
                  >
                    <FormControlLabel
                      value="fleet"
                      control={<Radio size="small" />}
                      label={
                        fleet.hasActiveCars
                          ? t("companyProfile.transferUseRentalFleetRecommended")
                          : t("companyProfile.transferUseRentalFleet")
                      }
                      sx={adminReadableTextSx}
                    />
                    <FormHelperText sx={{ ml: 4, mt: 0, mb: 1 }}>
                      {t("companyProfile.transferUseRentalFleetHelp")}
                    </FormHelperText>
                    <FormControlLabel
                      value="manual"
                      control={<Radio size="small" />}
                      label={t("companyProfile.transferManualFleet")}
                      sx={adminReadableTextSx}
                    />
                    <FormHelperText sx={{ ml: 4, mt: 0 }}>
                      {t("companyProfile.transferManualFleetHelp")}
                    </FormHelperText>
                  </RadioGroup>
                  {ts.useRentalFleet ? (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1, ...adminReadableTextSx }}
                    >
                      {fleet.activeCarCount
                        ? t("companyProfile.transferFleetSummary", {
                            count: fleet.activeCarCount,
                          })
                        : t("companyProfile.transferFleetEmpty")}
                    </Typography>
                  ) : (
                    <Box sx={{ mt: 1.5, ...adminFormGridSx }}>
                      <TextField
                        size="small"
                        type="number"
                        label={t("companyProfile.transferMaxPassengers")}
                        value={ts.maxPassengers}
                        onChange={(e) =>
                          setTs((p) => ({
                            ...p,
                            maxPassengers: e.target.value,
                          }))
                        }
                        sx={adminFieldSx}
                      />
                      <TextField
                        size="small"
                        type="number"
                        label={t("companyProfile.transferChildSeats")}
                        value={ts.childSeatsAvailable}
                        onChange={(e) =>
                          setTs((p) => ({
                            ...p,
                            childSeatsAvailable: e.target.value,
                          }))
                        }
                        sx={adminFieldSx}
                      />
                      <FormControl
                        component="fieldset"
                        variant="standard"
                        sx={{ gridColumn: { xs: "1", sm: "1 / -1" } }}
                      >
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          sx={{ mb: 0.5, ...adminReadableTextSx }}
                        >
                          {t("companyProfile.transferVehicleCategories")}
                        </Typography>
                        <FormGroup row>
                          {(categoryOptions.length
                            ? categoryOptions
                            : [
                                { code: "STANDARD", title: "Standard" },
                                { code: "MINIVAN", title: "Minivan" },
                                { code: "MINIBUS", title: "Minibus" },
                              ]
                          ).map((opt) => (
                            <FormControlLabel
                              key={opt.code}
                              control={
                                <Checkbox
                                  size="small"
                                  checked={ts.vehicleCategories.includes(
                                    opt.code
                                  )}
                                  onChange={() => toggleCategory(opt.code)}
                                />
                              }
                              label={categoryLabel(opt.code, categoryOptions, t)}
                              sx={adminReadableTextSx}
                            />
                          ))}
                        </FormGroup>
                      </FormControl>
                    </Box>
                  )}
                </Box>

                <Box>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={ts.acceptAllTransferRequests}
                        onChange={(e) =>
                          setTs((p) => ({
                            ...p,
                            acceptAllTransferRequests: e.target.checked,
                          }))
                        }
                      />
                    }
                    label={t("companyProfile.transferAcceptAll")}
                    sx={adminReadableTextSx}
                  />
                  <FormHelperText sx={{ ml: 4, mt: 0 }}>
                    {t("companyProfile.transferAcceptAllHelp")}
                  </FormHelperText>
                </Box>

                <Box>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={ts.transferCoverageFollowsCompany}
                        onChange={(e) =>
                          setTs((p) => ({
                            ...p,
                            transferCoverageFollowsCompany: e.target.checked,
                          }))
                        }
                      />
                    }
                    label={t("companyProfile.transferCoverageFollows")}
                    sx={adminReadableTextSx}
                  />
                  <FormHelperText sx={{ ml: 4, mt: 0, mb: 1 }}>
                    {t("companyProfile.transferCoverageFollowsHelp")}
                  </FormHelperText>

                  {ts.transferCoverageFollowsCompany ? (
                    <Box sx={{ ml: { xs: 0, sm: 4 }, mt: 0.5 }}>
                      <Typography variant="body2" sx={{ ...adminReadableTextSx }}>
                        {companySummary}
                      </Typography>
                      <MuiLink
                        component={NextLink}
                        href={
                          coverage.editCoverageHref ||
                          "/admin/company?tab=delivery"
                        }
                        sx={{
                          display: "inline-block",
                          mt: 0.75,
                          ...adminReadableTextSx,
                        }}
                      >
                        {t("companyProfile.transferEditCoverage", {
                          defaultValue: "Edit Coverage",
                        })}
                      </MuiLink>
                    </Box>
                  ) : (
                    <Box sx={{ mt: 1.5 }}>
                      <ServiceAreasPicker
                        country={companyCountry || "ES"}
                        value={ts.serviceAreas}
                        onChange={(next) =>
                          setTs((p) => ({
                            ...p,
                            serviceAreas: compactServiceAreas(next),
                          }))
                        }
                      />
                      <Typography
                        variant="subtitle2"
                        fontWeight={700}
                        sx={{ mt: 2, mb: 1, ...adminReadableTextSx }}
                      >
                        {t("companyProfile.extraCitiesTitle")}
                      </Typography>
                      <OperatingCitiesPicker
                        value={ts.serviceCities}
                        onChange={(next) =>
                          setTs((p) => ({ ...p, serviceCities: next }))
                        }
                        catalog={catalog}
                        country={companyCountry || "ES"}
                        label={t("companyProfile.transferServiceCities")}
                        placeholder={t(
                          "companyProfile.operatingCitiesPlaceholder"
                        )}
                        helperText={t("companyProfile.selectedCitiesCount", {
                          count: ts.serviceCities.length,
                        })}
                      />
                      <Typography
                        variant="subtitle2"
                        fontWeight={700}
                        sx={{ mt: 2, mb: 1, ...adminReadableTextSx }}
                      >
                        {t("companyProfile.coverageMapTitle")}
                      </Typography>
                      <CoverageMapPreview
                        offices={offices}
                        cities={ts.serviceCities}
                        communityCodes={ts.serviceAreas.communityCodes}
                        provinceCodes={ts.serviceAreas.provinceCodes}
                        catalog={catalog}
                        compact
                      />
                    </Box>
                  )}
                </Box>

                <Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 0.5, ...adminReadableTextSx }}
                  >
                    {t("companyProfile.transferContactEmailDefault", {
                      email: companyEmail || "—",
                    })}
                  </Typography>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={ts.useDifferentEmail}
                        onChange={(e) =>
                          setTs((p) => ({
                            ...p,
                            useDifferentEmail: e.target.checked,
                          }))
                        }
                      />
                    }
                    label={t("companyProfile.transferUseDifferentEmail")}
                    sx={adminReadableTextSx}
                  />
                  {ts.useDifferentEmail ? (
                    <TextField
                      size="small"
                      type="email"
                      label={t("companyProfile.transferNotifyEmail")}
                      value={ts.transferNotifyEmail}
                      onChange={(e) =>
                        setTs((p) => ({
                          ...p,
                          transferNotifyEmail: e.target.value,
                        }))
                      }
                      sx={{ ...adminFieldSx, mt: 1, maxWidth: 360 }}
                    />
                  ) : null}
                </Box>

                <Box>
                  <Typography variant="body2" sx={{ ...adminReadableTextSx }}>
                    {t("companyProfile.transferPaymentSummary")}
                  </Typography>
                  {canEditPayments ? (
                    <Stack spacing={0.5} sx={{ mt: 1 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={ts.stripeForPlatformFee}
                            onChange={(e) =>
                              setTs((p) => ({
                                ...p,
                                stripeForPlatformFee: e.target.checked,
                              }))
                            }
                          />
                        }
                        label={t("companyProfile.transferStripePlatform")}
                        sx={adminReadableTextSx}
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={ts.stripeForCompanyAmount}
                            onChange={(e) =>
                              setTs((p) => ({
                                ...p,
                                stripeForCompanyAmount: e.target.checked,
                              }))
                            }
                          />
                        }
                        label={t("companyProfile.transferStripeCompany")}
                        sx={adminReadableTextSx}
                      />
                    </Stack>
                  ) : null}
                </Box>
              </>
            ) : null}

            <Button
              variant="contained"
              onClick={save}
              disabled={busy || loading}
              sx={{
                alignSelf: "flex-start",
                textTransform: "none",
                minWidth: { sm: 220 },
                ...adminReadableTextSx,
              }}
            >
              {t("companyProfile.transferSave")}
            </Button>
          </Stack>
        )}
      </AdminSettingsSection>
    </Box>
  );
}
