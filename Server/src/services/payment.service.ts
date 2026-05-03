import { prisma } from '../lib/prisma.js';
import { logger } from '../config/logger.js';
import { createHmac } from 'crypto';
import { Prisma } from '@prisma/client';
import { SePayPgClient } from 'sepay-pg-node';

const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 15000): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
};

export const createMomoPayment = async (orderId: number | string, amount: number, redirectUrl: string, ipnUrl: string) => {
  const partnerCode = process.env.MOMO_PARTNER_CODE;
  const accessKey = process.env.MOMO_ACCESS_KEY;
  const secretKey = process.env.MOMO_SECRET_KEY;
  const endpoint = process.env.MOMO_ENDPOINT || 'https://test-payment.momo.vn/v2/gateway/api/create';

  if (!partnerCode || !accessKey || !secretKey) {
    throw new Error('MoMo configuration missing');
  }

  const orderInfo = `Thanh toan don hang ${orderId}`;
  const requestId = `${orderId}-${Date.now()}`;
  const requestType = 'captureWallet';

  const rawData = `accessKey=${accessKey}&amount=${amount}&extraData=&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
  const signature = createHmac('sha256', secretKey).update(rawData).digest('hex');

  return {
    endpoint,
    method: 'POST',
    body: {
      partnerCode,
      accessKey,
      requestId,
      amount: String(amount),
      orderId,
      orderInfo,
      redirectUrl,
      ipnUrl,
      requestType,
      signature,
      extraData: '',
    },
  };
};

export const verifyMomoSignature = (body: unknown): boolean => {
  const secretKey = process.env.MOMO_SECRET_KEY;
  if (!secretKey) return false;
  if (!body || typeof body !== 'object') return false;
  const payload = body as Record<string, unknown>;
  const orderId = payload.orderId;
  const amount = payload.amount;
  const orderInfo = payload.orderInfo;
  const orderType = payload.orderType;
  const transId = payload.transId;
  const resultCode = payload.resultCode;
  const requestId = payload.requestId;
  const signatureValue = payload.signature;

  if (orderId == null || amount == null || resultCode == null) return false;

  const rawData = `accessKey=${process.env.MOMO_ACCESS_KEY}&amount=${String(amount)}&extraData=&orderId=${String(orderId)}&orderInfo=${String(orderInfo || '')}&orderType=${String(orderType || '')}&partnerCode=${process.env.MOMO_PARTNER_CODE}&requestId=${String(requestId || '')}&resultCode=${String(resultCode)}&transId=${String(transId || '')}`;
  const signature = createHmac('sha256', secretKey).update(rawData).digest('hex');

  return signature === String(signatureValue || '');
};

export const createSePayPayment = async (orderId: number | string, amount: number, frontendSuccessUrl: string, sepayReturnUrl?: string) => {
  const merchantId = process.env.SEPAY_MERCHANT_ID ?? process.env.SEPAY_TMN_CODE;
  const secretKey = process.env.SEPAY_SECRET_KEY ?? process.env.SEPAY_HASH_SECRET;
  const sepayEnv = (process.env.SEPAY_ENV || 'sandbox').toLowerCase();
  const env = sepayEnv === 'production' ? 'production' : 'sandbox';

  if (!merchantId || !secretKey) {
    throw new Error('SePay configuration missing');
  }

  const client = new SePayPgClient({
    env,
    merchant_id: merchantId,
    secret_key: secretKey,
  });

  const checkoutURL = client.checkout.initCheckoutUrl();
  const failedUrl = frontendSuccessUrl.replace(/\/success$/, '/failed');

  const checkoutFormFields = client.checkout.initOneTimePaymentFields({
    operation: 'PURCHASE',
    payment_method: 'BANK_TRANSFER',
    order_invoice_number: String(orderId),
    order_amount: Math.round(amount),
    currency: 'VND',
    order_description: `Thanh toan don hang #${orderId}`,
    success_url: sepayReturnUrl ?? frontendSuccessUrl,
    error_url: failedUrl,
    cancel_url: failedUrl,
  });

  return {
    paymentUrl: checkoutURL,
    method: 'POST' as const,
    body: checkoutFormFields as Record<string, unknown>,
    orderId,
    secretKey,
  };
};

