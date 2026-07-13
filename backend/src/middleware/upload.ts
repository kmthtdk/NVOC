import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

// Ensure the upload directory exists at boot.
const uploadDir = path.resolve(env.UPLOAD_DIR);
fs.mkdirSync(uploadDir, { recursive: true });

/**
 * Disk storage: persist with a UUID filename (avoids collisions / path traversal),
 * keep the original name only as DB metadata. File bytes go to the uploads volume.
 */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 12); // bound the extension length
    cb(null, `${uuidv4()}${ext}`);
  },
});

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export const upload = multer({
  storage,
  limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    // A bare Error() here has no `.code`, so the central handler would fall
    // through to its catch-all and answer 500 — logging ordinary user input as
    // an "Unhandled error". AppError is matched first and maps to a clean 400.
    cb(AppError.badRequest(`Unsupported file type: ${file.mimetype}`));
  },
});

export const UPLOAD_DIR = uploadDir;
