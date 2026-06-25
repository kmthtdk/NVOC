#!/usr/bin/env node

/**
 * Device Inventory Pivot Table Report Generator
 *
 * Generates comprehensive device inventory reports with pivot tables organized by:
 * - Department × Device Type
 * - Department × Device Status
 *
 * Usage: node scripts/generate_device_report.js <data-file>
 * Example: node scripts/generate_device_report.js devices.json
 */

import fs from 'fs';
import path from 'path';

if (process.argv.length < 3) {
  console.error('Usage: node scripts/generate_device_report.js <data-file>');
  console.error('Example: node scripts/generate_device_report.js devices.json');
  process.exit(1);
}

const dataFile = process.argv[2];
if (!fs.existsSync(dataFile)) {
  console.error(`Error: File not found: ${dataFile}`);
  process.exit(1);
}

// Read devices data
const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const devices = data.data || [];
const total = data.pagination?.total || 0;

console.log('='.repeat(140));
console.log('📱 N-VOC SYSTEM - DEVICE INVENTORY REPORT | Generated: ' + new Date().toISOString().split('T')[0]);
console.log('='.repeat(140));
console.log('');

// PIVOT TABLE 1: Department x Device Type
const deptType = {};
const allDepts = new Set();
const allTypes = new Set();

for (const d of devices) {
  const dept = d.department || 'Unassigned';
  const dtype = d.deviceType || 'unknown';
  if (!deptType[dept]) deptType[dept] = {};
  deptType[dept][dtype] = (deptType[dept][dtype] || 0) + 1;
  allDepts.add(dept);
  allTypes.add(dtype);
}

const deptsSorted = Array.from(allDepts).sort();
const typesSorted = Array.from(allTypes).sort();

console.log('┌─ PIVOT TABLE 1: DEPARTMENT × DEVICE TYPE ' + '─'.repeat(101) + '┐');
console.log('│');

// Header
let header = '│ Department              │' + typesSorted.map(t => ' ' + (t || 'unknown').padEnd(10, ' ') + ' │').join('') + ' Total │';
console.log(header);
console.log('│' + '─'.repeat(138) + '│');

// Rows
for (const dept of deptsSorted) {
  let row = '│ ' + (dept || 'Unassigned').slice(0, 21).padEnd(21, ' ') + ' │';
  let deptTotal = 0;
  for (const dtype of typesSorted) {
    const count = deptType[dept]?.[dtype] || 0;
    deptTotal += count;
    row += ' ' + String(count).padStart(10, ' ') + ' │';
  }
  row += ' ' + String(deptTotal).padStart(5, ' ') + ' │';
  console.log(row);
}

// Totals
console.log('│' + '─'.repeat(138) + '│');
let totalsRow = '│ Total                   │';
for (const dtype of typesSorted) {
  const total_dtype = deptsSorted.reduce((sum, d) => sum + (deptType[d]?.[dtype] || 0), 0);
  totalsRow += ' ' + String(total_dtype).padStart(10, ' ') + ' │';
}
totalsRow += ' ' + String(total).padStart(5, ' ') + ' │';
console.log(totalsRow);
console.log('└' + '─'.repeat(138) + '┘');
console.log('');

// PIVOT TABLE 2: Department x Device Status
const deptStatus = {};
const allStatuses = new Set();

for (const d of devices) {
  const dept = d.department || 'Unassigned';
  const status = d.status || 'unknown';
  if (!deptStatus[dept]) deptStatus[dept] = {};
  deptStatus[dept][status] = (deptStatus[dept][status] || 0) + 1;
  allStatuses.add(status);
}

const statusesSorted = Array.from(allStatuses).sort();

console.log('┌─ PIVOT TABLE 2: DEPARTMENT × DEVICE STATUS ' + '─'.repeat(99) + '┐');
console.log('│');

// Header
let header2 = '│ Department              │' + statusesSorted.map(s => ' ' + (s || 'unknown').padEnd(10, ' ') + ' │').join('') + ' Total │';
console.log(header2);
console.log('│' + '─'.repeat(138) + '│');

// Rows
for (const dept of deptsSorted) {
  let row = '│ ' + (dept || 'Unassigned').slice(0, 21).padEnd(21, ' ') + ' │';
  let deptTotal = 0;
  for (const status of statusesSorted) {
    const count = deptStatus[dept]?.[status] || 0;
    deptTotal += count;
    row += ' ' + String(count).padStart(10, ' ') + ' │';
  }
  row += ' ' + String(deptTotal).padStart(5, ' ') + ' │';
  console.log(row);
}

// Totals
console.log('│' + '─'.repeat(138) + '│');
let totalsRow2 = '│ Total                   │';
for (const status of statusesSorted) {
  const total_status = deptsSorted.reduce((sum, d) => sum + (deptStatus[d]?.[status] || 0), 0);
  totalsRow2 += ' ' + String(total_status).padStart(10, ' ') + ' │';
}
totalsRow2 += ' ' + String(total).padStart(5, ' ') + ' │';
console.log(totalsRow2);
console.log('└' + '─'.repeat(138) + '┘');
console.log('');

// KEY METRICS
console.log('┌─ KEY METRICS ' + '─'.repeat(124) + '┐');
console.log('│');

const activeCount = devices.filter(d => d.status === 'Active').length;
const inStock = devices.filter(d => d.status === 'In Stock').length;
const inRepair = devices.filter(d => d.status === 'In Repair').length;
const unassignedStock = devices.filter(d => d.status === 'In Stock' && !d.assignedTo).length;
const utilization = total > 0 ? Math.round(activeCount / total * 100) : 0;

console.log('│ Total Devices        : ' + String(total).padStart(4, ' ') + '  │  Active                 : ' + String(activeCount).padStart(4, ' ') + '  │  Utilization: ' + String(utilization).padStart(3, ' ') + '%');
console.log('│ In Stock             : ' + String(inStock).padStart(4, ' ') + '      │  In Repair              : ' + String(inRepair).padStart(4, ' ') + '      │');
console.log('│ Assigned             : ' + String(activeCount).padStart(4, ' ') + '      │  Unassigned In Stock    : ' + String(unassignedStock).padStart(4, ' '));
console.log('│');
console.log('└' + '─'.repeat(138) + '┘');
console.log('');

console.log('='.repeat(140));
