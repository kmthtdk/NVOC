import { pool } from '../config/db.js';
import type { AttachmentRow } from './rows.js';
import { mapAttachment } from './mappers.js';
import type { AttachmentMeta } from '../types/index.js';

export const attachmentRepo = {
  async listByTicket(ticketId: number): Promise<AttachmentMeta[]> {
    const [rows] = await pool.query<AttachmentRow[]>(
      'SELECT * FROM attachments WHERE ticket_id = ? ORDER BY created_at ASC, id ASC',
      [ticketId],
    );
    return rows.map(mapAttachment);
  },

  async createMany(
    ticketId: number,
    files: Array<{
      originalName: string;
      storedName: string;
      mimeType: string;
      sizeBytes: number;
      uploadedBy: string | null;
    }>,
  ): Promise<AttachmentMeta[]> {
    const created: AttachmentMeta[] = [];
    for (const f of files) {
      const [result] = await pool.execute(
        `INSERT INTO attachments (ticket_id, original_name, stored_name, mime_type, size_bytes, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [ticketId, f.originalName, f.storedName, f.mimeType, f.sizeBytes, f.uploadedBy],
      );
      const id = (result as { insertId: number }).insertId;
      const [rows] = await pool.query<AttachmentRow[]>('SELECT * FROM attachments WHERE id = ?', [id]);
      created.push(mapAttachment(rows[0]));
    }
    return created;
  },

  async findById(id: number): Promise<AttachmentRow | null> {
    const [rows] = await pool.query<AttachmentRow[]>('SELECT * FROM attachments WHERE id = ? LIMIT 1', [id]);
    return rows[0] ?? null;
  },
};
