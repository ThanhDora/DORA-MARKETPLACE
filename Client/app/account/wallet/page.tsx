"use client";

import Link from "next/link";
import { ArrowLeft, ArrowDownCircle, ArrowUpCircle, Banknote, CircleDollarSign, CreditCard, History, Loader2, Plus, RotateCw, Wallet, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { motion, AnimatePresence } from "framer-motion";
import {
  formatCurrency,
  statusLabel,
  type ApiEnvelope,
  type ApiList,
  type WalletData,
  type WalletTransaction,
  type PaymentMethod,
  type PaymentMethodOption,
} from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { useRealtime } from "@/components/RealtimeProvider";

const DEPOSIT_PRESETS = [100000, 200000, 500000, 1000000, 2000000, 5000000];

function transactionIcon(type: string) {
  return type === "DEPOSIT" || type === "SELLER_REVENUE" ? (
    <ArrowDownCircle size={16} />
  ) : (
    <ArrowUpCircle size={16} />
  );
}

function transactionLabel(type: string) {
  return type === "DEPOSIT"
    ? "Nạp tiền"
    : type === "PAYMENT"
      ? "Thanh toán"
      : type === "SELLER_REVENUE"
        ? "Doanh thu bán hàng"
        : "Hoàn tiền";
}

const springEase: [number, number, number, number] = [0.19, 1, 0.22, 1];

const stagger = {
  animate: {
    transition: { staggerChildren: 0.08 },
  },
};

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: springEase },
  },
};

