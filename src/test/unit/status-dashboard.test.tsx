import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import StatusDashboard from '../../components/StatusDashboard';
import type { Ticket, TicketStatus } from '../../types';
import type { TicketStatsSummary } from '../../api/client';

/**
 * The KPI strip has two sources: the server's SQL aggregate (`stats`) and, while
 * that is in flight, a fallback derived from the loaded page. Both have shipped
 * bugs — the page-derived path under-reported past 100 tickets, and both paths
 * silently dropped `pending_approval` tickets when that status was introduced.
 * These tests pin both paths.
 */

const ticket = (id: string, status: TicketStatus, category = 'general_request'): Ticket =>
  ({
    id,
    code: `REQ-2026-${id.padStart(4, '0')}`,
    title: `Ticket ${id}`,
    description: 'x',
    requesterName: 'Alex',
    requesterEmail: 'alex@company.com',
    requesterDept: 'IT',
    category,
    subcategory: 'troubleshooting',
    priority: 'medium',
    status,
    assignedTo: 'Unassigned',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    comments: [],
    history: [],
  }) as unknown as Ticket;

const statsFixture = (over: Partial<TicketStatsSummary['summary']> = {}): TicketStatsSummary => ({
  period: 'all',
  summary: {
    total: 900,
    submitted: 100,
    pendingApproval: 50,
    waiting: 200,
    resolved: 500,
    rejected: 50,
    pending: 350, // submitted + pendingApproval + waiting
    resolutionRate: 56,
    ...over,
  },
  categories: { general_request: 600, hardware_request: 300 },
  priorities: { low: 100, medium: 400, high: 300, urgent: 100 },
  lastUpdated: '2026-07-13T00:00:00.000Z',
});

/**
 * Read a KPI card's value by its label. Some labels ('Resolved') also appear on
 * status badges further down the page, so scope to the KPI strip, which renders
 * first: take the first matching label and walk up to its card.
 */
const kpi = (label: string) => {
  const labelEl = screen.getAllByText(label)[0];
  const card = labelEl.closest('div')?.parentElement;
  if (!card) throw new Error(`No KPI card found for "${label}"`);
  return within(card).getByText(/^\d+%?$/).textContent;
};

describe('StatusDashboard KPIs from the server aggregate', () => {
  it('reports open tickets from SQL, not from the loaded page', () => {
    // The page holds 2 tickets; the table holds 900. The KPI must show the table.
    render(
      <StatusDashboard
        tickets={[ticket('1', 'submitted'), ticket('2', 'waiting')]}
        total={900}
        stats={statsFixture()}
      />,
    );

    expect(kpi('Open / Active')).toBe('350');
    expect(kpi('Total VOCs')).toBe('900');
    expect(kpi('Resolved')).toBe('500');
  });

  it('counts tickets awaiting approval as open', () => {
    // 100 submitted + 50 pending_approval + 200 waiting. Dropping the gated ones
    // would read 300 — the exact regression introduced with pending_approval.
    render(<StatusDashboard tickets={[]} total={900} stats={statsFixture()} />);
    expect(kpi('Open / Active')).toBe('350');
  });
});

describe('StatusDashboard fallback while stats are loading', () => {
  it('derives open tickets from the page and still counts gated ones', () => {
    render(
      <StatusDashboard
        tickets={[
          ticket('1', 'submitted'),
          ticket('2', 'pending_approval'),
          ticket('3', 'waiting'),
          ticket('4', 'resolved'),
        ]}
        stats={null}
      />,
    );

    expect(kpi('Open / Active')).toBe('3'); // not 2
    expect(kpi('Resolved')).toBe('1');
  });
});

describe('StatusDashboard priority queue', () => {
  it('lists tickets awaiting approval alongside the rest of the open work', () => {
    render(
      <StatusDashboard
        tickets={[ticket('7', 'pending_approval'), ticket('8', 'resolved')]}
        stats={statsFixture()}
      />,
    );

    // The gated ticket is open work someone must chase — it belongs in the queue.
    expect(screen.getByText('REQ-2026-0007')).toBeInTheDocument();
    expect(screen.queryByText('REQ-2026-0008')).not.toBeInTheDocument();
  });

  it('renders a distinct label for the approval state', () => {
    render(<StatusDashboard tickets={[ticket('9', 'pending_approval')]} stats={null} />);
    expect(screen.getAllByText('Awaiting Approval').length).toBeGreaterThan(0);
  });
});
