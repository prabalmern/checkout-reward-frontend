import type { Cart, Coupon, Order, Product, Report } from './types';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const API_BASE = import.meta.env.VITE_API_BASE ?? '/backend';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = payload?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'UNKNOWN_ERROR',
      error?.message ?? 'Request failed',
      error?.details,
    );
  }

  return (payload?.data ?? payload) as T;
}

export const api = {
  listProducts: () => request<Product[]>('/products'),
  createCart: () => request<Cart>('/carts', { method: 'POST' }),
  getCart: (cartId: string) => request<Cart>(`/carts/${cartId}`),
  addItem: (cartId: string, productId: string, quantity: number) =>
    request<Cart>(`/carts/${cartId}/items`, {
      method: 'POST',
      body: JSON.stringify({ productId, quantity }),
    }),
  updateItem: (cartId: string, productId: string, quantity: number) =>
    request<Cart>(`/carts/${cartId}/items/${productId}`, {
      method: 'PUT',
      body: JSON.stringify({ quantity }),
    }),
  removeItem: (cartId: string, productId: string) =>
    request<Cart>(`/carts/${cartId}/items/${productId}`, { method: 'DELETE' }),
  checkout: (cartId: string, idempotencyKey: string, couponCode?: string) =>
    request<Order>(`/carts/${cartId}/checkout`, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(couponCode ? { couponCode } : {}),
    }),
  getOrder: (orderId: string) => request<Order>(`/orders/${orderId}`),
  generateCoupon: () => request<Coupon>('/admin/coupons/generate', { method: 'POST' }),
  getReport: () => request<Report>('/admin/report'),
};

const CLIENT_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'Please check the quantity and try again.',
  IDEMPOTENCY_KEY_REQUIRED: 'Checkout could not start. Refresh the page and place the order again.',
  EMPTY_CART: 'Your cart is empty. Add an item before placing an order.',
  PAYMENT_FAILED: 'Payment was declined. Your cart and inventory were not charged.',
  PRODUCT_NOT_FOUND: 'That product is not available.',
  CART_NOT_FOUND: 'Your cart could not be found. A new cart will be created on the next add.',
  CART_ITEM_NOT_FOUND: 'That item is no longer in your cart.',
  ORDER_NOT_FOUND: 'That order could not be found.',
  COUPON_NOT_FOUND: 'That coupon code was not recognized.',
  INSUFFICIENT_STOCK: 'There is not enough stock for the requested quantity.',
  CART_ALREADY_CHECKED_OUT: 'This cart has already been converted to an order.',
  COUPON_ALREADY_REDEEMED: 'This coupon has already been used.',
  IDEMPOTENCY_KEY_REUSED: 'This checkout key was already used for a different request.',
  MILESTONE_NOT_REACHED: 'A coupon cannot be issued until the order milestone is reached.',
  COUPON_ALREADY_GENERATED: 'A coupon has already been issued for this milestone.',
  ROUTE_NOT_FOUND: 'That request is not supported.',
  INTERNAL_ERROR: 'Something went wrong. Please try again.',
};

export function formatApiError(error: unknown) {
  if (error instanceof ApiError) {
    return CLIENT_MESSAGES[error.code] ?? error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}
