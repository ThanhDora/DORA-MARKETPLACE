import { Request, Response } from 'express';
import { PaymentMethod, Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../lib/prisma.js';
import { sendSuccess, sendList } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';
import {
  createMomoPayment,
  createPayPalPayment,
  verifyMomoSignature,
  verifySePaySignature,
  fetchSePayMerchantBankInfo,
  fetchSePayBankAccounts,
  getSePayQRUrl,
  getSePayBankAccountFromEnv,
} from '../services/payment.service.js';
import { generateVietQRPayload } from '../utils/vietqr.js';

function getAuthContext(req: Request): { userId: number } {
  if (!req.user) {
    throw ApiError.unauthorized('Vui lòng đăng nhập');
  }
  return { userId: req.user.userId };
}

function parsePaymentMethod(value: unknown): PaymentMethod {
  const raw = String(value ?? '').toUpperCase();
  if (!Object.values(PaymentMethod).includes(raw as PaymentMethod)) {
    throw ApiError.badRequest('Phương thức thanh toán không hợp lệ');
  }
  return raw as PaymentMethod;
}

export const getWallet = async (req: Request, res: Response) => {
  const { userId } = getAuthContext(req);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { balance: true },
  });

  if (!user) throw ApiError.notFound('Không tìm thấy người dùng');

  const [totalDeposits, totalPayments, totalRevenues] = await Promise.all([
    prisma.walletTransaction.aggregate({
      where: { userId, type: 'DEPOSIT', status: 'COMPLETED' },
      _sum: { amount: true },
    }),
    prisma.walletTransaction.aggregate({
      where: { userId, type: 'PAYMENT', status: 'COMPLETED' },
      _sum: { amount: true },
    }),
    prisma.walletTransaction.aggregate({
      where: { userId, type: 'SELLER_REVENUE', status: 'COMPLETED' },
      _sum: { amount: true },
    }),
  ]);

  sendSuccess(res, {
    balance: Number(user.balance),
    totalDeposits: Number(totalDeposits._sum.amount || 0) + Number(totalRevenues._sum.amount || 0),
    totalPayments: Number(totalPayments._sum.amount || 0),
  });
};

export const getTransactions = async (req: Request, res: Response) => {
  const { userId } = getAuthContext(req);
  const { page = '1', limit = '10', type, status } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const where: Prisma.WalletTransactionWhereInput = { userId };
  if (type) {
    const t = String(type).toUpperCase() as TransactionType;
    if (Object.values(TransactionType).includes(t)) where.type = t;
  }
  if (status) {
    const s = String(status).toUpperCase() as TransactionStatus;
    if (Object.values(TransactionStatus).includes(s)) where.status = s;
  }

  const [transactions, total] = await Promise.all([
    prisma.walletTransaction.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.walletTransaction.count({ where }),
  ]);

  res.set('X-Total-Count', String(total));
  res.set('X-Total-Pages', String(Math.ceil(total / take)));
  sendList(res, transactions, { page: Number(page), limit: Number(limit), total });
};

export const getTransaction = async (req: Request, res: Response) => {
  const { userId } = getAuthContext(req);
  const id = Number(req.params.id);
  if (isNaN(id)) throw ApiError.badRequest('ID giao dịch không hợp lệ');

  const transaction = await prisma.walletTransaction.findFirst({
    where: { id, userId },
  });

  if (!transaction) throw ApiError.notFound('Không tìm thấy giao dịch');

  sendSuccess(res, transaction);
};

