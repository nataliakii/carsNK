export function slugifyCompanyName(name) {
  const base = String(name || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "company";
}

export async function ensureUniqueCompanySlug(Company, desired, excludeId) {
  const root = slugifyCompanyName(desired);
  let candidate = root;
  let n = 2;
  while (n < 100) {
    const query = { slug: candidate };
    if (excludeId) query._id = { $ne: excludeId };
    const existing = await Company.findOne(query).select("_id").lean();
    if (!existing) return candidate;
    candidate = `${root}-${n}`;
    n += 1;
  }
  return `${root}-${Date.now()}`;
}
