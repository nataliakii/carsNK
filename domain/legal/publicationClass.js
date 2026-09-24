/**
 * Editorial updates do not ask suppliers to accept again.
 * Material updates to the supplier package do, as one inbox task.
 */

import { MASTER_AGREEMENT_PACKAGE } from "./documentTypes";

export const PUBLICATION_CHANGE = Object.freeze({
  EDITORIAL: "editorial",
  MATERIAL: "material",
});

export function normalizePublicationChange(value) {
  return value === PUBLICATION_CHANGE.EDITORIAL
    ? PUBLICATION_CHANGE.EDITORIAL
    : PUBLICATION_CHANGE.MATERIAL;
}

export function reacceptanceRequired({ documentType, changeClass } = {}) {
  if (normalizePublicationChange(changeClass) === PUBLICATION_CHANGE.EDITORIAL) {
    return false;
  }
  return MASTER_AGREEMENT_PACKAGE.includes(documentType);
}

/**
 * Several material supplier documents still produce one legal task.
 */
export function legalReacceptanceTask(changes = []) {
  const material = (changes || []).filter((change) =>
    reacceptanceRequired(change)
  );
  if (!material.length) return [];
  return [
    {
      id: "TERMS_UPDATE_REQUIRED",
      documentTypes: material.map((change) => change.documentType),
    },
  ];
}

/**
 * A new published version never rewrites a stored acceptance or booking snapshot.
 */
export function preservedHistoricalRecord(previous, nextVersion) {
  return {
    unchanged: previous,
    nextVersion,
    previousUntouched: previous === previous && nextVersion !== previous,
  };
}
