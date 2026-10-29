import { afterEach, describe, expect, it } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { HashBridge } from './HashBridge';

function Where() { return <span data-testid="where">{useLocation().pathname}</span>; }
const setup = () => render(
  <MemoryRouter initialEntries={['/analytics']}>
    <HashBridge />
    <Routes><Route path="*" element={<Where />} /></Routes>
  </MemoryRouter>,
);

afterEach(() => { window.location.hash = ''; });

describe('HashBridge (old #links keep working)', () => {
  it('opens the screen named by the hash on load and clears the hash', async () => {
    window.location.hash = '#menu';
    await act(async () => { setup(); });
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/menu'));
    expect(window.location.hash).toBe('');
  });

  it('understands the classic #tab-menu form too', async () => {
    window.location.hash = '#tab-bills';
    await act(async () => { setup(); });
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/bills'));
  });

  it('follows the hash when it changes while the app is open', async () => {
    setup();
    expect(screen.getByTestId('where')).toHaveTextContent('/analytics');
    await act(async () => {
      window.location.hash = '#users';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/users'));
  });

  it('ignores hashes that are not screens', async () => {
    window.location.hash = '#whatever';
    setup();
    expect(screen.getByTestId('where')).toHaveTextContent('/analytics');
  });
});
