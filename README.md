# Checkout & Rewards UI

Small React (Vite) client for the checkout-rewards HTTP API. It is a demo of catalog, cart, idempotent checkout, coupons, and the admin report — not a production storefront.

## Run

Start the API first:

```bash
cd ../checkout-rewards
npm install
npm run dev
```

Then the UI:

```bash
cd ../web
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/backend/*` to `http://localhost:3000`.

## What it shows

- Catalog from `GET /products` with live stock
- Cart add / quantity / remove
- Checkout with optional coupon and a stable `Idempotency-Key` (Place order and Retry send the same key)
- Last order snapshot
- Admin coupon generate and read-only report
