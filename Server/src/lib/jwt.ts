import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma.js';
import { env } from '../config/env.js';

const JWT_SECRET = env.JWT_SECRET;
const JWT_REFRESH_SECRET = env.JWT_REFRESH_SECRET;

interface TokenPayload {
  userId: number;
  email: string;
  role: string;
}

export const generateAccessToken = (userId: number, email: string, role: string): string => {
  return jwt.sign({ userId, email, role }, JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
};

export const generateRefreshToken = (userId: number): string => {
  return jwt.sign(
    { userId, jti: randomBytes(16).toString('hex') },
    JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions,
  );
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
};

export const verifyRefreshToken = async (token: string): Promise<{ userId: number }> => {
  return jwt.verify(token, JWT_REFRESH_SECRET) as { userId: number };
};

export const saveRefreshToken = async (userId: number, token: string): Promise<void> => {
  const expiresAt = new Date();
  const match = env.JWT_REFRESH_EXPIRES_IN.match(/^(\d+)([dhms])$/);
  if (match) {
    const value = parseInt(match[1]);
    const unit = match[2];
    switch (unit) {
      case 'd': expiresAt.setDate(expiresAt.getDate() + value); break;
      case 'h': expiresAt.setHours(expiresAt.getHours() + value); break;
      case 'm': expiresAt.setMinutes(expiresAt.getMinutes() + value); break;
      case 's': expiresAt.setSeconds(expiresAt.getSeconds() + value); break;
      default: expiresAt.setDate(expiresAt.getDate() + 7);
    }
  } else {
    expiresAt.setDate(expiresAt.getDate() + 7);
  }

  await prisma.refreshToken.create({
    data: { userId, token, expiresAt, isValid: true },
  });
};

export const revokeRefreshToken = async (token: string): Promise<void> => {
  await prisma.refreshToken.updateMany({
    where: { token },
    data: { isValid: false },
  });
};

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 12);
};

export const comparePassword = async (password: string, hashedPassword?: string | null): Promise<boolean> => {
  if (!hashedPassword) {
    return false;
  }
  return bcrypt.compare(password, hashedPassword);
};

export const generateEmailVerificationToken = (email: string): string => {
  return jwt.sign({ email }, JWT_SECRET, { expiresIn: env.JWT_EMAIL_VERIFICATION_EXPIRES_IN } as jwt.SignOptions);
};

export const verifyEmailToken = async (token: string): Promise<string> => {
  const decoded = jwt.verify(token, JWT_SECRET) as { email: string };
  return decoded.email;
};

export const generatePasswordResetToken = (userId: number): string => {
  return jwt.sign({ userId, type: 'reset' }, JWT_SECRET, { expiresIn: env.JWT_PASSWORD_RESET_EXPIRES_IN } as jwt.SignOptions);
};

export const verifyPasswordResetToken = async (token: string): Promise<number> => {
  const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; type: string };
  if (decoded.type !== 'reset') throw new Error('Invalid token type');
  return decoded.userId;
};

export const encryptData = async (data: string): Promise<string> => {
  const ENCRYPTION_KEY = env.ENCRYPTION_KEY;
  if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  const iv = randomBytes(16);
  const salt = Buffer.from(env.ENCRYPTION_SALT, 'hex');
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    scrypt(key, salt, 32, (err, key) => err ? reject(err) : resolve(key));
  });
  const cipher = createCipheriv('aes-256-gcm', derivedKey, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
};

export const decryptData = async (encryptedData: string): Promise<string> => {
  const ENCRYPTION_KEY = env.ENCRYPTION_KEY;
  if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error('Invalid encrypted data format');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  if (iv.length !== 16) throw new Error('Invalid IV length');
  if (authTag.length !== 16) throw new Error('Invalid auth tag length');
  const k = Buffer.from(ENCRYPTION_KEY, 'hex');
  const salt = Buffer.from(env.ENCRYPTION_SALT, 'hex');
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    scrypt(k, salt, 32, (err, key) => err ? reject(err) : resolve(key));
  });
  const decipher = createDecipheriv('aes-256-gcm', derivedKey, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};
