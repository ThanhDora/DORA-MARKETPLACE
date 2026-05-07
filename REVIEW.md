# Project Review

Date: 2026-05-06

## Findings

### 1. High: External payment methods are blocked at request validation

`POST /api/payments/create` is validated by a schema that only allows `method: 'PLATFORM'`, while the controller contains branches for `MOMO`, `SEPAY`, `PAYPAL`, and `BANK_TRANSFER`.

Impact:
- Any non-wallet checkout flow will fail with `400` before controller logic runs.

References:
- `Server/src/validations/order.validation.ts:28`
- `Server/src/routes/payment.routes.ts:12`
- `Server/src/controllers/payment.controller.ts:174`

### 2. High: SePay failure redirect points to a missing client route

The backend redirects SePay failures to `/payment/failed`, but the client only provides an order-scoped failure page at `/order/[id]/failed`.

Impact:
- Failed SePay payment returns users to a `404` page instead of a recovery flow.

References:
- `Server/src/controllers/payment.controller.ts:359`
- `Server/src/controllers/payment.controller.ts:364`
- `Server/src/controllers/payment.controller.ts:376`
- `Client/app/order/[id]/failed/page.tsx:8`

### 3. Medium: Paid orders can retain the wrong payment method

The shared webhook path `markOrderPaidAndEmit` updates order status to `PAID` but does not persist the actual payment method. Since orders are created with `paymentMethod` defaulting to `PLATFORM`, successful external payments can still be stored as `PLATFORM`.

Impact:
- Payment history and admin/accounting data can be incorrect for `MOMO`, `SEPAY`, and `PAYPAL`.

References:
- `Server/src/controllers/payment.controller.ts:61`
- `Server/src/controllers/payment.controller.ts:76`
- `Server/src/controllers/payment.controller.ts:174`
- `Server/src/controllers/payment.controller.ts:301`

### 4. Medium: Auto-cancelled orders restore stock without realtime stock broadcast

The cleanup job returns stock in the database when pending orders expire, but unlike manual cancellation it does not emit `product:stock:update` or `product:metrics:update`.

Impact:
- Realtime client state can display stale stock after timeout-based cancellation.

References:
- `Server/src/jobs/orderCleanup.job.ts:45`
- `Server/src/jobs/orderCleanup.job.ts:63`
- `Server/src/controllers/order.controller.ts:56`
- `Client/components/RealtimeProvider.tsx:180`

## Assumption

- External payment methods are intended product behavior, not dead code, because they are exposed by `/payments/methods` and implemented in the payment controller.

## Verification

- `Client`: `npm run typecheck` passed.
- `Client`: `npm run build` passed outside sandbox. The earlier Turbopack failure was sandbox-related, not a code failure.
- `Server`: `npm run lint` passed.
- `Server`: `npm test` passed (`12/12` tests).
- `Server`: `npm run build` passed.
