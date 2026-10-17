import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { api, formatApiError } from './api';
import type { Cart, Coupon, Order, Product, Report } from './types';

type View = 'shop' | 'cart' | 'order' | 'admin';

const CART_KEY = 'checkout-rewards:cartId';
const IDEM_PREFIX = 'checkout-rewards:idem:';

function rupees(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function stockLabel(n: number) {
  if (n <= 0) return 'Out of stock';
  if (n <= 3) return `${n} remaining`;
  return `${n} in stock`;
}

function getOrCreateIdempotencyKey(cartId: string) {
  const key = `${IDEM_PREFIX}${cartId}`;
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  sessionStorage.setItem(key, created);
  return created;
}

export function App() {
  const [view, setView] = useState<View>('shop');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Cart | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [coupon, setCoupon] = useState('');
  const [issuedCoupon, setIssuedCoupon] = useState<Coupon | null>(null);
  const [busy, setBusy] = useState(false);
  const [addingProductId, setAddingProductId] = useState<string | null>(null);

  const idempotencyKey = useMemo(
    () => (cart ? getOrCreateIdempotencyKey(cart.id) : ''),
    [cart],
  );

  const loadProducts = useCallback(async () => {
    setProducts(await api.listProducts());
  }, []);

  const ensureCart = useCallback(async () => {
    const stored = localStorage.getItem(CART_KEY);
    if (stored) {
      try {
        const existing = await api.getCart(stored);
        if (existing.status === 'OPEN') {
          setCart(existing);
          return existing;
        }
      } catch {
        localStorage.removeItem(CART_KEY);
      }
    }
    const created = await api.createCart();
    localStorage.setItem(CART_KEY, created.id);
    setCart(created);
    return created;
  }, []);

  useEffect(() => {
    Promise.all([loadProducts(), ensureCart()]).catch((err) => setError(formatApiError(err)));
  }, [ensureCart, loadProducts]);

  async function refreshAdmin() {
    setReport(await api.getReport());
  }

  async function addToCart(event: MouseEvent<HTMLButtonElement>, product: Product) {
    event.preventDefault();
    event.stopPropagation();
    if (addingProductId || busy) return;
    setError(null);
    setAddingProductId(product.id);
    try {
      const openCart = cart?.status === 'OPEN' ? cart : await ensureCart();
      const next = await api.addItem(openCart.id, product.id, 1);
      setCart(next);
      setNotice(`${product.name} has been added to your cart.`);
      await loadProducts();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setAddingProductId(null);
    }
  }

  async function changeQty(productId: string, quantity: number) {
    if (!cart || quantity < 1) return;
    setError(null);
    try {
      setCart(await api.updateItem(cart.id, productId, quantity));
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  async function removeLine(productId: string) {
    if (!cart) return;
    setError(null);
    try {
      setCart(await api.removeItem(cart.id, productId));
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  async function placeOrder() {
    if (!cart) return;
    setBusy(true);
    setError(null);
    try {
      const placed = await api.checkout(cart.id, idempotencyKey, coupon.trim() || undefined);
      localStorage.removeItem(CART_KEY);
      setOrder(placed);
      setNotice('Your order has been placed. A retry of this checkout will not create a duplicate order.');
      setView('order');
      const nextCart = await api.createCart();
      localStorage.setItem(CART_KEY, nextCart.id);
      setCart(nextCart);
      await loadProducts();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function generateCoupon() {
    setBusy(true);
    setError(null);
    try {
      const created = await api.generateCoupon();
      setIssuedCoupon(created);
      setCoupon(created.id);
      setNotice(`Coupon ${created.id} is ready to apply (${created.percentOff}% off).`);
      await refreshAdmin();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (view === 'admin') {
      refreshAdmin().catch((err) => setError(formatApiError(err)));
    }
  }, [view]);

  const oversold = cart?.items.some((item) => item.exceedsInventory) ?? false;

  return (
    <div className="wrap">
      <a href="#main" className="muted">
        Skip to content
      </a>
      <header>
        <div className="brand">
          <strong>Northline Supplies</strong>
          <p>Workplace equipment, priced in rupees</p>
        </div>
        <nav aria-label="Primary">
          {(
            [
              ['shop', 'Catalog'],
              ['cart', `Cart (${cart?.items.reduce((n, i) => n + i.quantity, 0) ?? 0})`],
              ['order', 'Order'],
              ['admin', 'Reports'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-current={view === id ? 'page' : undefined}
              onClick={() => {
                setView(id);
                setError(null);
              }}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main id="main">
        {error ? (
          <div className="banner error" role="alert">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="banner ok toast" role="status">
            {notice}
          </div>
        ) : null}

        {view === 'shop' ? (
          <>
            <h1>Shop</h1>
            <p className="lede">
              Prices and availability are current. Items in your cart are not reserved until you
              complete checkout.
            </p>
            <div className="grid">
              {products.map((product) => {
                const limited = product.availableInventory > 0 && product.availableInventory <= 3;
                const out = product.availableInventory <= 0;
                return (
                  <article className="card" key={product.id}>
                    <span className={`badge ${out ? 'danger' : limited ? 'warn' : ''}`}>
                      {stockLabel(product.availableInventory)}
                    </span>
                    <h2>{product.name}</h2>
                    <p className="muted">SKU {product.id}</p>
                    <p className="price">{rupees(product.unitPrice)}</p>
                    <div className="actions">
                      <button
                        className="primary add-to-cart"
                        type="button"
                        disabled={out || addingProductId === product.id}
                        onClick={(event) => void addToCart(event, product)}
                      >
                        {addingProductId === product.id ? 'Adding…' : 'Add to cart'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        ) : null}

        {view === 'cart' ? (
          <>
            <h1>Your cart</h1>
            <p className="lede">
              Line totals reflect current catalog prices. Placing the order and retrying checkout
              use the same request key, so a delayed response will not charge you twice.
            </p>
            {!cart || cart.items.length === 0 ? (
              <div className="empty">Your cart is empty.</div>
            ) : (
              <div className="split">
                <div className="panel">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Quantity</th>
                        <th>Line total</th>
                        <th>Available</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {cart.items.map((item) => (
                        <tr key={item.productId}>
                          <td>
                            {item.productName}
                            <div className="muted">{rupees(item.unitPrice)} each</div>
                          </td>
                          <td>
                            <input
                              className="qty"
                              type="number"
                              min={1}
                              max={1000}
                              value={item.quantity}
                              aria-label={`Quantity for ${item.productName}`}
                              onChange={(event) => {
                                const next = Number(event.target.value);
                                if (Number.isInteger(next) && next >= 1) void changeQty(item.productId, next);
                              }}
                            />
                          </td>
                          <td>{rupees(item.lineTotal)}</td>
                          <td>
                            {item.exceedsInventory ? (
                              <span className="badge danger">Only {item.availableInventory} left</span>
                            ) : (
                              item.availableInventory
                            )}
                          </td>
                          <td>
                            <button className="secondary" type="button" onClick={() => removeLine(item.productId)}>
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <aside className="panel">
                  <h2>Checkout</h2>
                  <p>Subtotal {rupees(cart.subtotal)}</p>
                  <label htmlFor="coupon">Coupon code (optional)</label>
                  <input
                    id="coupon"
                    value={coupon}
                    onChange={(event) => setCoupon(event.target.value)}
                    placeholder="Enter coupon code"
                  />
                  <p className="muted">
                    Checkout reference
                    <br />
                    <span className="mono">{idempotencyKey}</span>
                  </p>
                  {oversold ? (
                    <div className="banner error">
                      Reduce quantities that exceed available stock before placing the order.
                    </div>
                  ) : null}
                  <div className="actions">
                    <button className="primary" type="button" disabled={busy || oversold} onClick={placeOrder}>
                      {busy ? 'Placing order…' : 'Place order'}
                    </button>
                    <button className="secondary" type="button" disabled={busy || oversold} onClick={placeOrder}>
                      Retry checkout
                    </button>
                  </div>
                </aside>
              </div>
            )}
          </>
        ) : null}

        {view === 'order' ? (
          <>
            <h1>Order confirmation</h1>
            <p className="lede">
              This receipt stores the prices and quantities at the time of purchase. Later catalog
              changes do not alter it.
            </p>
            {!order ? (
              <div className="empty">You have not placed an order in this session.</div>
            ) : (
              <div className="panel">
                <p>
                  <span className="badge">Confirmed</span> <span className="mono">{order.id}</span>
                </p>
                <p className="muted">
                  Payment reference {order.paymentId}
                  {order.couponId ? ` · Coupon ${order.couponId}` : ' · No coupon applied'}
                </p>
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Quantity</th>
                      <th>Unit price</th>
                      <th>Line total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item) => (
                      <tr key={item.productId}>
                        <td>{item.productName}</td>
                        <td>{item.quantity}</td>
                        <td>{rupees(item.unitPrice)}</td>
                        <td>{rupees(item.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p>Subtotal {rupees(order.gross)}</p>
                <p>Discount {rupees(order.discount)}</p>
                <p className="price">Total {rupees(order.net)}</p>
              </div>
            )}
          </>
        ) : null}

        {view === 'admin' ? (
          <>
            <h1>Sales report</h1>
            <p className="lede">
              Issue a milestone coupon when it is due, and review placed orders, revenue, and
              discounts. Refreshing the report does not change any data.
            </p>
            <div className="actions" style={{ marginBottom: 16 }}>
              <button className="primary" type="button" disabled={busy} onClick={generateCoupon}>
                Generate coupon
              </button>
              <button
                className="secondary"
                type="button"
                onClick={() => refreshAdmin().catch((err) => setError(formatApiError(err)))}
              >
                Refresh report
              </button>
            </div>
            {issuedCoupon ? (
              <div className="banner ok">
                Coupon <span className="mono">{issuedCoupon.id}</span> issued for order milestone{' '}
                {issuedCoupon.milestoneOrderCount} ({issuedCoupon.percentOff}% off). Apply it at
                checkout.
              </div>
            ) : null}
            {report ? (
              <>
                <div className="stats">
                  <div className="stat">
                    <span>Orders</span>
                    <strong>{report.totalSuccessfullyPlacedOrders}</strong>
                  </div>
                  <div className="stat">
                    <span>Gross</span>
                    <strong>{rupees(report.grossRevenue)}</strong>
                  </div>
                  <div className="stat">
                    <span>Discounts</span>
                    <strong>{rupees(report.totalDiscountsGranted)}</strong>
                  </div>
                  <div className="stat">
                    <span>Net</span>
                    <strong>{rupees(report.netRevenue)}</strong>
                  </div>
                  <div className="stat">
                    <span>Coupons issued / open / used</span>
                    <strong>
                      {report.coupons.generated} / {report.coupons.available} / {report.coupons.redeemed}
                    </strong>
                  </div>
                </div>
                <div className="panel" style={{ marginTop: 16 }}>
                  <h2>Units sold</h2>
                  {report.purchasedQuantityByProduct.length === 0 ? (
                    <div className="empty">No orders have been placed yet.</div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Quantity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.purchasedQuantityByProduct.map((row) => (
                          <tr key={row.productId}>
                            <td>{row.productName}</td>
                            <td>{row.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            ) : null}
          </>
        ) : null}
      </main>
      <footer className="site-footer">
        <p>
          HTTP API documentation is in <code>checkout-rewards/openapi.yaml</code> and the HTTP API
          section of <code>checkout-rewards/README.md</code>. Request examples:{' '}
          <code>checkout-rewards/examples/api.http</code>.
        </p>
      </footer>
    </div>
  );
}
