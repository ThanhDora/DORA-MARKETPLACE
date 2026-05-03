export const CART_UPDATED_EVENT = "dora-marketplace-cart-updated";

export function notifyCartChanged() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(CART_UPDATED_EVENT));
}