const SEPAY_SIGNED_FIELDS = [
  'merchant', 'env', 'operation', 'payment_method', 'order_amount',
  'currency', 'order_invoice_number', 'order_description', 'customer_id',
  'agreement_id', 'agreement_name', 'agreement_type', 'agreement_payment_frequency',
  'agreement_amount_per_payment', 'success_url', 'error_url', 'cancel_url', 'order_id',
];

export function verifySePaySignature(params: Record<string, string>, secretKey: string): boolean {
  const receivedSignature = params.signature;
  if (!receivedSignature) return false;

  const signed: string[] = [];
  for (const field of SEPAY_SIGNED_FIELDS) {
    if (params[field] === undefined || params[field] === null) continue;
    signed.push(`${field}=${params[field]}`);
  }

  const hmac = createHmac('sha256', secretKey);
  hmac.update(signed.join(','));
  const expectedSignature = hmac.digest('base64');

  return expectedSignature === receivedSignature;
}

export const createPayPalPayment = async (orderId: number | string, amount: number, redirectUrl: string) => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const mode = process.env.PAYPAL_MODE || 'sandbox';

  if (!clientId || !clientSecret) {
    throw new Error('PayPal configuration missing');
  }

  const baseUrl = mode === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';

  const authResponse = await fetchWithTimeout(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });

  const authData = await authResponse.json() as { access_token?: string };
  const access_token = authData.access_token;
  if (!access_token) {
    throw new Error('Failed to obtain PayPal access token');
  }

  const orderResponse = await fetchWithTimeout(`${baseUrl}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${access_token}`,
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: orderId,
        amount: {
          currency_code: 'USD',
          value: (amount / (process.env.USD_VND_RATE ? Number(process.env.USD_VND_RATE) : 24000)).toFixed(2),
        },
      }],
      application_context: {
        return_url: redirectUrl,
        cancel_url: redirectUrl,
      },
    }),
  });

  const order = await orderResponse.json() as { id?: string; links?: Array<{ rel: string; href: string }> };
  const approvalUrl = order.links?.find((l) => l.rel === 'approve')?.href;

  return { approvalUrl, orderId: order.id };
};

const SEPAY_API_BASE = 'https://my.sepay.vn/userapi';
const SEPAY_QR_BASE = 'https://qr.sepay.vn/img';

export interface SePayBankAccount {
  id: string;
  account_holder_name: string;
  account_number: string;
  bank_short_name: string;
  bank_full_name: string;
  bank_bin: string;
  bank_code: string;
  active: string;
}

export async function fetchSePayBankAccounts(): Promise<SePayBankAccount[]> {
  const apiToken = process.env.SEPAY_API_TOKEN;
  if (!apiToken) return [];

  try {
    const response = await fetch(`${SEPAY_API_BASE}/bankaccounts/list`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
    });
    if (!response.ok) return [];
    const data = (await response.json()) as {
      status: number;
      bankaccounts?: SePayBankAccount[];
    };
    return (data.bankaccounts ?? []).filter(
      (acc) => acc.active === '1' && acc.account_number,
    );
  } catch {
    return [];
  }
}

export function getSePayBankAccountFromEnv() {
  return {
    accountNumber: process.env.BANK_ACCOUNT || '',
    bankName: process.env.BANK_NAME || 'TPBank',
    bankBin: process.env.BANK_BIN || '970418',
  };
}

export function getSePayQRUrl(params: {
  accountNumber: string;
  bankName: string;
  amount: number;
  description: string;
}): string {
  const url = new URL(SEPAY_QR_BASE);
  url.searchParams.set('acc', params.accountNumber);
  url.searchParams.set('bank', params.bankName);
  url.searchParams.set('amount', String(Math.round(params.amount)));
  url.searchParams.set('des', params.description.slice(0, 50));
  return url.toString();
}

