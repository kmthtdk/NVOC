import path from 'node:path';
import fs from 'node:fs';
import type { Request, Response } from 'express';
import { ticketRepo } from '../models/ticket.repo.js';
import { attachmentRepo } from '../models/attachment.repo.js';
import { UPLOAD_DIR } from '../middleware/upload.js';
import { AppError } from '../utils/AppError.js';

function parseId(raw: string, label: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw AppError.badRequest(`Invalid ${label} id`);
  return id;
}

export const attachmentController = {
  /** POST /tickets/:id/attachments — multipart upload; persists metadata. */
  async upload(req: Request, res: Response): Promise<void> {
    const ticketId = parseId(req.params.id, 'ticket');
    if (!(await ticketRepo.exists(ticketId))) {
      // Clean up any files multer already wrote to disk before bailing.
      cleanupFiles(req.files);
      throw AppError.notFound('Ticket not found');
    }

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) throw AppError.badRequest('No files provided (field name: files)');

    const uploadedBy = req.user?.name ?? null;
    const attachments = await attachmentRepo.createMany(
      ticketId,
      files.map((f) => ({
        originalName: f.originalname,
        storedName: f.filename,
        mimeType: f.mimetype,
        sizeBytes: f.size,
        uploadedBy,
      })),
    );

    res.status(201).json({ attachments });
  },

  /** GET /attachments/:id — stream the file back with original filename. */
  async download(req: Request, res: Response): Promise<void> {
    const id = parseId(req.params.id, 'attachment');
    const row = await attachmentRepo.findById(id);
    if (!row) throw AppError.notFound('Attachment not found');

    // Resolve safely inside the upload dir (defense against traversal).
    const filePath = path.resolve(UPLOAD_DIR, row.stored_name);
    if (!filePath.startsWith(path.resolve(UPLOAD_DIR)) || !fs.existsSync(filePath)) {
      throw AppError.notFound('File no longer available on disk');
    }

    res.setHeader('Content-Type', row.mime_type);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(row.original_name)}"`,
    );
    fs.createReadStream(filePath).pipe(res);
  },
};

function cleanupFiles(files: Request['files']): void {
  const list = Array.isArray(files) ? files : [];
  for (const f of list) {
    fs.promises.unlink(f.path).catch(() => undefined);
  }
}