export default function WalletPage() {
  const { isAuthenticated, isInitializing, apiFetch } = useAuth();
  const { showToast } = useToast();
  const { walletVersion } = useRealtime();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeposit, setShowDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState(0);
  const [depositMethod, setDepositMethod] = useState<PaymentMethod>("MOMO");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>([]);
  const [isDepositing, setIsDepositing] = useState(false);
  const [depositQRSession, setDepositQRSession] = useState<{
    transactionId: number;
    qrData: {
      sepayQrUrl: string;
      vietqrPayload: string;
      accountNumber: string;
      bankName: string;
      amount: number;
      reference: string;
    };
  } | null>(null);
  const [depositQRPaid, setDepositQRPaid] = useState(false);
  const [sepayQrFailed, setSepayQrFailed] = useState(false);
  const fallbackCanvasRef = useRef<HTMLCanvasElement>(null);

  const loadWallet = useCallback(async () => {
    try {
      const [walletRes, txRes] = await Promise.all([
        apiFetch<ApiEnvelope<WalletData>>("/wallet", { notifySuccess: false }),
        apiFetch<ApiList<WalletTransaction>>("/wallet/transactions?limit=10", { notifySuccess: false }),
      ]);
      setWallet(walletRes.data);
      setTransactions(txRes.data);
      setPagination(txRes.pagination ?? { page: 1, limit: 10, total: 0 });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải thông tin ví.");
    } finally {
      setIsLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (!isAuthenticated || isInitializing) return;
    void loadWallet();
  }, [isAuthenticated, isInitializing, loadWallet]);

  useEffect(() => {
    if (!isAuthenticated || isInitializing || walletVersion === 0) return;
    void loadWallet();
  }, [isAuthenticated, isInitializing, loadWallet, walletVersion]);

  useEffect(() => {
    if (!showDeposit) return;
    apiFetch<ApiEnvelope<PaymentMethodOption[]>>("/payments/methods", { notifySuccess: false })
      .then((res) => {
        const filtered = res.data.filter((m) => m.id !== "PLATFORM");
        setPaymentMethods(filtered);
        if (filtered.length > 0) setDepositMethod(filtered[0].id);
      })
      .catch(() => {
        setPaymentMethods([
          { id: "MOMO", name: "MoMo" },
          { id: "BANK_TRANSFER", name: "Chuyển khoản ngân hàng" },
        ]);
      });
  }, [apiFetch, showDeposit]);

  useEffect(() => {
    if (!depositQRSession || !sepayQrFailed || !fallbackCanvasRef.current) return;
    QRCode.toCanvas(fallbackCanvasRef.current, depositQRSession.qrData.vietqrPayload, {
      width: 280,
      margin: 2,
      color: { dark: "#1a1713", light: "#faf8f2" },
    });
  }, [depositQRSession, sepayQrFailed]);

  useEffect(() => {
    if (!depositQRSession || depositQRPaid) return;
    const timer = window.setInterval(() => {
      apiFetch<ApiEnvelope<WalletTransaction>>(`/wallet/transactions/${depositQRSession.transactionId}`, { notifySuccess: false })
        .then((res) => {
          if (res.data.status === "COMPLETED") {
            setDepositQRPaid(true);
            window.clearInterval(timer);
            setTimeout(() => {
              setDepositQRSession(null);
              setDepositQRPaid(false);
              void loadWallet();
            }, 2000);
          }
        })
        .catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [apiFetch, depositQRSession, depositQRPaid, loadWallet]);

  async function handleDeposit() {
    if (depositAmount <= 0) {
      showToast("Vui lòng nhập số tiền hợp lệ.", "error");
      return;
    }
    if (depositAmount > 100000000) {
      showToast("Số tiền nạp tối đa là 100,000,000 VND.", "error");
      return;
    }

    setIsDepositing(true);
    try {
      const response = await apiFetch<ApiEnvelope<{ paymentUrl?: string; approvalUrl?: string; method?: string; body?: Record<string, unknown>; transactionId?: number; qrData?: { sepayQrUrl: string; vietqrPayload: string; accountNumber: string; bankName: string; amount: number; reference: string } }>>("/wallet/deposit", {
        method: "POST",
        body: JSON.stringify({ amount: depositAmount, paymentMethod: depositMethod }),
      });

      if ((depositMethod === "SEPAY" || depositMethod === "BANK_TRANSFER") && response.data.qrData && response.data.transactionId) {
        setSepayQrFailed(false);
        setDepositQRSession({
          transactionId: response.data.transactionId,
          qrData: response.data.qrData,
        });
        setShowDeposit(false);
        return;
      }

      const paymentUrl = response.data.paymentUrl ?? response.data.approvalUrl;
      if (paymentUrl && response.data.method === "POST" && response.data.body) {
        const form = document.createElement("form");
        form.method = "POST";
        form.action = paymentUrl;
        form.style.display = "none";
        Object.entries(response.data.body).forEach(([key, raw]) => {
          if (raw === undefined || raw === null) return;
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = key;
          input.value = String(raw);
          form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();
        return;
      }
      if (paymentUrl) {
        window.location.href = paymentUrl;
        return;
      }

      showToast(response.message ?? "Yêu cầu nạp tiền đang được xử lý.", "success");
      setShowDeposit(false);
      setDepositAmount(0);
      void loadWallet();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Không thể tạo yêu cầu nạp tiền.", "error");
    } finally {
      setIsDepositing(false);
    }
  }

  // ── Loading State ──
  if (isInitializing) {
    return (
      <div className="wallet-loader">
        <div className="wallet-loader__spinner" />
        <p>Đang tải thông tin...</p>
      </div>
    );
  }

  // ── Auth Gate ──
  if (!isAuthenticated) {
    return (
      <div className="wallet-gate">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
        >
          <Wallet size={40} />
          <h1>Cần đăng nhập</h1>
          <p>Đăng nhập để xem ví và số dư của bạn.</p>
          <Link href="/login?next=/account/wallet" className="wallet-gate__btn">
            Đăng nhập
          </Link>
        </motion.div>
      </div>
    );
  }

  // ── Error State ──
  if (error && !isLoading) {
    return (
      <div className="wallet-gate">
        <Banknote size={36} />
        <h1 style={{ fontSize: 22, color: "#d9706b" }}>{error}</h1>
        <button type="button" onClick={loadWallet} className="wallet-gate__btn">
          <RotateCw size={15} />
          Thử lại
        </button>
      </div>
    );
  }

  // ── Loading State ──
  if (isLoading) {
    return (
      <div className="wallet-loader">
        <div className="wallet-loader__spinner" />
        <p>Đang tải thông tin ví...</p>
      </div>
    );
  }

  return (
    <motion.main
      className="wallet-page"
      initial="initial"
      animate="animate"
      variants={stagger}
    >
      {/* Header */}
      <motion.div variants={fadeUp}>
        <Link href="/account" className="wallet-page__back">
          <ArrowLeft size={16} />
          Quay lại tài khoản
        </Link>
        <h1>Ví của tôi</h1>
        <p className="wallet-page__subtitle">Quản lý số dư và lịch sử giao dịch.</p>
      </motion.div>

      {/* Balance Card */}
      <motion.section
        className="wcard"
        variants={fadeUp}
        style={{ marginBottom: "var(--grid-gap)" }}
      >
        <div className="wcard__body">
          <p className="wcard__label">
            <Wallet size={14} aria-hidden="true" />
            Số dư khả dụng
          </p>
          <motion.div
            className="wcard__balance"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.19, 1, 0.22, 1] }}
          >
            {formatCurrency(wallet?.balance ?? 0)}
          </motion.div>
          <div className="wcard__stats">
            <div className="wcard__stat wcard__stat--inflow">
              <ArrowDownCircle size={13} aria-hidden="true" />
              <span>Đã nạp</span>
              <strong>{formatCurrency(wallet?.totalDeposits ?? 0)}</strong>
            </div>
            <div className="wcard__stat wcard__stat--outflow">
              <ArrowUpCircle size={13} aria-hidden="true" />
              <span>Đã chi</span>
              <strong>{formatCurrency(wallet?.totalPayments ?? 0)}</strong>
            </div>
          </div>
        </div>
        <motion.button
          type="button"
          className="wcard__deposit-btn"
          onClick={() => setShowDeposit(true)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Plus size={17} aria-hidden="true" />
          Nạp tiền
        </motion.button>
      </motion.section>

      {/* QR Deposit Section */}
      <AnimatePresence>
        {depositQRSession ? (
          <motion.section
            className="wqr-section"
            variants={fadeUp}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }}
            transition={{ duration: 0.45, ease: [0.19, 1, 0.22, 1] }}
            style={{ marginBottom: "var(--grid-gap)" }}
          >
            {/* Header */}
            <div className="wqr-header">
              <div className="wqr-header__icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
                  <rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
                  <rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
                  <rect x="5" y="5" width="4" height="4" fill="currentColor" rx="0.5" />
                  <rect x="15" y="5" width="4" height="4" fill="currentColor" rx="0.5" />
                  <rect x="5" y="15" width="4" height="4" fill="currentColor" rx="0.5" />
                  <rect x="14" y="14" width="2" height="2" fill="currentColor" />
                  <rect x="17" y="14" width="2" height="2" fill="currentColor" />
                  <rect x="14" y="17" width="2" height="2" fill="currentColor" />
                  <rect x="17" y="17" width="4" height="4" fill="currentColor" rx="0.5" />
                </svg>
              </div>
              <div>
                <h2 className="wqr-header__title">Nạp tiền qua chuyển khoản</h2>
                <p className="wqr-header__sub">Quét mã QR bằng ứng dụng ngân hàng của bạn</p>
              </div>
              {!depositQRPaid ? (
                <button
                  type="button"
                  className="wqr-close"
                  onClick={() => setDepositQRSession(null)}
                  aria-label="Đóng"
                >
                  <X size={15} />
                </button>
              ) : null}
            </div>

            {/* Body */}
            <div className="wqr-body">
              {/* Left — QR Code */}
              <div className="wqr-code-col">
                <div className={`wqr-frame${depositQRPaid ? " is-paid" : ""}`}>
                  {/* Corner Brackets */}
                  <span className="wqr-corner wqr-corner--tl" aria-hidden="true" />
                  <span className="wqr-corner wqr-corner--tr" aria-hidden="true" />
                  <span className="wqr-corner wqr-corner--bl" aria-hidden="true" />
                  <span className="wqr-corner wqr-corner--br" aria-hidden="true" />

                  {/* Scan Line */}
                  {!depositQRPaid ? <span className="wqr-scan-line" aria-hidden="true" /> : null}

                  {/* Floating Particles */}
                  <div className="wqr-particles" aria-hidden="true">
                    <span className="wqr-particle" />
                    <span className="wqr-particle" />
                    <span className="wqr-particle" />
                    <span className="wqr-particle" />
                    <span className="wqr-particle" />
                    <span className="wqr-particle" />
                    <span className="wqr-particle" />
                    <span className="wqr-particle" />
                  </div>

                  {/* QR Image */}
                  <div className="wqr-img">
                    {!sepayQrFailed ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={depositQRSession.qrData.sepayQrUrl}
                        alt="VietQR"
                        width={240}
                        height={240}
                        crossOrigin="anonymous"
                        onError={() => setSepayQrFailed(true)}
                      />
                    ) : (
                      <canvas ref={fallbackCanvasRef} style={{ width: 240, height: 240, display: "block" }} />
                    )}
                  </div>

                  {/* Success Overlay */}
                  <AnimatePresence>
                    {depositQRPaid ? (
                      <motion.div
                        className="wqr-success"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }}
                        aria-live="polite"
                      >
                        <div className="wqr-success__ring">
                          <svg className="wqr-success__check" width="36" height="36" viewBox="0 0 24 24" fill="none">
                            <path d="M7 12.5l3.5 3.5 6.5-7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                        <span>Nhận tiền thành công!</span>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
                <p className="wqr-badge">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="6" width="20" height="12" rx="2" />
                    <circle cx="12" cy="12" r="2" />
                  </svg>
                  Mã QR động · chỉ dùng 1 lần
                </p>
              </div>

              {/* Right — Bank Info + Steps + Status */}
              <div className="wqr-info-col">
                <div className="wqr-bank">
                  <p className="wqr-bank__heading">Thông tin thụ hưởng</p>
                  <div className="wqr-bank__rows">
                    {[
                      { label: "Ngân hàng", value: depositQRSession.qrData.bankName, mono: false },
                      { label: "Số tài khoản", value: depositQRSession.qrData.accountNumber, mono: true },
                      { label: "Số tiền", value: formatCurrency(depositQRSession.qrData.amount), mono: false, accent: true },
                      { label: "Nội dung CK", value: depositQRSession.qrData.reference, mono: true, truncate: true },
                    ].map(({ label, value, mono, accent, truncate }) => (
                      <div key={label} className="wqr-bank__row">
                        <span>{label}</span>
                        <strong className={`${mono ? "font-mono" : ""} ${accent ? "wqr-bank__amount" : ""} ${truncate ? "truncate max-w-[160px]" : ""}`}>
                          {value}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>

                <ol className="wqr-steps">
                  {[
                    "Mở ứng dụng ngân hàng",
                    "Chọn tính năng Quét mã QR",
                    "Quét mã hoặc nhập thủ công",
                    "Kiểm tra số tiền & nội dung",
                    "Xác nhận — số dư tự cập nhật",
                  ].map((s, i) => (
                    <li key={i} className="wqr-step">
                      <span className="wqr-step__num">{i + 1}</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>

                <div className={`wqr-status${depositQRPaid ? " is-paid" : " is-waiting"}`}>
                  {!depositQRPaid ? (
                    <>
                      <span className="wqr-status__spinner" aria-hidden="true" />
                      Đang chờ thanh toán...
                    </>
                  ) : (
                    <>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                      Nhận tiền thành công! Đang cập nhật số dư...
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>

      {/* Transaction History */}
      <motion.section className="tx-section" variants={fadeUp}>
        <div className="tx-section__header">
          <h2 className="tx-section__title">
            <History size={18} />
            Lịch sử giao dịch
          </h2>
        </div>

        {transactions.length === 0 ? (
          <div className="tx-empty">
            <Banknote size={32} />
            <p>Chưa có giao dịch nào.</p>
            <span>Nạp tiền vào ví để bắt đầu.</span>
          </div>
        ) : (
          <>
            <div className="tx-list">
              {transactions.map((tx) => {
                const isInflow = tx.type === "DEPOSIT" || tx.type === "SELLER_REVENUE";
                return (
                  <motion.div
                    key={tx.id}
                    className="tx-row"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: [0.19, 1, 0.22, 1] }}
                  >
                    <div className="tx-row__left">
                      <div className={`tx-row__icon ${isInflow ? "tx-row__icon--inflow" : "tx-row__icon--outflow"}`}>
                        {transactionIcon(tx.type)}
                      </div>
                      <div className="tx-row__info">
                        <p className="tx-row__label">{transactionLabel(tx.type)}</p>
                        <p className="tx-row__desc">{tx.description ?? ""}</p>
                        <span className="tx-row__meta">
                          {new Date(tx.createdAt).toLocaleDateString("vi-VN", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="tx-row__right">
                      <span className={`tx-row__amount ${isInflow ? "tx-row__amount--inflow" : "tx-row__amount--outflow"}`}>
                        {isInflow ? "+" : "-"}{formatCurrency(Number(tx.amount))}
                      </span>
                      <span className={`tx-row__badge ${
                        tx.status === "COMPLETED"
                          ? "tx-row__badge--completed"
                          : tx.status === "FAILED"
                            ? "tx-row__badge--failed"
                            : "tx-row__badge--pending"
                      }`}>
                        {statusLabel(tx.status)}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {pagination.page * pagination.limit < pagination.total && (
              <div className="tx-load-more">
                <button
                  type="button"
                  onClick={() => {
                    const nextPage = pagination.page + 1;
                    apiFetch<ApiList<WalletTransaction>>(`/wallet/transactions?page=${nextPage}&limit=10`, { notifySuccess: false })
                      .then((res) => {
                        setTransactions((prev) => [...prev, ...res.data]);
                        setPagination(res.pagination ?? { page: nextPage, limit: 10, total: pagination.total });
                      })
                      .catch(() => showToast("Không thể tải thêm giao dịch.", "error"));
                  }}
                >
                  Xem thêm
                </button>
              </div>
            )}
          </>
        )}
      </motion.section>

      {/* Deposit Modal */}
      <AnimatePresence>
        {showDeposit ? (
          <motion.div
            className="deposit-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => !isDepositing && setShowDeposit(false)}
          >
            <motion.div
              className="deposit-card"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ duration: 0.35, ease: [0.19, 1, 0.22, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="deposit-card__header">
                <h2 className="deposit-card__title">Nạp tiền vào ví</h2>
                <button
                  type="button"
                  className="deposit-card__close"
                  onClick={() => { if (!isDepositing) { setShowDeposit(false); setDepositAmount(0); } }}
                >
                  ✕
                </button>
              </div>

              <span className="deposit-card__label">Số tiền nạp</span>
              <div className="deposit-card__amount-input">
                <span>₫</span>
                <input
                  type="number"
                  min={10000}
                  max={100000000}
                  step={10000}
                  value={depositAmount || ""}
                  onChange={(e) => setDepositAmount(Number(e.target.value) || 0)}
                  placeholder="Nhập số tiền"
                />
              </div>

              <div className="deposit-card__presets">
                {DEPOSIT_PRESETS.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    className={`deposit-card__preset${depositAmount === amount ? " deposit-card__preset--active" : ""}`}
                    onClick={() => setDepositAmount(amount)}
                  >
                    {formatCurrency(amount)}
                  </button>
                ))}
              </div>

              <span className="deposit-card__label">Phương thức nạp</span>
              <div className="deposit-card__methods">
                {paymentMethods.map((method) => (
                  <button
                    key={method.id}
                    type="button"
                    className={`deposit-card__method${depositMethod === method.id ? " deposit-card__method--active" : ""}`}
                    onClick={() => setDepositMethod(method.id)}
                  >
                    <CreditCard size={16} />
                    <span>{method.name}</span>
                  </button>
                ))}
              </div>

              <div className="deposit-card__actions">
                <button
                  type="button"
                  className="deposit-card__cancel"
                  onClick={() => { setShowDeposit(false); setDepositAmount(0); }}
                  disabled={isDepositing}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="deposit-card__submit"
                  onClick={handleDeposit}
                  disabled={isDepositing || depositAmount <= 0}
                >
                  {isDepositing ? (
                    <Loader2 size={16} className="spin-icon" />
                  ) : (
                    <CircleDollarSign size={16} />
                  )}
                  {isDepositing ? "Đang xử lý..." : `Nạp ${formatCurrency(depositAmount || 0)}`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.main>
  );
}
