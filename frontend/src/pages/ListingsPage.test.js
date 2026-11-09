import { act, render, screen, fireEvent } from '@testing-library/react';
import ListingsPage from './ListingsPage';
import { fetchProperties } from '../api/client';

jest.mock('../api/client', () => ({ ...jest.requireActual('../api/client'), fetchProperties: jest.fn() }));
const result = address => ({ total: 1, results: [{ L_ListingID: address, L_Address: address }] });
function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}
beforeEach(() => jest.clearAllMocks());
test('shows loading then real result count and cards', async () => {
  fetchProperties.mockResolvedValue(result('Garden Lane'));
  render(<ListingsPage />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading');
  expect(await screen.findByText('Garden Lane')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Showing 1 of 1 properties');
});
test('displays API errors and allows retry', async () => {
  fetchProperties.mockRejectedValueOnce(new Error('Service unavailable')).mockResolvedValueOnce(result('Retry Lane'));
  render(<ListingsPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Service unavailable');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('Retry Lane')).toBeInTheDocument();
});
test('displays an empty search state', async () => {
  fetchProperties.mockResolvedValue({ total: 0, results: [] });
  render(<ListingsPage />);
  expect(await screen.findByText('No properties found.')).toBeInTheDocument();
});
test('search, clear, search cannot flash old cards or accept stale responses', async () => {
  const first = deferred();
  const clear = deferred();
  const last = deferred();
  fetchProperties.mockResolvedValueOnce(result('Initial Lane'))
    .mockReturnValueOnce(first.promise).mockReturnValueOnce(clear.promise).mockReturnValueOnce(last.promise);
  render(<ListingsPage />);
  await screen.findByText('Initial Lane');
  fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Irvine' } });
  fireEvent.click(screen.getByRole('button', { name: /Search properties/ }));
  expect(screen.queryByText('Initial Lane')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Clear filters/ }));
  expect(fetchProperties.mock.calls[1][1].signal.aborted).toBe(true);
  fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Tustin' } });
  fireEvent.click(screen.getByRole('button', { name: /Search properties/ }));
  expect(fetchProperties.mock.calls[2][1].signal.aborted).toBe(true);
  await act(async () => { first.resolve(result('Stale Irvine')); clear.resolve(result('Stale Clear')); });
  expect(screen.queryByText(/Stale/)).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Loading');
  await act(async () => { last.resolve(result('Fresh Tustin')); });
  expect(screen.getByText('Fresh Tustin')).toBeInTheDocument();
  expect(fetchProperties).toHaveBeenLastCalledWith({ city: 'Tustin', limit: 20, offset: 0 }, expect.any(Object));
});
