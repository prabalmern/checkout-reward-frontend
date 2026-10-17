export type Product = {
  id: string;
  name: string;
  unitPrice: string;
  unitPricePaise: number;
  availableInventory: number;
};

export type CartItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  unitPricePaise: number;
  lineTotal: string;
  lineTotalPaise: number;
  availableInventory: number;
  exceedsInventory: boolean;
};

export type Cart = {
  id: string;
  status: 'OPEN' | 'CHECKED_OUT';
  orderId: string | null;
  createdAt: string;
  items: CartItem[];
  subtotal: string;
  subtotalPaise: number;
  pricedUsing: 'current_catalog';
};

export type OrderItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  unitPricePaise: number;
  lineTotal: string;
  lineTotalPaise: number;
};

export type Order = {
  id: string;
  cartId: string;
  status: 'PLACED';
  couponId: string | null;
  paymentId: string;
  createdAt: string;
  items: OrderItem[];
  gross: string;
  grossPaise: number;
  discount: string;
  discountPaise: number;
  net: string;
  netPaise: number;
};

export type Coupon = {
  id: string;
  milestoneOrderCount: number;
  percentOff: number;
  status: 'AVAILABLE' | 'REDEEMED';
  redeemedByOrderId: string | null;
  createdAt: string;
};

export type Report = {
  totalSuccessfullyPlacedOrders: number;
  purchasedQuantityByProduct: Array<{
    productId: string;
    productName: string;
    quantity: number;
  }>;
  grossRevenue: string;
  grossRevenuePaise: number;
  totalDiscountsGranted: string;
  totalDiscountsGrantedPaise: number;
  netRevenue: string;
  netRevenuePaise: number;
  coupons: { generated: number; available: number; redeemed: number };
};
