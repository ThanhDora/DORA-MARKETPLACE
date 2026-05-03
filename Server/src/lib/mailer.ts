import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';
import ejs from 'ejs';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const getTemplatesDir = () => path.resolve(__dirname, '..', 'templates', 'emails');

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(env.SMTP_PORT || '587'),
  secure: parseInt(env.SMTP_PORT || '587') === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: env.NODE_ENV === 'production',
  },
});

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export const sendEmail = async ({ to, subject, html, text }: SendEmailOptions): Promise<boolean> => {
  if (!env.SMTP_HOST) {
    logger.info(`📧 [DEV] Email would be sent to ${to}: ${subject}`);
    return false;
  }

  try {
    const info = await transporter.sendMail({
      from: env.SMTP_FROM || '"Mini Marketplace" <noreply@minimarketplace.com>',
      to,
      subject,
      text,
      html,
    });
    logger.info(`✅ Email sent to ${to}: ${subject} - Message ID: ${info.messageId}`);
    return true;
  } catch (error) {
    logger.error(`❌ Failed to send email to ${to}: ${error}`);
    return false;
  }
};

export const emailTemplates = {
  verification: async (name: string, verifyUrl: string) => {
    const html = await ejs.renderFile(path.join(getTemplatesDir(), 'verify-email.ejs'), { name, verifyUrl });
    return { subject: 'Xác minh email - Mini Marketplace', html };
  },

  passwordReset: async (name: string, resetUrl: string) => {
    const html = await ejs.renderFile(path.join(getTemplatesDir(), 'password-reset.ejs'), { name, resetUrl });
    return { subject: 'Đặt lại mật khẩu - Mini Marketplace', html };
  },

  orderPaid: async (name: string, orderId: string, amount?: string, orderUrl?: string) => {
    const html = await ejs.renderFile(path.join(getTemplatesDir(), 'order-paid.ejs'), { name, orderId, amount, orderUrl });
    return { subject: 'Đơn hàng đã thanh toán - Mini Marketplace', html };
  },

  subscriptionExpiring: async (name: string, planName: string, daysLeft: number, renewUrl?: string) => {
    const html = await ejs.renderFile(path.join(getTemplatesDir(), 'subscription-expiring.ejs'), { name, planName, daysLeft, renewUrl });
    return { subject: 'Subscription sắp hết hạn - Mini Marketplace', html };
  },

  welcome: async (name: string, homeUrl?: string) => {
    const html = await ejs.renderFile(path.join(getTemplatesDir(), 'welcome.ejs'), { name, homeUrl });
    return { subject: 'Chào mừng đến với Mini Marketplace!', html };
  },

  loginAlert: async (name: string, loginTime: string, ipAddress?: string, deviceInfo?: string) => {
    const html = await ejs.renderFile(path.join(getTemplatesDir(), 'login-alert.ejs'), { name, loginTime, ipAddress, deviceInfo });
    return { subject: '🔐 Thông báo đăng nhập - Mini Marketplace', html };
  },
};
