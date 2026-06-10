import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { CourtDetails } from '../components/CourtDetails';
import { I18nProvider } from '../i18n';
import type { Court } from '../types';

// No network in component tests: enrichment calls are mocked.
vi.mock('../api/nominatim', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/nominatim')>()),
  reverseArea: vi.fn().mockResolvedValue('Lehen, Salzburg, Österreich'),
}));
vi.mock('../api/commons', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/commons')>()),
  findNearbyPhoto: vi.fn().mockResolvedValue(null),
}));

function Providers({ children }: { children: ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}

const court: Court = {
  id: 'node/123',
  lat: 47.8,
  lon: 13.05,
  name: 'Lehener Park Court',
  surface: 'asphalt',
  hoops: 2,
  lit: true,
  covered: null,
  indoor: null,
  access: 'public',
  openingHours: null,
  website: null,
  address: null,
  image: null,
  wikimediaCommons: null,
};

describe('CourtDetails', () => {
  it('shows name, translated facts and source link', async () => {
    render(<CourtDetails court={court} onClose={() => {}} />, { wrapper: Providers });

    expect(screen.getByText('Lehener Park Court')).toBeInTheDocument();
    expect(screen.getByText('Asphalt')).toBeInTheDocument();
    expect(screen.getByText('öffentlich')).toBeInTheDocument();
    expect(await screen.findByText('Lehen, Salzburg, Österreich')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /OpenStreetMap/ })).toHaveAttribute(
      'href',
      'https://www.openstreetmap.org/node/123',
    );
  });

  it('links directions to the court coordinates', () => {
    render(<CourtDetails court={court} onClose={() => {}} />, { wrapper: Providers });
    expect(screen.getByRole('link', { name: /Route planen/ })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/dir/?api=1&destination=47.8,13.05',
    );
  });

  it('falls back to a generic title for unnamed courts and hides unknown facts', () => {
    render(
      <CourtDetails
        court={{ ...court, name: null, surface: null, hoops: null, lit: null, access: null }}
        onClose={() => {}}
      />,
      { wrapper: Providers },
    );
    expect(screen.getByText('Basketballplatz')).toBeInTheDocument();
    expect(screen.queryByText('Belag')).not.toBeInTheDocument();
    expect(screen.queryByText('Körbe')).not.toBeInTheDocument();
  });

  it('closes via the close button and via Escape', () => {
    const onClose = vi.fn();
    render(<CourtDetails court={court} onClose={onClose} />, { wrapper: Providers });

    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
