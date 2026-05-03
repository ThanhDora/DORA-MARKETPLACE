import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
const IMAGE_UPLOAD_DIR = path.join(UPLOAD_DIR, 'images');
const FILE_UPLOAD_DIR = path.join(UPLOAD_DIR, 'files');

fs.mkdirSync(IMAGE_UPLOAD_DIR, { recursive: true });
fs.mkdirSync(FILE_UPLOAD_DIR, { recursive: true });

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_FILE_TYPES = ['application/pdf', 'text/plain', 'application/zip', 'application/x-rar-compressed'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_FILE_SIZE = 100 * 1024 * 1024;

const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, IMAGE_UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 128);
    const uniqueName = `${uuidv4()}_${safeName}`;
    cb(null, uniqueName);
  },
});

const fileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, FILE_UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 128);
    const uniqueName = `${uuidv4()}_${safeName}`;
    cb(null, uniqueName);
  },
});

const imageFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (JPEG, PNG, GIF, WebP)'));
  }
};

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype) || ALLOWED_FILE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type'));
  }
};

export const uploadImage = multer({
  storage: imageStorage,
  fileFilter: imageFilter,
  limits: { fileSize: MAX_IMAGE_SIZE },
});

export const uploadFile = multer({
  storage: fileStorage,
  fileFilter: fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

export const handleUploadError = (err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, message: 'File too large' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(413).json({ success: false, message: 'Too many files' });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
};

export const deleteFile = (filePath: string) => {
  try {
    const safePath = path.resolve(UPLOAD_DIR, path.basename(filePath));
    if (!safePath.startsWith(UPLOAD_DIR + path.sep) && safePath !== UPLOAD_DIR) {
      return;
    }
    fs.unlinkSync(safePath);
  } catch {
    // File already deleted or inaccessible — ignore
  }
};