export const createDeposit = async (req: Request, res: Response) => {
  const { userId } = getAuthContext(req);
  const { amount: rawAmount, paymentMethod: rawMethod } = req.body;

  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw ApiError.badRequest('Số tiền không hợp lệ');
  }
  if (amount > 100000000) {
    throw ApiError.badRequest('Số tiền nạp tối đa là 100,000,000 VND');
  }

  const method = parsePaymentMethod(rawMethod);

  const transaction = await prisma.walletTransaction.create({
    data: {
      userId,
      amount,
      type: 'DEPOSIT',
      status: 'PENDING',
      paymentMethod: method,
      description: `Nạp tiền qua ${method}`,
    },
  });

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
  const depositRefId = `DEP_${transaction.id}`;

  if (method === 'MOMO') {
    const result = await createMomoPayment(
      depositRefId,
      amount,
      `${frontendUrl}/account/wallet`,
      `${backendUrl}/api/wallet/webhook/momo`,
    );

    sendSuccess(res, { paymentUrl: result.endpoint, method: 'POST', body: result.body });
  } else if (method === 'SEPAY') {
    // Fetch bank account from SePay (checkout page → user API → env vars)
    const sepayBankInfo = await fetchSePayMerchantBankInfo();
    const accounts = sepayBankInfo ? null : await fetchSePayBankAccounts();
    const bankInfo = sepayBankInfo
      ?? (accounts && accounts.length > 0
        ? { accountNumber: accounts[0].account_number, bankName: accounts[0].bank_short_name, bankBin: accounts[0].bank_bin }
        : null)
      ?? getSePayBankAccountFromEnv();

    const sepayQrUrl = getSePayQRUrl({
      accountNumber: bankInfo.accountNumber,
      bankName: bankInfo.bankName,
      amount,
      description: depositRefId,
    });

    const vietqrPayload = generateVietQRPayload({
      bankBin: bankInfo.bankBin,
      accountNumber: bankInfo.accountNumber,
      amount,
      reference: depositRefId,
    });

    sendSuccess(res, {
      transactionId: transaction.id,
      qrData: {
        sepayQrUrl,
        vietqrPayload,
        accountNumber: bankInfo.accountNumber,
        bankName: bankInfo.bankName,
        bankBin: bankInfo.bankBin,
        amount,
        reference: depositRefId,
      },
    });
  } else if (method === 'PAYPAL') {
    const result = await createPayPalPayment(
      depositRefId,
      amount,
      `${frontendUrl}/account/wallet`,
    );

    sendSuccess(res, { paymentUrl: result.approvalUrl });
  } else if (method === PaymentMethod.PLATFORM) {
    sendSuccess(res, { transactionId: transaction.id, status: 'PENDING' }, 'Yêu cầu nạp tiền đang chờ xử lý');
  } else if (method === PaymentMethod.BANK_TRANSFER) {
    // BANK_TRANSFER uses the same SePay QR code flow as SEPAY
    const sepayBankInfo = await fetchSePayMerchantBankInfo();
    const accounts = sepayBankInfo ? null : await fetchSePayBankAccounts();
    const bankInfo = sepayBankInfo
      ?? (accounts && accounts.length > 0
        ? { accountNumber: accounts[0].account_number, bankName: accounts[0].bank_short_name, bankBin: accounts[0].bank_bin }
        : null)
      ?? getSePayBankAccountFromEnv();

    const sepayQrUrl = getSePayQRUrl({
      accountNumber: bankInfo.accountNumber,
      bankName: bankInfo.bankName,
      amount,
      description: depositRefId,
    });

    const vietqrPayload = generateVietQRPayload({
      bankBin: bankInfo.bankBin,
      accountNumber: bankInfo.accountNumber,
      amount,
      reference: depositRefId,
    });

    sendSuccess(res, {
      transactionId: transaction.id,
      qrData: {
        sepayQrUrl,
        vietqrPayload,
        accountNumber: bankInfo.accountNumber,
        bankName: bankInfo.bankName,
        bankBin: bankInfo.bankBin,
        amount,
        reference: depositRefId,
      },
    });
  } else {
    throw ApiError.badRequest('Phương thức thanh toán không hợp lệ');
  }
};

