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
beforeEach(() => { jest.clearAllMocks(); window.scrollTo = jest.fn(); });
test('shows loading then real result count and cards', async () => {
  fetchProperties.mockResolvedValue(result('Garden Lane'));
  render(<ListingsPage />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading');
  expect(await screen.findByText('Garden Lane')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Showing 1-1 of 1 properties');
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

const pageResult = (total, start, count = 20) => ({
  total, results: Array.from({ length: count }, (_, i) => ({ L_ListingID: String(start + i), L_Address: `Home ${start + i}` })),
});
test('pagination preserves applied filters, shows ranges, and search/clear reset page one', async () => {
  fetchProperties.mockResolvedValueOnce(pageResult(55, 1))
    .mockResolvedValueOnce(pageResult(45, 1))
    .mockResolvedValueOnce(pageResult(45, 21))
    .mockResolvedValueOnce(pageResult(45, 41, 5))
    .mockResolvedValueOnce(pageResult(55, 1))
    .mockResolvedValueOnce(pageResult(55, 21))
    .mockResolvedValueOnce(pageResult(45, 1));
  render(<ListingsPage />);
  await screen.findByText('Home 1');
  fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Irvine' } });
  fireEvent.click(screen.getByRole('button', { name: /Search properties/ }));
  await screen.findByText('Home 1');
  // An unsubmitted draft must not replace the filters used for pagination.
  fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Tustin' } });
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByText('Home 21');
  expect(fetchProperties).toHaveBeenLastCalledWith({ city: 'Irvine', limit: 20, offset: 20 }, expect.any(Object));
  expect(screen.getByRole('status')).toHaveTextContent('Showing 21-40 of 45 properties');
  expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  fireEvent.click(screen.getByRole('button', { name: 'Page 3' }));
  await screen.findByText('Home 41');
  expect(screen.getByRole('status')).toHaveTextContent('Showing 41-45 of 45 properties');
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: /Clear filters/ }));
  await screen.findByText('Home 1');
  expect(fetchProperties).toHaveBeenLastCalledWith({ limit: 20, offset: 0 }, expect.any(Object));
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByText('Home 21');
  fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Tustin' } });
  fireEvent.click(screen.getByRole('button', { name: /Search properties/ }));
  await screen.findByText('Home 1');
  expect(fetchProperties).toHaveBeenLastCalledWith({ city: 'Tustin', limit: 20, offset: 0 }, expect.any(Object));
});
test('retry preserves a failed page and its filters', async () => {
  fetchProperties.mockResolvedValueOnce(pageResult(21, 1))
    .mockRejectedValueOnce(new Error('Temporary failure'))
    .mockResolvedValueOnce(pageResult(21, 21, 1));
  render(<ListingsPage />);
  await screen.findByText('Home 1');
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText('Home 21');
  expect(fetchProperties).toHaveBeenLastCalledWith({ limit: 20, offset: 20 }, expect.any(Object));
});
test('a new search cancels an in-flight page and ignores its late results', async () => {
  const pending = deferred();
  fetchProperties.mockResolvedValueOnce(pageResult(40, 1)).mockReturnValueOnce(pending.promise)
    .mockResolvedValueOnce(result('Fresh Search'));
  render(<ListingsPage />);
  await screen.findByText('Home 1');
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.queryByText('Home 1')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Clear filters/ }));
  await screen.findByText('Fresh Search');
  expect(fetchProperties.mock.calls[1][1].signal.aborted).toBe(true);
  await act(async () => pending.resolve(pageResult(40, 21)));
  expect(screen.queryByText('Home 21')).not.toBeInTheDocument();
});
test('recovers to the last page when the total shrinks', async () => {
  fetchProperties.mockResolvedValueOnce(pageResult(40, 1))
    .mockResolvedValueOnce({ total: 5, results: [] })
    .mockResolvedValueOnce(pageResult(5, 1, 5));
  render(<ListingsPage />);
  await screen.findByText('Home 1');
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByText('Showing 1-5 of 5 properties');
  expect(fetchProperties).toHaveBeenLastCalledWith({ limit: 20, offset: 0 }, expect.any(Object));
  expect(screen.queryByRole('navigation', { name: 'Property pages' })).not.toBeInTheDocument();
});
