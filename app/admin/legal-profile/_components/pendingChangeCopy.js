import { coercePendingChangeList, formatPendingChangeValue } from "@/domain/legal/verifiedProfileChanges";

export function pendingChangeFieldLabel(t, field) {
  return t(`partnerLegal.form.confirmations.${field}.short`, {
    defaultValue: t(`partnerLegal.form.fields.${field}.label`, {
      defaultValue: field,
    }),
  });
}

export function pendingChangeLine(t, change) {
  const label = pendingChangeFieldLabel(t, change.field);
  return `${label}: ${formatPendingChangeValue(change.verified)} → ${formatPendingChangeValue(change.proposed)}`;
}

export function pendingChangesFromSource(pending) {
  return coercePendingChangeList(pending);
}
