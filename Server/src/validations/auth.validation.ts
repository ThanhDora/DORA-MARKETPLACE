import { z } from 'zod';

// Common weak passwords blocklist
const COMMON_WEAK_PASSWORDS = new Set([
  'password', 'password1', 'password123', 'password1234', 'password12345',
  '123456', '1234567', '12345678', '123456789', '1234567890',
  'qwerty', 'qwerty123', 'qwerty1234', 'qwertyuiop', 'asdfghjkl',
  'letmein', 'welcome', 'welcome1', 'welcome123',
  'admin', 'admin123', 'administrator', 'root', 'root123',
  'login', 'login123', 'pass', 'pass123', 'pass1234',
  'changeme', 'changeme123', 'default', 'default123',
  'test', 'test123', 'testing', 'test1234',
  '1234', '12345', '123123', '12341234',
  'abcdef', 'abcdefg', 'abcdefgh',
  '111111', '222222', '333333', '444444', '555555',
  '666666', '777777', '888888', '999999', '000000',
  'monkey', 'dragon', 'master', 'login', 'abc123',
  'football', 'baseball', 'soccer', 'hockey',
  'iloveyou', 'princess', 'sunshine', 'shadow', 'michael',
  'ninja', 'mustang', 'batman', 'trustno1', 'access',
  '123qwe', '1qaz2wsx', 'qazwsx', 'zaq12wsx',
  'admin1234', 'rootroot', 'pass123!', 'password!',
  'Password1', 'Password1!', 'Password123', 'Password123!',
  'Admin123', 'Admin123!', 'User123', 'User123!',
  'Welcome1', 'Welcome1!', 'Qwerty123', 'Qwerty123!',
  'Asdf123', 'Asdf123!', 'Test123!', 'Test1234!',
]);

// Check if password contains weak patterns
const isWeakPassword = (password: string): boolean => {
  const lower = password.toLowerCase();
  
  // Check blocklist
  if (COMMON_WEAK_PASSWORDS.has(lower)) return true;
  
  // Check sequential characters
  const sequences = ['0123456789', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  for (const seq of sequences) {
    for (let i = 0; i <= seq.length - 4; i++) {
      if (lower.includes(seq.slice(i, i + 4))) return true;
      if (lower.includes(seq.slice(i, i + 4).split('').reverse().join(''))) return true;
    }
  }
  
  // Check repeated characters (4+ same)
  if (/(.)\1{3,}/.test(password)) return true;
  
  // Check keyboard patterns (4+)
  const keyboardRows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  for (const row of keyboardRows) {
    for (let i = 0; i <= row.length - 4; i++) {
      if (lower.includes(row.slice(i, i + 4))) return true;
    }
  }
  
  return false;
};

// Password validation with weak password check
const passwordValidation = z
  .string()
  .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
  .max(128, 'Mật khẩu không được quá 128 ký tự')
  .regex(/[A-Z]/, 'Mật khẩu phải chứa ít nhất 1 chữ hoa')
  .regex(/[a-z]/, 'Mật khẩu phải chứa ít nhất 1 chữ thường')
  .regex(/[0-9]/, 'Mật khẩu phải chứa ít nhất 1 số')
  .regex(/[^A-Za-z0-9]/, 'Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt')
  .refine(
    (pwd) => !isWeakPassword(pwd),
    'Mật khẩu quá yếu, vui lòng chọn mật khẩu khác'
  );

export const registerSchema = z.object({
  name: z.string().min(1, 'Tên là bắt buộc').max(100),
  email: z.string().email('Email không hợp lệ'),
  password: passwordValidation,
  role: z.enum(['USER', 'SELLER']).optional().default('USER'),
});

export const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(1, 'Mật khẩu là bắt buộc'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
});

export const resendVerificationSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token là bắt buộc'),
  password: passwordValidation,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mật khẩu hiện tại là bắt buộc'),
  newPassword: passwordValidation,
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token là bắt buộc'),
});

export const deleteAccountSchema = z.object({
  confirmPassword: z.string().min(1, 'Mật khẩu xác nhận là bắt buộc'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
