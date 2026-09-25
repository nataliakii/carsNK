/**
 * Presentation view over ONE `/api/admin/inbox/pending` response.
 *
 * Navbar badges and the inbox bell both read from here, so the Orders badge,
 * the Company setup badge and the bell total can never disagree.
 */

const ORDERS_HREF = "/admin/orders";
const TRANSFERS_HREF = "/admin/orders?tab=transfers";

function count(value) {
  return Math.max(0, Number(value) || 0);
}

/**
 * @param {object} inbox - server response (or the hook snapshot of it)
 * @returns {{ orders: number, companySetup: number, bell: number }}
 *   orders — Orders nav badge (rentals only, unchanged Greece/Spain math)
 *   companySetup — Legal / Company setup nav badge
 *   bell — booking tasks + company setup tasks
 */
/**
 * The Orders navbar badge and the Car rentals tab badge.
 * Both must call this. Do not count the raw rentals field separately.
 */
export function contractorRentalActionBadge(inbox) {
  return adminInboxBadges(inbox).orders;
}

export function adminInboxBadges(inbox) {
  const rentals = count(inbox?.rentals);
  const transfers = count(inbox?.transfers);
  const bookings = inbox?.bookings
    ? count(inbox.bookings.count)
    : rentals + transfers;
  const companySetup = count(inbox?.companySetup?.count);
  const orders = inbox?.ordersBadge === undefined
    ? rentals
    : count(inbox.ordersBadge);
  return {
    orders,
    companySetup,
    bell: Number.isFinite(Number(inbox?.total))
      ? count(inbox.total)
      : bookings + companySetup,
  };
}

/**
 * Bell menu content. Every item deep-links to the screen that clears it.
 *
 * @param {object} inbox
 * @param {{ includeCompanySetup?: boolean }} [options]
 */
export function adminInboxGroups(inbox, options = {}) {
  const rentals = count(inbox?.rentals);
  const transfers = count(inbox?.transfers);
  const groups = [
    {
      id: "bookings",
      labelKey: "inbox.bookings",
      label: "Bookings",
      count: inbox?.bookings ? count(inbox.bookings.count) : rentals + transfers,
      items: [
        {
          id: "rentals",
          titleKey: "header.carRentals",
          title: "Car rentals",
          count: contractorRentalActionBadge(inbox),
          href: ORDERS_HREF,
        },
        {
          id: "transfers",
          titleKey: "header.transfers",
          title: "Transfers",
          count: transfers,
          href: TRANSFERS_HREF,
        },
      ],
    },
  ];

  if (options.includeCompanySetup !== false) {
    const tasks = Array.isArray(inbox?.companySetup?.tasks)
      ? inbox.companySetup.tasks
      : [];
    groups.push({
      id: "companySetup",
      labelKey: "inbox.companySetup",
      label: "Company setup",
      count: count(inbox?.companySetup?.count),
      items: tasks.map((item) => ({ ...item, count: 0 })),
    });
  }

  return groups;
}
