/**
 * Car gallery: cover stays in `photoUrl` for older readers; extra shots in `photos`.
 */

export const MAX_CAR_PHOTOS = 8;

function trimId(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Unique public ids, cover first. Empty `photos` falls back to `photoUrl`.
 * @param {{ photoUrl?: string, photos?: string[] }|null} car
 * @returns {string[]}
 */
export function listCarPhotos(car) {
  const cover = trimId(car?.photoUrl);
  const extras = Array.isArray(car?.photos)
    ? car.photos.map(trimId).filter(Boolean)
    : [];
  const ordered = extras.length ? extras : cover ? [cover] : [];
  if (cover && !ordered.includes(cover)) ordered.unshift(cover);
  const seen = new Set();
  const unique = [];
  for (const id of ordered) {
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }
  return unique.slice(0, MAX_CAR_PHOTOS);
}

/**
 * Persist both fields from a list of public ids.
 * @param {string[]} ids
 * @returns {{ photos: string[], photoUrl: string }}
 */
export function photosForSave(ids) {
  const photos = listCarPhotos({ photos: ids });
  return {
    photos,
    photoUrl: photos[0] || "",
  };
}
