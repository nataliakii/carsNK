"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Box, CircularProgress, Stack, Typography } from "@mui/material";
import { useSession } from "next-auth/react";
import { useTranslation } from "react-i18next";
import CompanyContactsCard from "@/app/admin/shared/components/CompanyContactsCard";
import EditCompanyContactsDialog from "@/app/admin/shared/components/EditCompanyContactsDialog";
import CompanyStorefrontCard from "@/app/admin/shared/components/CompanyStorefrontCard";
import CompanyTransferServicesCard from "@/app/admin/shared/components/CompanyTransferServicesCard";
import CompanyRentalPaymentsCard from "@/app/admin/shared/components/CompanyRentalPaymentsCard";
import PartnerComplianceCard from "@/app/admin/shared/components/PartnerComplianceCard";
import { useAdminViewAs } from "@app/hooks/useAdminViewAs";
import {
  meetingContactsFromCompany,
  meetingContactsUpdatePayload,
} from "@/domain/company/meetingContacts";
import { useMainContext } from "@app/Context";

export default function CompanyProfileSection({ companyId: companyIdProp } = {}) {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const { updateCompanyInContext } = useMainContext();
  const { active: viewAsActive, company: viewAsCompany } = useAdminViewAs();
  const ownerId =
    (companyIdProp && String(companyIdProp)) ||
    (viewAsActive && viewAsCompany?._id
      ? String(viewAsCompany._id)
      : session?.user?.ownerId
        ? String(session.user.ownerId)
        : "");

  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editTel, setEditTel] = useState("");
  const [editBaseLat, setEditBaseLat] = useState("");
  const [editBaseLon, setEditBaseLon] = useState("");
  const [editMeetingContacts, setEditMeetingContacts] = useState(() =>
    meetingContactsFromCompany(null)
  );

  const load = useCallback(async () => {
    if (!ownerId) {
      setCompany(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/company/${ownerId}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || t("companyProfile.loadFailed"));
      setCompany(body);
    } catch (err) {
      setError(err.message || t("companyProfile.loadFailed"));
      setCompany(null);
    } finally {
      setLoading(false);
    }
  }, [ownerId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const openEdit = () => {
    if (!company) return;
    setEditName(company.name || "");
    setEditEmail(company.email || "");
    setEditTel(company.tel || "");
    setEditBaseLat(company?.coords?.lat != null ? String(company.coords.lat) : "");
    setEditBaseLon(company?.coords?.lon != null ? String(company.coords.lon) : "");
    setEditMeetingContacts(meetingContactsFromCompany(company));
    setEditOpen(true);
  };

  const saveContacts = async () => {
    if (!ownerId) return;
    setBusy(true);
    setError("");
    setOk("");
    try {
      const meetingPayload = meetingContactsUpdatePayload(editMeetingContacts);
      const res = await fetch(`/api/company/${ownerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          email: editEmail,
          tel: editTel,
          coords: {
            lat: editBaseLat,
            lon: editBaseLon,
          },
          ...meetingPayload,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || body.message || "Failed");
      setCompany(body);
      setEditOpen(false);
      setOk(t("companyProfile.updated", { name: body.name }));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("company-contacts-updated"));
      }
    } catch (err) {
      setError(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ px: { xs: 1, md: 2 }, pb: 6, pt: { xs: 2, md: 2 }, maxWidth: { xs: "100%", md: 960 }, mx: "auto", overflowX: "hidden" }}>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>
        {t("companyProfile.title")}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t("companyProfile.subtitle")}
      </Typography>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      ) : null}
      {ok ? (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setOk("")}>
          {ok}
        </Alert>
      ) : null}

      <PartnerComplianceCard />

      <Stack spacing={2.5}>
        <CompanyContactsCard company={company} onEdit={openEdit} canEdit />

        <CompanyStorefrontCard
          company={company}
          onEditBaseLocation={openEdit}
          onSaved={(updated) => {
            setCompany(updated);
            setOk(t("companyProfile.updated", { name: updated.name }));
            if (updated?._id) {
              updateCompanyInContext(String(updated._id), updated);
            }
          }}
        />

        <CompanyTransferServicesCard companyId={ownerId} />

        <CompanyRentalPaymentsCard
          company={company}
          onSaved={(updated) => {
            setCompany(updated);
            setOk(t("companyProfile.updated", { name: updated.name }));
          }}
        />
      </Stack>

      <EditCompanyContactsDialog
        open={editOpen}
        busy={busy}
        name={editName}
        email={editEmail}
        tel={editTel}
        baseLat={editBaseLat}
        baseLon={editBaseLon}
        meetingContacts={editMeetingContacts}
        onNameChange={setEditName}
        onEmailChange={setEditEmail}
        onTelChange={setEditTel}
        onBaseLatChange={setEditBaseLat}
        onBaseLonChange={setEditBaseLon}
        onMeetingContactsChange={setEditMeetingContacts}
        onClose={() => setEditOpen(false)}
        onSave={saveContacts}
      />
    </Box>
  );
}