async function completeDeposit(depositRefId: string, io?: SocketIOServer): Promise<boolean> {
  const txId = parseInt(depositRefId.replace('DEP_', ''), 10);
  if (isNaN(txId)) return false;

  try {
    await prisma.$transaction(async (tx) => {
      const walletTx = await tx.walletTransaction.findUnique({
        where: { id: txId },
      });

      if (!walletTx || walletTx.status !== 'PENDING') {
        throw new Error('Transaction not found or already processed');
      }

      await tx.walletTransaction.update({
        where: { id: txId },
        data: { status: 'COMPLETED' },
      });

      const user = await tx.user.update({
        where: { id: walletTx.userId },
        data: { balance: { increment: walletTx.amount } },
        select: { balance: true },
      });

      const notification = await tx.notification.create({
        data: {
          userId: walletTx.userId,
          title: 'Nạp tiền thành công',
          content: `Bạn đã nạp thành công ${Number(walletTx.amount).toLocaleString('vi-VN')} VND vào ví.`,
          type: 'PAYMENT',
          metadata: { walletTransactionId: txId, amount: Number(walletTx.amount) },
        },
      });

      // Emit realtime events after successful deposit
      if (io) {
        io.to(`user:${walletTx.userId}`).emit('wallet:updated', {
          balance: Number(user.balance),
          transactionId: txId,
          amount: Number(walletTx.amount),
        });
        io.to(`user:${walletTx.userId}`).emit('notification:new', {
          id: notification.id,
          title: notification.title,
          content: notification.content,
          type: notification.type,
          createdAt: notification.createdAt.toISOString(),
        });
      }
    });

    return true;
  } catch {
    return false;
  }
}

async function failDeposit(depositRefId: string) {
  const txId = parseInt(depositRefId.replace('DEP_', ''), 10);
  if (isNaN(txId)) return;

  const walletTx = await prisma.walletTransaction.findUnique({
    where: { id: txId },
  });

  if (!walletTx || walletTx.status !== 'PENDING') return;

  await prisma.walletTransaction.update({
    where: { id: txId },
    data: { status: 'FAILED' },
  });
}

export const handleMomoDepositWebhook = async (req: Request, res: Response) => {
  try {
    const { orderId, resultCode } = req.body;

    if (!orderId || typeof orderId !== 'string' || !orderId.startsWith('DEP_')) {
      return res.status(400).json({ success: false, message: 'Invalid orderId' });
    }

    if (!verifyMomoSignature(req.body)) {
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    const io = req.app.get('io') as SocketIOServer | undefined;
    if (resultCode === 0) {
      await completeDeposit(orderId, io);
    } else {
      await failDeposit(orderId);
    }

    res.status(200).json({ success: true });
  } catch {
    res.status(500).json({ success: false, message: 'Webhook error' });
  }
};

export const handleSePayDepositWebhook = async (req: Request, res: Response) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
  const isWebhook = req.method === 'POST';
  try {
    const sepayParams = ({
      ...((req.query as Record<string, unknown>) ?? {}),
      ...((req.body as Record<string, unknown>) ?? {}),
    }) as Record<string, string>;

    const secretKey = process.env.SEPAY_SECRET_KEY;

    if (!secretKey || !verifySePaySignature(sepayParams, secretKey)) {
      if (isWebhook) return res.status(400).json({ success: false, message: 'Invalid signature' });
      return res.redirect(`${frontendUrl}/account/wallet?error=invalid_signature`);
    }

    const orderIdStr = sepayParams.order_invoice_number;
    if (!orderIdStr || typeof orderIdStr !== 'string' || !orderIdStr.startsWith('DEP_')) {
      if (isWebhook) return res.status(400).json({ success: false, message: 'Invalid deposit reference' });
      return res.redirect(`${frontendUrl}/account/wallet?error=invalid_deposit`);
    }

    const io = req.app.get('io') as SocketIOServer | undefined;

    const processed = await completeDeposit(orderIdStr, io);

    if (isWebhook) {
      if (processed) return res.status(200).json({ success: true });
      return res.status(200).json({ success: false, message: 'Giao dịch đã được xử lý trước đó' });
    }

    res.redirect(`${frontendUrl}/account/wallet?deposit=${processed ? 'success' : 'already_processed'}`);
  } catch {
    if (isWebhook) return res.status(500).json({ success: false, message: 'Webhook error' });
    res.redirect(`${frontendUrl}/account/wallet?error=webhook_error`);
  }
};

/**
 * SePay IPN (Instant Payment Notification) Webhook
 *
 * SePay gọi endpoint này khi phát hiện giao dịch chuyển khoản vào tài khoản ngân hàng
 * của merchant. Dùng để tự động nạp tiền vào ví người dùng.
 *
 * Request:
 *   POST /api/wallet/webhook/sepay-ipn
 *   Headers: Authorization: Bearer <SEPAY_IPN_TOKEN> hoặc Apikey <SEPAY_IPN_TOKEN>
 *   Body JSON:
 *     - id: Số giao dịch từ SePay
 *     - gateway: "sepay"
 *     - transaction_date: "2024-01-15 10:30:00"
 *     - account_number: Số tài khoản thụ hưởng
 *     - code: Mã tham chiếu (chứa DEP_{id})
 *     - content: Nội dung chuyển khoản
 *     - transfer_type: "in"
 *     - transfer_amount: Số tiền
 */
