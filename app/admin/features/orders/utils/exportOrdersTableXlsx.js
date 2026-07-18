/**
 * Client-only Excel export for admin orders table (SheetJS / xlsx).
 */
export async function downloadOrdersTableXlsx(aoa, { filename = "orders.xlsx", sheetName = "Orders" } = {}) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename);
}
