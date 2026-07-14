/**
 * Navigation vocabulary, shared by the App shell and the page components.
 *
 * These used to be private types inside App.tsx alongside the useState that held
 * the "current tab". The URL is the source of truth now; App maps the path to
 * these, and the pages just render what they are told.
 */
export type PortalView = 'user' | 'admin';
export type UserTab = 'new' | 'requests';
export type AdminTab = 'tickets' | 'devices' | 'reports' | 'approval';
export type DeviceSubTab = 'management' | 'allocation' | 'reports';

export function adminTabFromPath(pathname: string): AdminTab {
  if (pathname.startsWith('/admin/devices')) return 'devices';
  if (pathname.startsWith('/admin/reports')) return 'reports';
  if (pathname.startsWith('/admin/approval')) return 'approval';
  return 'tickets';
}

/**
 * Rows fetched for the dispatch console and the dashboard's priority queue. KPI
 * counts do NOT come from this page — they come from the SQL aggregate in
 * api.getStatsSummary(), so they stay correct past this page size.
 */
export const METRICS_PAGE_SIZE = 100;
