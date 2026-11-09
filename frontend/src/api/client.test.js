import { fetchProperties } from './client';

beforeEach(() => { global.fetch = jest.fn(); });
afterEach(() => { delete global.fetch; });
const data = { total: 1, results: [{ L_ListingID: '123' }] };

test('encodes combined filters, trims values, omits empty values, and preserves zero', async () => {
  fetch.mockResolvedValue({ ok: true, json: async () => data });
  await expect(fetchProperties({ city: ' Los Angeles ', zipcode: '', minPrice: 0, beds: 3, baths: null })).resolves.toEqual(data);
  expect(fetch.mock.calls[0][0]).toBe('/api/properties?city=Los+Angeles&minPrice=0&beds=3');
});
test('reports API validation errors', async () => {
  fetch.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'Invalid ZIP code' }) });
  await expect(fetchProperties()).rejects.toThrow('Invalid ZIP code');
});
test('reports connection failures', async () => {
  fetch.mockRejectedValue(new TypeError('Failed to fetch'));
  await expect(fetchProperties()).rejects.toThrow('Unable to reach the property service');
});
test('reports non-JSON proxy errors', async () => {
  fetch.mockResolvedValue({ ok: false, status: 502, json: async () => { throw new SyntaxError(); } });
  await expect(fetchProperties()).rejects.toThrow('HTTP 502');
});
test('rejects malformed successful responses', async () => {
  fetch.mockResolvedValue({ ok: true, json: async () => ({ results: null }) });
  await expect(fetchProperties()).rejects.toThrow('invalid response');
});
test('passes the abort signal through and preserves cancellation', async () => {
  const controller = new AbortController();
  const error = new DOMException('Aborted', 'AbortError');
  fetch.mockRejectedValue(error);
  await expect(fetchProperties({}, { signal: controller.signal })).rejects.toBe(error);
  expect(fetch.mock.calls[0][1].signal).toBe(controller.signal);
});
