// ============================================================================
// DeviceImportModal — bulk CSV import of devices.
// VOC-native version: validates rows against the `devices` contract, then
// POSTs each valid row to /api/devices. Reports per-row errors before commit.
//
// Expected CSV header (case-insensitive):
//   deviceType,model,serialNumber,status,assignedTo,department,purchaseDate,warrantyExpiry,notes
// status must be one of: Active | In Repair | Retired | Lost
// dates (purchaseDate, warrantyExpiry) must be YYYY-MM-DD or blank
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { X, Upload, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { Spinner } from './ui/Spinner';

type DeviceStatus = 'Active' | 'In Repair' | 'Retired' | 'Lost';

const STATUS_VALUES: DeviceStatus[] = ['Active', 'In Repair', 'Retired', 'Lost'];

const REQUIRED_HEADERS = ['devicetype', 'model', 'serialnumber'];
const KNOWN_HEADERS = [
  'devicetype',
  'model',
  'serialnumber',
  'status',
  'assignedto',
  'department',
  'purchasedate',
  'warrantyexpiry',
  'notes',
];

interface ParsedRow {
  rowNumber: number;
  raw: Record<string, string>;
  errors: string[];
}

interface DeviceImportModalProps {
  onClose: () => void;
  /** Called after a successful import so the parent can refresh its list. */
  onImported: (createdCount: number) => void;
  apiBaseUrl?: string;
  authToken?: string;
}

/** Minimal RFC-4180-ish CSV line splitter (handles quoted fields with commas). */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

const dateOk = (v: string) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v);

function validateRow(raw: Record<string, string>, rowNumber: number, seenSerials: Set<string>): ParsedRow {
  const errors: string[] = [];
  if (!raw.devicetype) errors.push('deviceType is required');
  if (!raw.model) errors.push('model is required');
  if (!raw.serialnumber) errors.push('serialNumber is required');

  if (raw.serialnumber) {
    const key = raw.serialnumber.toLowerCase();
    if (seenSerials.has(key)) errors.push(`duplicate serialNumber "${raw.serialnumber}" in file`);
    else seenSerials.add(key);
  }

  if (raw.status && !STATUS_VALUES.includes(raw.status as DeviceStatus)) {
    errors.push(`invalid status "${raw.status}" (expected ${STATUS_VALUES.join(', ')})`);
  }
  if (!dateOk(raw.purchasedate || '')) errors.push('purchaseDate must be YYYY-MM-DD');
  if (!dateOk(raw.warrantyexpiry || '')) errors.push('warrantyExpiry must be YYYY-MM-DD');

  return { rowNumber, raw, errors };
}

export default function DeviceImportModal({
  onClose,
  onImported,
  apiBaseUrl = '/api',
  authToken = '',
}: DeviceImportModalProps) {
  const toast = useToast();
  const closeRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string>('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [headerError, setHeaderError] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const parseFile = (file: File) => {
    setFileName(file.name);
    setHeaderError('');
    setRows([]);

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        setHeaderError('File must contain a header row and at least one data row.');
        return;
      }

      const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
      const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
      if (missing.length > 0) {
        setHeaderError(`Missing required column(s): ${missing.join(', ')}`);
        return;
      }
      const unknown = headers.filter((h) => !KNOWN_HEADERS.includes(h));
      if (unknown.length > 0) {
        setHeaderError(`Unknown column(s): ${unknown.join(', ')}`);
        return;
      }

      const seenSerials = new Set<string>();
      const parsed: ParsedRow[] = lines.slice(1).map((line, idx) => {
        const cells = splitCsvLine(line);
        const raw: Record<string, string> = {};
        headers.forEach((h, i) => {
          raw[h] = cells[i] ?? '';
        });
        return validateRow(raw, idx + 2, seenSerials);
      });
      setRows(parsed);
    };
    reader.onerror = () => setHeaderError('Could not read the file.');
    reader.readAsText(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
  };

  const validRows = rows.filter((r) => r.errors.length === 0);
  const errorRows = rows.filter((r) => r.errors.length > 0);

  const handleImport = async () => {
    if (validRows.length === 0) {
      toast.info('There are no valid rows to import.');
      return;
    }

    setImporting(true);
    let created = 0;
    const failures: string[] = [];

    for (const row of validRows) {
      const payload = {
        deviceType: row.raw.devicetype,
        model: row.raw.model,
        serialNumber: row.raw.serialnumber,
        status: (row.raw.status as DeviceStatus) || 'Active',
        assignedTo: row.raw.assignedto || null,
        department: row.raw.department || null,
        purchaseDate: row.raw.purchasedate || null,
        warrantyExpiry: row.raw.warrantyexpiry || null,
        notes: row.raw.notes || null,
      };
      try {
        const res = await fetch(`${apiBaseUrl}/devices`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error?.message || body?.message || `HTTP ${res.status}`);
        }
        created++;
      } catch (err) {
        failures.push(`Row ${row.rowNumber}: ${err instanceof Error ? err.message : 'failed'}`);
      }
    }

    setImporting(false);

    if (created > 0) toast.success(`Imported ${created} device(s).`);
    if (failures.length > 0) {
      toast.error(`${failures.length} row(s) failed. See console for details.`);
      // eslint-disable-next-line no-console
      console.error('Device import failures:\n' + failures.join('\n'));
    }
    if (created > 0) {
      onImported(created);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="device-import-title"
    >
      <div className="w-full max-w-2xl rounded-lg bg-white dark:bg-slate-900 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-6 py-4">
          <h2 id="device-import-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Import Devices (CSV)
          </h2>
          <button
            ref={closeRef}
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors ${
              dragActive
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-slate-300 dark:border-slate-600'
            }`}
          >
            <Upload className="h-8 w-8 text-slate-400" />
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {fileName ? (
                <span className="inline-flex items-center gap-1 font-medium">
                  <FileText className="h-4 w-4" /> {fileName}
                </span>
              ) : (
                'Drag & drop a CSV file here, or click to browse'
              )}
            </p>
            <p className="text-xs text-slate-400">
              Columns: deviceType, model, serialNumber, status, assignedTo, department,
              purchaseDate, warrantyExpiry, notes
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) parseFile(file);
              }}
            />
          </div>

          {headerError && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{headerError}</span>
            </div>
          )}

          {rows.length > 0 && !headerError && (
            <>
              <div className="flex gap-4 text-sm">
                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" /> {validRows.length} valid
                </span>
                <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400">
                  <AlertCircle className="h-4 w-4" /> {errorRows.length} with errors
                </span>
              </div>

              {errorRows.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800">
                      <tr>
                        <th className="px-3 py-2 font-medium">Row</th>
                        <th className="px-3 py-2 font-medium">Serial</th>
                        <th className="px-3 py-2 font-medium">Errors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {errorRows.map((r) => (
                        <tr key={r.rowNumber} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="px-3 py-2">{r.rowNumber}</td>
                          <td className="px-3 py-2">{r.raw.serialnumber || '—'}</td>
                          <td className="px-3 py-2 text-red-600 dark:text-red-400">
                            {r.errors.join('; ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-3 border-t border-slate-200 dark:border-slate-700 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={importing}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || validRows.length === 0}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {importing ? <Spinner /> : <Upload className="h-4 w-4" />}
              Import {validRows.length > 0 ? `${validRows.length} ` : ''}Device(s)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
