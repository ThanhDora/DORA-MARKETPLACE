# Project Review Notes

Review date: 2026-05-05

Scope: Review toan bo repo hien tai gom `Client/` Next.js va `Server/` Express/Prisma. File nay chi ghi nhan loi va huong xu ly; chua sua source code.

## Critical

### Public product APIs leak delivery data

- Location:
  - `Server/src/controllers/product.controller.ts:66`
  - `Server/src/controllers/product.controller.ts:93`
  - `Client/app/seller/page.tsx:249`
- Impact: `/api/products` va `/api/products/:id` dang tra full `Product`, gom `metadata` va `files`. Seller dashboard luu account/key vao `metadata.resources`, nen user chua mua van co the goi public API de lay tai nguyen ban giao.
- Suggested fix: Public product response phai strip cac truong delivery/private nhu `metadata.resources`, account/key credentials va `files`. Chi order owner/seller/admin duoc xem delivery data qua endpoint order/fulfillment co authorization.

### PayPal webhooks are unauthenticated

- Location:
  - `Server/src/controllers/payment.controller.ts:380`
  - `Server/src/controllers/wallet.controller.ts:483`
- Impact: Public request voi `{ orderId, status: "COMPLETED" }` co the mark order paid, deliver hang, cong tien seller hoac complete wallet deposit gia.
- Suggested fix: Verify PayPal webhook bang provider signature/transmission headers hoac capture status from PayPal API. Persist PayPal order/capture id, match amount/currency/reference, va reject request khong xac thuc.

## High

### SePay IPN credits full pending amount even when transfer amount mismatches

- Location: `Server/src/controllers/wallet.controller.ts:455`
- Impact: Neu user tao deposit lon nhung chuyen khoan thieu, code chi log warning va van goi `completeDeposit`, cong theo `walletTx.amount` pending thay vi so tien thuc nhan.
- Suggested fix: Require `transfer_amount` match expected amount exactly or within explicit payment-provider fee policy. Reject/hold mismatched deposits for manual review instead of completing automatically.

### Wallet payment can double charge under concurrent requests

- Location:
  - `Server/src/controllers/payment.controller.ts:160`
  - `Server/src/controllers/payment.controller.ts:215`
- Impact: `order.status` va buyer balance duoc check ngoai transaction; transaction khong update co dieu kien `status = PENDING`. Double-click hoac concurrent request co the debit buyer va credit seller nhieu lan.
- Suggested fix: Move order status and balance checks inside one transaction, lock/update order conditionally from `PENDING` to processing/paid, and make seller credit idempotent by unique ledger reference.

### Deposit completion is not idempotent-safe under concurrent webhooks

- Location: `Server/src/controllers/wallet.controller.ts:240`
- Impact: Hai webhook cung luc co the doc cung mot transaction `PENDING`, roi cung update va increment balance neu khong co guard atomic.
- Suggested fix: Use conditional update/updateMany where `{ id, status: "PENDING" }` and only increment balance when affected row count is 1. Store provider transaction id with unique constraint to dedupe retries.

### Fulfillment does not allocate per-order inventory resources

- Location:
  - `Server/src/services/payment.service.ts:407`
  - `Server/src/services/payment.service.ts:447`
- Impact: Seller nhap nhieu dong `resources`; account delivery co the dua ca danh sach cho mot buyer, con key delivery bo qua `metadata.resources` va fallback sang key gia.
- Suggested fix: Model inventory resources as per-unit records, reserve/decrement them when order is created/paid, and deliver exactly the units assigned to that order.

## Medium

### FILE products have no real upload flow

- Location:
  - `Server/src/validations/product.validation.ts:3`
  - `Server/src/controllers/product.controller.ts:223`
- Impact: Schema create product khong accept `files`, route chi upload images, `uploadFile` middleware khong duoc dung. `ProductFile.createMany` gan nhu khong chay tu UI/API validated, nen FILE product khong co file ban giao that.
- Suggested fix: Add authenticated seller file upload route, validate file metadata in product create/update, and return download links only through authorized order delivery.

### Order status/refund transitions bypass money and stock ledger

- Location: `Server/src/controllers/order.controller.ts:239`
- Impact: Buyer/seller/admin co the chuyen sang mot so trang thai tai chinh nhu `REFUNDED` theo transition hien tai, nhung khong tao refund transaction, khong tru seller balance, khong restore stock.
- Suggested fix: Separate operational status from payment/refund actions. Refund must run through a transactional ledger flow that updates order status, wallet balances, wallet transactions, stock policy and notifications together.

## Verification Run During Review

- `cd Server && npm run test` passed: 4 test files, 12 tests.
- `cd Server && npm run build` passed.
- `cd Server && npm run lint` passed.
- `cd Client && npm run typecheck` passed.
- `cd Client && npm run build` passed when rerun outside sandbox. First sandboxed run failed because Turbopack could not bind a local port under sandbox restrictions.
- `node --test Client/lib/seller-products.test.mjs` passed: 2 tests.

## Notes

- Worktree already had unrelated uncommitted `Client/` changes during review. They were not reverted or modified for this notes file.
- This document is a finding log, not an implementation patch.