export const handleSePayIpnWebhook = async (req: Request, res: Response) => {
  try {
    // ── 1. Verify authentication ──
    const ipnToken = process.env.SEPAY_IPN_TOKEN || process.env.SEPAY_API_TOKEN;
    if (ipnToken) {
      const authHeader = req.headers.authorization;
      const queryToken = req.query.token as string | undefined;

      let receivedToken: string | null = null;
      if (authHeader) {
        // Support: "Authorization: Bearer <token>", "Authorization: Apikey <token>", "Authorization: <token>"
        const parts = authHeader.split(' ');
        if (parts.length === 2) {
          receivedToken = parts[1];
        } else if (parts.length === 1) {
          receivedToken = parts[0];
        }
      } else if (queryToken) {
        receivedToken = queryToken;
      }

      if (!receivedToken || receivedToken !== ipnToken) {
        return res.status(401).json({ success: false, message: 'Unauthorized: invalid or missing token' });
      }
    }

    // ── 2. Parse request body ──
    const body = req.body as Record<string, unknown> | undefined;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid JSON body' });
    }

    const transferAmount = Number(body.transfer_amount) || 0;
    const code = String(body.code || '').trim();
    const content = String(body.content || '').trim();
    const transferType = String(body.transfer_type || '').toLowerCase();

    // Chỉ xử lý giao dịch nhận tiền (transfer_type = "in")
    if (transferType !== 'in') {
      return res.status(200).json({ success: true, message: 'Ignored: not an incoming transfer' });
    }

    if (transferAmount <= 0) {
      return res.status(200).json({ success: false, message: 'Invalid transfer amount' });
    }

    // ── 3. Extract deposit reference from code or content ──
    // Tìm mã DEP_{id} trong code hoặc content
    const depRefMatch = code.match(/(DEP_\d+)/i) || content.match(/(DEP_\d+)/i);
    if (!depRefMatch) {
      return res.status(200).json({ success: false, message: 'Deposit reference not found in transaction' });
    }

    const depositRefId = depRefMatch[1].toUpperCase();

    // ── 4. Verify amount matches (cảnh báo nếu lệch) ──
    const txId = parseInt(depositRefId.replace('DEP_', ''), 10);
    if (!isNaN(txId)) {
      const walletTx = await prisma.walletTransaction.findUnique({
        where: { id: txId },
        select: { amount: true, status: true },
      });

      if (walletTx && walletTx.status === 'PENDING') {
        const expectedAmount = Number(walletTx.amount);
        if (Math.abs(transferAmount - expectedAmount) > 1000) {
          // Số tiền lệch hơn 1000 VND — có thể là user chuyển thiếu hoặc thừa
          // Vẫn xử lý nhưng log warning
          console.warn(
            `[SePay IPN] Amount mismatch: expected=${expectedAmount}, received=${transferAmount}, ref=${depositRefId}`
          );
        }
      }
    }

    // ── 5. Complete the deposit ──
    const io = req.app.get('io') as SocketIOServer | undefined;
    const processed = await completeDeposit(depositRefId, io);

    return res.status(200).json({
      success: true,
      message: processed
        ? 'Deposit processed successfully'
        : 'Transaction already processed or not found',
    });
  } catch (error) {
    console.error('[SePay IPN] Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const handlePayPalDepositWebhook = async (req: Request, res: Response) => {
  try {
    const { orderId, status } = req.body;

    if (!orderId || typeof orderId !== 'string' || !orderId.startsWith('DEP_')) {
      return res.status(400).json({ success: false, message: 'Invalid orderId' });
    }

    const io = req.app.get('io') as SocketIOServer | undefined;

    if (status === 'COMPLETED') {
      await completeDeposit(orderId, io);
    }

    res.status(200).json({ success: true });
  } catch {
    res.status(500).json({ success: false, message: 'Webhook error' });
  }
};
