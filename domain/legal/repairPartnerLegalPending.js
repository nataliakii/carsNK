/**
 * Decision for the one-record Spain repair.
 * The script mutates only when `apply` is true. A second run is a no-op.
 */

const REPAIR_TARGET_COMPANY_ID = "6aaedf3e4cad862dc29d7b1a";

function planOneRecordPendingRepair({ company, profile, now = new Date() }) {
  const companyId = String(company?._id || profile?.companyId || "");
  const docs = (profile?.documents || []).filter((doc) => doc?.storageRef);
  const documents = docs.map((doc) => ({
    kind: doc.kind,
    storageRef: doc.storageRef,
  }));
  const base = {
    companyId,
    profileId: profile?._id ? String(profile._id) : "",
    documents,
    notifies: false,
  };

  if (companyId !== REPAIR_TARGET_COMPANY_ID) {
    return { ...base, apply: false, code: "not_target" };
  }
  if (!company || !profile) {
    return { ...base, apply: false, code: "missing" };
  }
  if (profile.verificationStatus !== "DRAFT") {
    return { ...base, apply: false, code: "not_draft" };
  }
  if (!docs.length) {
    return { ...base, apply: false, code: "no_documents" };
  }

  const legalName =
    String(profile.legalName || "").trim() || String(company.name || "").trim();

  return {
    ...base,
    apply: true,
    code: "repair",
    set: {
      verificationStatus: "PENDING_VERIFICATION",
      verificationStatusAt: now,
      submittedAt: profile.submittedAt || now,
      legalName,
    },
    pushHistory: {
      from: "DRAFT",
      to: "PENDING_VERIFICATION",
      at: now,
      byEmail: "repair-script",
      reason:
        "Repair: evidence uploaded; submit gate previously blocked without legalName",
    },
  };
}

module.exports = {
  REPAIR_TARGET_COMPANY_ID,
  planOneRecordPendingRepair,
};
