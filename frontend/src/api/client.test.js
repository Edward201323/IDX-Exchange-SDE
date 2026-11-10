import { fetchProperties, fetchPropertyDetail } from './client';

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

test('fetches full property details by listing ID and preserves nullable legacy fields', async () => {
  const property = { id: 42, L_ListingID: '00123', L_Address: 'Garden Lane', L_Photos: '{broken', YearBuilt: null };
  fetch.mockResolvedValue({ ok: true, json: async () => property });
  const controller = new AbortController();
  await expect(fetchPropertyDetail('00123', { signal: controller.signal })).resolves.toEqual(property);
  expect(fetch).toHaveBeenCalledWith('/api/properties/00123', {
    signal: controller.signal, headers: { Accept: 'application/json' },
  });
});
test.each([undefined, null, 123, '', '../123', 'a/b', 'a?city=Irvine', 'a#b', ' abc ', 'a'.repeat(256)])(
  'rejects invalid listing ID %p before making a request', async id => {
    await expect(fetchPropertyDetail(id)).rejects.toThrow('Listing ID must contain');
    expect(fetch).not.toHaveBeenCalled();
  },
);
test.each(['abc_123-XYZ', 'a'.repeat(255)])('accepts valid listing ID %s', async id => {
  fetch.mockResolvedValue({ ok: true, json: async () => ({ L_ListingID: id }) });
  await expect(fetchPropertyDetail(id)).resolves.toEqual({ L_ListingID: id });
});
test.each([400, 404, 500])('preserves detail API errors for HTTP %i', async status => {
  fetch.mockResolvedValue({ ok: false, status, json: async () => ({ error: 'Property not found' }) });
  await expect(fetchPropertyDetail('123')).rejects.toThrow('Property not found');
});
test.each([null, [], {}, { L_ListingID: null }, { L_ListingID: 123 }, { L_ListingID: '' }])(
  'rejects malformed detail response %p', async response => {
    fetch.mockResolvedValue({ ok: true, json: async () => response });
    await expect(fetchPropertyDetail('123')).rejects.toThrow('invalid response');
  },
);
test('reports detail connection failures', async () => {
  fetch.mockRejectedValue(new TypeError('Failed to fetch'));
  await expect(fetchPropertyDetail('123')).rejects.toThrow('Unable to reach the property service');
});
test.each([true, false])('handles unreadable detail JSON with ok=%p', async ok => {
  fetch.mockResolvedValue({ ok, status: 502, json: async () => { throw new SyntaxError(); } });
  await expect(fetchPropertyDetail('123')).rejects.toThrow(ok ? 'invalid response' : 'Unable to load property details (HTTP 502)');
});
test('uses a detail-specific fallback when an HTTP error has no message', async () => {
  fetch.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
  await expect(fetchPropertyDetail('123')).rejects.toThrow('Unable to load property details (HTTP 503)');
});
test.each(['fetch', 'body'])('preserves cancellation during detail %s', async phase => {
  const error = new DOMException('Aborted', 'AbortError');
  if (phase === 'fetch') fetch.mockRejectedValue(error);
  else fetch.mockResolvedValue({ ok: true, json: async () => { throw error; } });
  await expect(fetchPropertyDetail('123')).rejects.toBe(error);
});