let cachedSePayBankInfo: { accountNumber: string; bankName: string; bankBin: string } | null = null;
let cachedSePayBankInfoAt = 0;

export async function fetchSePayMerchantBankInfo(): Promise<{ accountNumber: string; bankName: string; bankBin: string } | null> {
  if (cachedSePayBankInfo && Date.now() - cachedSePayBankInfoAt < 24 * 60 * 60 * 1000) {
    return cachedSePayBankInfo;
  }

  const merchantId = process.env.SEPAY_MERCHANT_ID;
  const secretKey = process.env.SEPAY_SECRET_KEY;

  if (!merchantId || !secretKey) return null;

  try {
    const client = new SePayPgClient({
      env: (process.env.SEPAY_ENV || 'sandbox').toLowerCase() === 'production' ? 'production' : 'sandbox',
      merchant_id: merchantId,
      secret_key: secretKey,
    });

    const fields = client.checkout.initOneTimePaymentFields({
      operation: 'PURCHASE',
      payment_method: 'BANK_TRANSFER',
      order_invoice_number: `BANKINFO_FETCH_${Date.now()}`,
      order_amount: 1000,
      currency: 'VND',
      order_description: 'Fetch bank info',
    });

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    }

    const response = await fetch(client.checkout.initCheckoutUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://sepay.vn/',
      },
      body: params.toString(),
    });

    const html = await response.text();

    const qrMatch = html.match(/https:\/\/qr\.sepay\.vn\/img\?[^"\s]+/);
    if (!qrMatch) return null;

    const qrUrl = new URL(qrMatch[0]);
    const bankBin = qrUrl.searchParams.get('bank') || '';
    const accountNumber = qrUrl.searchParams.get('acc') || '';

    const altMatch = html.match(/<img[^>]*banklogo[^>]*alt="([^"]+)"[^>]*>/i);
    const bankName = altMatch ? altMatch[1] : '';

    if (!bankBin || !accountNumber) return null;

    cachedSePayBankInfo = { accountNumber, bankName, bankBin };
    cachedSePayBankInfoAt = Date.now();
    logger.info(`SePay bank info fetched: ${bankName} ${accountNumber} (BIN ${bankBin})`);
    return cachedSePayBankInfo;
  } catch {
    logger.warn('Failed to fetch SePay merchant bank info');
    return cachedSePayBankInfo;
  }
}

export interface DeliverOrderResult {
  orderId: number;
  userId: number;
  notification: {
    id: number;
    title: string;
    content: string;
    type: string;
    createdAt: Date;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toDeliveryText(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => toDeliveryText(item))
      .filter((item): item is string => Boolean(item));
    return parts.length ? parts.join(', ') : null;
  }
  return null;
}

function fieldLabel(key: string): string {
  const normalized = key.toLowerCase().replace(/[_\s-]+/g, '');
  const labels: Record<string, string> = {
    email: 'Email',
    username: 'Username',
    user: 'Username',
    login: 'Đăng nhập',
    loginid: 'Đăng nhập',
    password: 'Mật khẩu',
    pass: 'Mật khẩu',
    pin: 'PIN',
    otp: 'OTP',
    code: 'Mã',
    key: 'Key',
    licensekey: 'License key',
    profile: 'Profile',
    plan: 'Gói',
    package: 'Gói',
    note: 'Ghi chú',
    url: 'Link',
    loginurl: 'Link đăng nhập',
    website: 'Website',
    server: 'Server',
    region: 'Khu vực',
  };
  return labels[normalized] ?? key;
}

function extractDeliveryFields(
  value: unknown,
  fields: Array<{ label: string; value: string }>,
  seen = new Set<string>(),
) {
  if (!isRecord(value)) return;

  Object.entries(value).forEach(([key, rawValue]) => {
    if (isRecord(rawValue)) {
      extractDeliveryFields(rawValue, fields, seen);
      return;
    }

    const normalized = key.toLowerCase().replace(/[_\s-]+/g, '');
    const text = toDeliveryText(rawValue);
    if (!text) return;
    if (seen.has(`${normalized}:${text}`)) return;
    seen.add(`${normalized}:${text}`);
    fields.push({ label: fieldLabel(key), value: text });
  });
}

