import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import CommandBar from '../../components/shell/CommandBar';
import { api } from '../../api/client';

/**
 * The command bar hardcoded /admin/tickets for every ticket hit. A requester is
 * not allowed on that route: App's guard bounces them to /requests with
 * `replace`, which drops the ?ticket= query string on the way out — so pressing
 * Enter on your own ticket opened nothing at all, for the role that files most
 * of the tickets. It was "verified in a browser" only as an admin, the one
 * account for which the route is legal.
 *
 * These tests pin the destination per role, and pin that a requester is never
 * offered the device inventory they cannot read.
 */

const ticketHit = {
  id: '7',
  code: 'GR-2026-0007',
  title: 'Laptop will not boot',
  status: 'submitted' as const,
};

function LocationSpy() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname + loc.search}</div>;
}

const renderBar = (props: { canSeeDevices: boolean; ticketBasePath: string }) =>
  render(
    <MemoryRouter initialEntries={['/requests']}>
      <CommandBar {...props} />
      <Routes>
        <Route path="*" element={<LocationSpy />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api, 'listTickets').mockResolvedValue({
    data: [ticketHit],
    total: 1,
    page: 1,
    pageSize: 5,
  } as never);
  vi.spyOn(api, 'listDevices').mockResolvedValue({ data: [] } as never);
});

/** Open the palette and type a term that the mocked API answers. */
const openAndSearch = (triggerLabel: string) => {
  fireEvent.click(screen.getByLabelText(triggerLabel));
  const input = screen.getByRole('dialog').querySelector('input');
  if (!input) throw new Error('the command palette rendered without an input');
  fireEvent.change(input, { target: { value: 'laptop' } });
};

describe('CommandBar destination', () => {
  it('sends a requester to their own portal, keeping the ticket in the URL', async () => {
    renderBar({ canSeeDevices: false, ticketBasePath: '/requests' });
    openAndSearch('Search tickets');

    fireEvent.click(await screen.findByText('Laptop will not boot', {}, { timeout: 3000 }));

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/requests?ticket=7'),
    );
  });

  it('sends IT support to the admin queue, keeping the ticket in the URL', async () => {
    renderBar({ canSeeDevices: true, ticketBasePath: '/admin/tickets' });
    openAndSearch('Search tickets and devices');

    fireEvent.click(await screen.findByText('Laptop will not boot', {}, { timeout: 3000 }));

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/admin/tickets?ticket=7'),
    );
  });
});

describe('CommandBar device access', () => {
  it('never queries the device inventory on behalf of a requester', async () => {
    renderBar({ canSeeDevices: false, ticketBasePath: '/requests' });
    openAndSearch('Search tickets');

    await screen.findByText('Laptop will not boot', {}, { timeout: 3000 });
    expect(api.listDevices).not.toHaveBeenCalled();
  });

  it('does query devices for IT support', async () => {
    renderBar({ canSeeDevices: true, ticketBasePath: '/admin/tickets' });
    openAndSearch('Search tickets and devices');

    await waitFor(() => expect(api.listDevices).toHaveBeenCalled(), { timeout: 3000 });
  });
});
