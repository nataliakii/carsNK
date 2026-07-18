export const ORDER_STATUS = {
  ACTIVE: "ACTIVE",
  PAID_AND_CLOSED: "PAID_AND_CLOSED",
};

export function isOrderPaidAndClosed(status) {
  return status === ORDER_STATUS.PAID_AND_CLOSED;
}