function buildAccountDeliveryData(metadata: unknown): Prisma.InputJsonObject {
  const source = isRecord(metadata) ? metadata : {};
  const fields: Array<{ label: string; value: string }> = [];
  const seen = new Set<string>();

  const directString =
    toDeliveryText(source.credentials)
    ?? toDeliveryText(source.accountCredentials)
    ?? toDeliveryText(source.accountText)
    ?? toDeliveryText(source.deliveryText);

  [
    source.credentials,
    source.account,
    source.accountInfo,
    source.accountDetails,
    source.deliveryInfo,
    source.deliveryData,
    source.resourceInfo,
    source.resource,
    source.login,
    source.details,
  ].forEach((entry) => {
    extractDeliveryFields(entry, fields, seen);
  });

  extractDeliveryFields(source, fields, seen);

  const payload: Record<string, Prisma.InputJsonValue> = {
    type: 'ACCOUNT',
    fields,
  };
  if (directString) {
    payload.credentials = directString;
  } else if (!fields.length) {
    payload.credentials = 'Thông tin tài khoản đã sẵn sàng trong đơn hàng.';
  }
  return payload as Prisma.InputJsonObject;
}

function buildKeyDeliveryData(metadata: unknown): Prisma.InputJsonObject {
  const source = isRecord(metadata) ? metadata : {};
  const fromArray = Array.isArray(source.keys)
    ? source.keys.map((item) => toDeliveryText(item)).filter((item): item is string => Boolean(item))
    : [];
  const singleKey =
    toDeliveryText(source.licenseKey)
    ?? toDeliveryText(source.key)
    ?? toDeliveryText(source.activationKey);

  const keys = fromArray.length ? fromArray : singleKey ? [singleKey] : ['Generated license key for this order'];
  return { type: 'KEY', keys } as Prisma.InputJsonObject;
}

export const deliverOrder = async (orderId: number) => {
  const result = await prisma.$transaction(async (tx): Promise<DeliverOrderResult | null> => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              include: { files: true },
            },
          },
        },
      },
    });

    if (!order || order.status !== 'PAID') return null;

    await tx.order.update({
      where: { id: orderId },
      data: { status: 'DELIVERING' },
    });

    const deliveryData: Record<string, Prisma.InputJsonValue> = {};

    for (const item of order.items) {
      if (item.product.type === 'ACCOUNT') {
        deliveryData[String(item.productId)] = buildAccountDeliveryData(item.product.metadata);
      } else if (item.product.type === 'KEY') {
        deliveryData[String(item.productId)] = buildKeyDeliveryData(item.product.metadata);
      } else if (item.product.type === 'FILE') {
        deliveryData[String(item.productId)] = {
          type: 'FILE',
          files: item.product.files.map(f => ({
            name: f.fileName,
            url: f.downloadUrl,
            size: f.fileSize,
          })),
        } as Prisma.InputJsonObject;
      }
    }

    const notification = await tx.notification.create({
      data: {
        userId: order.userId,
        title: 'Đơn hàng đã được giao',
        content: `Đơn hàng #${orderId} đã được giao thành công. Mở trang đơn hàng để nhận sản phẩm.`,
        type: 'ORDER',
        metadata: { orderId, deliveryData } as Prisma.InputJsonObject,
      },
    });

    await tx.order.update({
      where: { id: orderId },
      data: { status: 'DELIVERED' },
    });

    return {
      orderId: order.id,
      userId: order.userId,
      notification: {
        id: notification.id,
        title: notification.title,
        content: notification.content,
        type: notification.type,
        createdAt: notification.createdAt,
      },
    };
  });

  if (result) {
    logger.info(`Order ${orderId} delivered successfully`);
  }

  return result;
};
