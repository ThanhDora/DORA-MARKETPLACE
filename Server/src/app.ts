import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { errorHandler } from './utils/ApiError.js';
import { apiLimiter } from './middleware/rateLimit.middleware.js';
import { handleUploadError } from './middleware/upload.middleware.js';
import { captureActivityLog } from './middleware/activityLog.middleware.js';
import { prisma } from './lib/prisma.js';
import { getRedis } from './lib/redis.js';
import { verifyAccessToken } from './lib/jwt.js';
import type { JwtPayload } from './middleware/auth.middleware.js';

import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import productRoutes from './routes/product.routes.js';
import categoryRoutes from './routes/category.routes.js';
import cartRoutes from './routes/cart.routes.js';
import wishlistRoutes from './routes/wishlist.routes.js';
import reviewRoutes from './routes/review.routes.js';
import orderRoutes from './routes/order.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import subscriptionRoutes from './routes/subscription.routes.js';
import payoutRoutes from './routes/payout.routes.js';
import walletRoutes from './routes/wallet.routes.js';
import adminRoutes from './routes/admin.routes.js';
import sellerRoutes from './routes/seller.routes.js';
import chatRoutes from './routes/chat.routes.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Trust proxy để lấy IP thực từ request
app.set('trust proxy', 1);

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'templates'));

// Disable X-Powered-By header
app.disable('x-powered-by');

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:', 'http:'],
      fontSrc: ["'self'", 'data:', 'https:', 'http:', 'https://fonts.gstatic.com'],
      connectSrc: ["'self'", env.FRONTEND_URL, 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-origin' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
}));

// Security: Input sanitization is handled by Zod validation + helmet CSP
// xss-clean removed - it conflicts with helmet and has known vulnerabilities
// For XSS protection: validate all input with Zod schemas, use helmet CSP, escape output

app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Disposition', 'X-Total-Count', 'X-Total-Pages'],
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/api/uploads/images', (_req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', env.FRONTEND_URL);
  res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  next();
});
app.get('/api/uploads/images/:filename', (req, res) => {
  const filename = path.basename(req.params.filename || '');
  const imageExt = /\.(jpg|jpeg|png|gif|webp)$/i;
  if (!filename || !imageExt.test(filename)) {
    return res.status(404).json({ success: false, message: 'Image not found' });
  }

  const candidates = [
    path.resolve(process.cwd(), 'uploads', 'images', filename),
    path.resolve(process.cwd(), 'uploads', filename),
  ];
  const imageFile = candidates.find((candidate) => fs.existsSync(candidate));
  if (!imageFile) {
    return res.status(404).json({ success: false, message: 'Image not found' });
  }

  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', env.FRONTEND_URL);
  res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  return res.sendFile(imageFile);
});
app.use('/api/uploads/images', express.static(path.resolve(process.cwd(), 'uploads', 'images')));
app.get('/api/uploads/:filename', (req, res, next) => {
  const filename = path.basename(req.params.filename || '');
  const imageExt = /\.(jpg|jpeg|png|gif|webp)$/i;
  if (!filename || !imageExt.test(filename)) {
    return next();
  }

  const imageFile = path.resolve(process.cwd(), 'uploads', 'images', filename);
  if (fs.existsSync(imageFile)) {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', env.FRONTEND_URL);
    return res.sendFile(imageFile);
  }

  const legacyFile = path.resolve(process.cwd(), 'uploads', filename);
  if (fs.existsSync(legacyFile)) {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', env.FRONTEND_URL);
    return res.sendFile(legacyFile);
  }

  return next();
});
app.use('/api/uploads', (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    } satisfies JwtPayload;
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }

  next();
}, express.static(path.resolve(process.cwd(), 'uploads')));
app.use('/js', express.static(path.join(__dirname, '..', 'public', 'js')));
app.use('/css', express.static(path.join(__dirname, '..', 'public', 'css')));

app.use(apiLimiter);
app.use(captureActivityLog);

// Public pages with EJS templates
app.get('/health', async (req, res) => {
  let dbOk = false, redisOk = false;
  try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch {}
  try { const r = getRedis(); if (r) { await r.ping(); redisOk = true; } } catch {}
  const allOk = dbOk && redisOk;
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    db: dbOk,
    redis: redisOk,
    timestamp: new Date().toISOString(),
  });
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.get('/register', (req, res) => {
  res.render('register');
});

app.get('/verify-email', (req, res) => {
  res.render('verify-email', { token: req.query.token || null });
});

app.get('/forgot-password', (req, res) => {
  res.render('forgot-password');
});

app.get('/reset-password', (req, res) => {
  res.render('reset-password', { token: req.query.token || null });
});

app.use('/docs', express.static(path.join(__dirname, '..', 'docs')));
app.get('/docs', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'docs', 'index.html'));
});

app.get('/', (req, res) => {
  res.json({
    name: 'Mini Marketplace API',
    version: '1.0.0',
    description: 'Backend API for Mini Marketplace',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/payouts', payoutRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/seller', sellerRoutes);
app.use('/api/chat', chatRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint không tồn tại' });
});

app.use(handleUploadError);
app.use(errorHandler);

export default app;
