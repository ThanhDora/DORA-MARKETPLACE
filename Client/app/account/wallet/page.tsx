"use client";

import Link from "next/link";
import { ArrowLeft, ArrowDownCircle, ArrowUpCircle, Banknote, CircleDollarSign, CreditCard, History, Loader2, Plus, RotateCw, Wallet, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  formatCurrency,
  paymentMethodLabel,
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

  // Realtime: reload wallet when deposit completes
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
      color: { dark: "#0a1628", light: "#ffffff" },
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
            }, 1500);
          }
        })
        .catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [apiFetch, depositQRSession, depositQRPaid]);

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

      // SEPAY / BANK_TRANSFER — show QR code
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

  function transactionIcon(type: string) {
    return type === "DEPOSIT" || type === "SELLER_REVENUE" ? <ArrowDownCircle size={16} className="text-success" /> : <ArrowUpCircle size={16} className="text-danger" />;
  }

  function transactionLabel(type: string) {
    return type === "DEPOSIT" ? "Nạp tiền" : type === "PAYMENT" ? "Thanh toán" : type === "SELLER_REVENUE" ? "Doanh thu bán hàng" : "Hoàn tiền";
  }

  if (isInitializing) {
    return <main className="px-inline py-block"><div className="skeleton-panel" /></main>;
  }

  if (!isAuthenticated) {
    return (
      <main>
        <section className="px-inline py-[clamp(58px,7vw,84px)] grid min-h-[calc(100svh-var(--header-height))] place-items-center content-center text-center">
          <Wallet size={40} />
          <h1>Cần đăng nhập</h1>
          <p>Đăng nhập để xem ví và số dư của bạn.</p>
          <Link href="/login?next=/account/wallet" className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-bold text-center shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-95 text-on-accent bg-tertiary border border-tertiary">
            Đăng nhập
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="px-inline py-block">
      <section className="flex flex-wrap items-center justify-between gap-[14px] mb-[34px]">
        <div>
          <Link href="/account" className="inline-flex items-center gap-1.5 mb-[14px] text-[13px] font-extrabold text-secondary hover:text-primary transition-colors">
            <ArrowLeft size={16} />
            Quay lại tài khoản
          </Link>
          <h1>Ví của tôi</h1>
          <p>Quản lý số dư và lịch sử giao dịch.</p>
        </div>
      </section>

      {error && !isLoading ? (
        <section className="grid place-items-center py-16 text-center">
          <Banknote size={36} />
          <p className="text-danger font-bold mt-3">{error}</p>
          <button type="button" onClick={loadWallet} className="inline-flex min-h-[44px] items-center gap-2 rounded-[13px] border border-border bg-surface px-5 text-[14px] font-extrabold text-primary transition-all hover:-translate-y-[1px] mt-4">
            <RotateCw size={15} />
            Thử lại
          </button>
        </section>
      ) : isLoading ? (
        <section className="grid place-items-center py-16">
          <Loader2 size={36} className="spin-icon text-tertiary" />
          <p className="mt-4 text-secondary font-bold">Đang tải thông tin ví...</p>
        </section>
      ) : (
        <>
          <section className="rounded-[24px] border border-card-border bg-surface p-[clamp(24px,3vw,36px)] shadow-soft mb-[var(--grid-gap)]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[13px] font-extrabold uppercase tracking-wide text-secondary mb-2 inline-flex items-center gap-1.5">
                  <Wallet size={16} />
                  Số dư khả dụng
                </p>
                <h2 className="text-[clamp(32px,4vw,48px)] font-black leading-none text-primary">
                  {formatCurrency(wallet?.balance ?? 0)}
                </h2>
                <div className="flex flex-wrap gap-4 mt-4">
                  <div className="flex items-center gap-2 text-[13px] font-bold text-secondary">
                    <ArrowDownCircle size={14} className="text-success" />
                    Đã nạp: <span className="text-primary">{formatCurrency(wallet?.totalDeposits ?? 0)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[13px] font-bold text-secondary">
                    <ArrowUpCircle size={14} className="text-danger" />
                    Đã chi: <span className="text-primary">{formatCurrency(wallet?.totalPayments ?? 0)}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[14px] border border-tertiary bg-tertiary px-6 py-3 text-[15px] font-extrabold text-on-accent shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-[0.99]"
                onClick={() => setShowDeposit(true)}
              >
                <Plus size={18} />
                Nạp tiền
              </button>
            </div>
          </section>

          {/* ── SePay Native QR for Deposit ── */}
          {depositQRSession ? (
            <section className="rounded-[24px] border border-tertiary/20 bg-surface p-[clamp(20px,2.8vw,30px)] shadow-soft overflow-hidden relative mb-[var(--grid-gap)]">
              <div className="pointer-events-none absolute inset-0 opacity-[0.05]" aria-hidden="true">
                <div className="absolute -right-20 -top-20 h-[350px] w-[350px] rounded-full border border-tertiary bg-[radial-gradient(circle,rgba(100,210,255,0.25),transparent_70%)]" />
                <div className="absolute -bottom-16 -left-16 h-[250px] w-[250px] rounded-full border border-tertiary/40 bg-[radial-gradient(circle,rgba(100,210,255,0.15),transparent_70%)]" />
              </div>

              <div className="relative z-[1]">
                <div className="flex items-center justify-between gap-3 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-[14px] border border-tertiary/25 bg-tertiary/10 shadow-[0_4px_12px_rgba(0,122,255,0.12)]">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-tertiary">
                        <rect x="2" y="3" width="20" height="18" rx="3" stroke="currentColor" strokeWidth="1.8" fill="none" />
                        <line x1="2" y1="9" x2="22" y2="9" stroke="currentColor" strokeWidth="1.8" />
                        <line x1="12" y1="9" x2="12" y2="21" stroke="currentColor" strokeWidth="1.8" />
                        <circle cx="7" cy="13" r="1.2" fill="currentColor" />
                        <circle cx="7" cy="17" r="1.2" fill="currentColor" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="m-0 text-[18px] font-black text-primary">Nạp tiền qua chuyển khoản</h2>
                      <p className="m-0 text-[13px] font-semibold text-secondary">Quét mã QR bằng ứng dụng ngân hàng</p>
                    </div>
                  </div>
                  {!depositQRPaid ? (
                    <button type="button" className="grid h-9 w-9 place-items-center rounded-full border border-border bg-neutral text-primary hover:bg-border transition-colors shrink-0"
                      onClick={() => { setDepositQRSession(null); }}>
                      <X size={16} />
                    </button>
                  ) : null}
                </div>

                <div className="grid gap-6 md:grid-cols-[280px_1fr] md:items-start">
                  {/* QR Code */}
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative rounded-[20px] border-2 border-tertiary/20 bg-white p-4 shadow-[0_12px_36px_rgba(0,122,255,0.10)]">
                      {!sepayQrFailed ? (
                        <img
                          src={depositQRSession.qrData.sepayQrUrl}
                          alt="VietQR"
                          width={280}
                          height={280}
                          className="block h-[280px] w-[280px]"
                          crossOrigin="anonymous"
                          onError={() => setSepayQrFailed(true)}
                        />
                      ) : (
                        <canvas ref={fallbackCanvasRef} className="block h-[280px] w-[280px]" />
                      )}
                      <div className="absolute -top-[7px] left-1/2 -translate-x-1/2 h-[14px] w-[14px] rounded-full bg-tertiary shadow-[0_0_12px_rgba(0,122,255,0.5)]" />
                      <div className="absolute -bottom-[7px] left-1/2 -translate-x-1/2 h-[14px] w-[14px] rounded-full bg-tertiary shadow-[0_0_12px_rgba(0,122,255,0.5)]" />
                      <div className="absolute top-1/2 -left-[7px] -translate-y-1/2 h-[14px] w-[14px] rounded-full bg-tertiary shadow-[0_0_12px_rgba(0,122,255,0.5)]" />
                      <div className="absolute top-1/2 -right-[7px] -translate-y-1/2 h-[14px] w-[14px] rounded-full bg-tertiary shadow-[0_0_12px_rgba(0,122,255,0.5)]" />

                      {/* Logo overlay */}
                      <div className="absolute inset-0 grid place-items-center pointer-events-none">
                        <div className="h-10 w-10 rounded-full border-2 border-white bg-tertiary shadow-[0_4px_16px_rgba(0,122,255,0.35)] grid place-items-center">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-secondary">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="6" width="20" height="12" rx="2" />
                        <circle cx="12" cy="12" r="2" />
                        <path d="M6 12h.01M18 12h.01" />
                      </svg>
                      Mã QR động — chỉ dùng 1 lần
                    </div>
                  </div>

                  {/* Bank Info + Status */}
                  <div className="grid gap-4">
                    {/* Bank Account Card */}
                    <div className="rounded-[16px] border border-border bg-gradient-to-br from-neutral to-surface p-4">
                      <p className="text-[11px] font-extrabold uppercase tracking-wider text-secondary mb-3">Thông tin tài khoản thụ hưởng</p>

                      <div className="grid gap-2.5">
                        <div className="flex items-center justify-between gap-2 py-1.5 border-b border-border/60">
                          <span className="text-[12px] font-semibold text-secondary">Ngân hàng</span>
                          <span className="text-[13px] font-extrabold text-primary">{depositQRSession.qrData.bankName}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 py-1.5 border-b border-border/60">
                          <span className="text-[12px] font-semibold text-secondary">Số tài khoản</span>
                          <span className="text-[14px] font-black tracking-wider text-primary font-mono">{depositQRSession.qrData.accountNumber}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 py-1.5 border-b border-border/60">
                          <span className="text-[12px] font-semibold text-secondary">Số tiền</span>
                          <span className="text-[16px] font-black text-primary">{formatCurrency(depositQRSession.qrData.amount)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 py-1.5">
                          <span className="text-[12px] font-semibold text-secondary">Nội dung</span>
                          <span className="text-[12px] font-extrabold text-primary font-mono max-w-[180px] truncate">{depositQRSession.qrData.reference}</span>
                        </div>
                      </div>
                    </div>

                    {/* Instructions + Status */}
                    <div className="rounded-[16px] border border-border bg-neutral p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-wide ${
                          depositQRPaid
                            ? "border-success/30 bg-success/10 text-success"
                            : "border-warning/30 bg-warning/10 text-warning"
                        }`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {depositQRPaid ? "Đã nhận tiền" : "Chờ thanh toán"}
                        </span>
                      </div>

                      <ol className="grid gap-2 text-[12px] font-semibold text-secondary list-decimal list-inside marker:text-tertiary marker:font-black">
                        <li>Mở ứng dụng ngân hàng trên điện thoại</li>
                        <li>Chọn tính năng quét mã QR</li>
                        <li>Quét mã QR hoặc nhập thông tin thụ hưởng</li>
                        <li>Kiểm tra số tiền và nội dung chuyển khoản</li>
                        <li>Xác nhận chuyển — số dư tự động cập nhật</li>
                      </ol>
                    </div>

                    {/* Status bar */}
                    {!depositQRPaid ? (
                      <div className="flex items-center gap-2 rounded-[12px] border border-tertiary/15 bg-tertiary/8 px-4 py-3 text-[13px] font-bold text-tertiary">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 animate-spin">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                        Đang chờ thanh toán...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 rounded-[12px] border border-success/20 bg-success/10 px-4 py-3 text-[13px] font-bold text-success">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                          <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                        Nhận tiền thành công! Đang cập nhật số dư...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <section className="rounded-[24px] border border-card-border bg-surface p-[clamp(18px,2.2vw,24px)] shadow-soft">
            <div className="flex items-center justify-between gap-3 mb-5">
              <h2 className="m-0 text-[18px] font-black text-primary inline-flex items-center gap-2">
                <History size={18} />
                Lịch sử giao dịch
              </h2>
            </div>

            {transactions.length === 0 ? (
              <div className="grid place-items-center py-12 text-center">
                <Banknote size={32} />
                <p className="mt-3 text-[15px] font-bold text-secondary">Chưa có giao dịch nào.</p>
                <p className="text-[13px] font-semibold text-secondary">Nạp tiền vào ví để bắt đầu.</p>
              </div>
            ) : (
              <div className="grid gap-2.5">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between gap-3 rounded-[14px] border border-border/80 bg-neutral p-3.5 transition-all hover:border-border">
                    <div className="flex items-center gap-3 min-w-0">
                      {transactionIcon(tx.type)}
                      <div className="min-w-0">
                        <p className="text-[14px] font-extrabold text-primary truncate">{transactionLabel(tx.type)}</p>
                        <p className="text-[12px] font-semibold text-secondary truncate">
                          {tx.description ?? ""}
                        </p>
                        <p className="text-[11px] font-bold text-secondary">
                          {new Date(tx.createdAt).toLocaleDateString("vi-VN", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-[15px] font-black ${tx.type === "DEPOSIT" || tx.type === "SELLER_REVENUE" ? "text-success" : "text-danger"}`}>
                        {tx.type === "DEPOSIT" || tx.type === "SELLER_REVENUE" ? "+" : "-"}{formatCurrency(Number(tx.amount))}
                      </p>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                        tx.status === "COMPLETED" ? "border-success/30 bg-success/10 text-success" :
                        tx.status === "FAILED" ? "border-danger/30 bg-danger/10 text-danger" :
                        "border-warning/30 bg-warning/10 text-warning"
                      }`}>
                        {statusLabel(tx.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {pagination.page * pagination.limit < pagination.total && (
              <button
                type="button"
                className="mt-4 w-full inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[13px] border border-border bg-surface px-5 text-[14px] font-extrabold text-primary transition-all hover:-translate-y-[1px]"
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
            )}
          </section>

          {showDeposit && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => !isDepositing && setShowDeposit(false)}>
              <div className="w-full max-w-[460px] rounded-[24px] border border-card-border bg-surface p-[clamp(20px,2.6vw,30px)] shadow-soft max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between gap-3 mb-5">
                  <h2 className="m-0 text-[20px] font-black text-primary">Nạp tiền vào ví</h2>
                  <button type="button" className="grid h-8 w-8 place-items-center rounded-full border border-border bg-neutral text-primary hover:bg-border transition-colors" onClick={() => { if (!isDepositing) { setShowDeposit(false); setDepositAmount(0); }}}>
                    ✕
                  </button>
                </div>

                <div className="mb-4">
                  <p className="text-[13px] font-extrabold text-primary mb-2.5">Số tiền nạp</p>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[18px] font-black text-secondary">₫</span>
                    <input
                      type="number"
                      min={10000}
                      max={100000000}
                      step={10000}
                      value={depositAmount || ""}
                      onChange={(e) => setDepositAmount(Number(e.target.value) || 0)}
                      placeholder="Nhập số tiền"
                      className="w-full rounded-[14px] border border-border bg-neutral px-10 py-3.5 text-[18px] font-black text-primary text-right outline-none transition-all focus:border-tertiary focus:ring-2 focus:ring-tertiary/20"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-5">
                  {DEPOSIT_PRESETS.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      className={`px-3 py-2 rounded-[10px] text-[13px] font-extrabold border transition-all ${
                        depositAmount === amount
                          ? "border-tertiary bg-tertiary/10 text-tertiary"
                          : "border-border bg-neutral text-secondary hover:border-tertiary/30"
                      }`}
                      onClick={() => setDepositAmount(amount)}
                    >
                      {formatCurrency(amount)}
                    </button>
                  ))}
                </div>

                <div className="mb-5">
                  <p className="text-[13px] font-extrabold text-primary mb-2.5">Phương thức nạp</p>
                  <div className="grid gap-2">
                    {paymentMethods.map((method) => (
                      <button
                        key={method.id}
                        type="button"
                        className={`flex items-center gap-3 rounded-[14px] border p-3 text-left transition-all ${
                          depositMethod === method.id
                            ? "border-tertiary bg-tertiary/8 text-primary"
                            : "border-border bg-neutral text-secondary hover:border-tertiary/30"
                        }`}
                        onClick={() => setDepositMethod(method.id)}
                      >
                        <CreditCard size={16} />
                        <span className="text-[14px] font-extrabold">{method.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    className="flex-1 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[14px] border border-border bg-surface px-5 text-[14px] font-extrabold text-primary transition-all hover:-translate-y-[1px]"
                    onClick={() => { setShowDeposit(false); setDepositAmount(0); }}
                    disabled={isDepositing}
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    className="flex-1 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[14px] border border-tertiary bg-tertiary px-5 text-[14px] font-extrabold text-on-accent shadow-soft transition-all hover:-translate-y-[1px] hover:shadow-hover disabled:opacity-55 disabled:pointer-events-none"
                    onClick={handleDeposit}
                    disabled={isDepositing || depositAmount <= 0}
                  >
                    {isDepositing ? <Loader2 size={16} className="spin-icon" /> : <CircleDollarSign size={16} />}
                    {isDepositing ? "Đang xử lý..." : `Nạp ${formatCurrency(depositAmount || 0)}`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
