const request = require('supertest');
const createApp = require('../src/app');

let db;
let app;
beforeEach(() => {
  db = { execute: jest.fn() };
  app = createApp(db, { error: jest.fn() });
});

test('health checks MySQL and reports success', async () => {
  db.execute.mockResolvedValue([[{ 1: 1 }]]);
  const response = await request(app).get('/api/health');
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ status: 'ok', database: 'connected' });
  expect(db.execute).toHaveBeenCalledWith('SELECT 1');
});

test('health returns 500 on disconnect and can recover without restarting', async () => {
  db.execute.mockRejectedValueOnce(Object.assign(new Error('private credentials'), { code: 'ECONNREFUSED' }))
    .mockResolvedValueOnce([[{ 1: 1 }]]);
  const failure = await request(app).get('/api/health');
  expect(failure.status).toBe(500);
  expect(failure.body).toEqual({ status: 'error', database: 'disconnected' });
  expect((await request(app).get('/api/health')).status).toBe(200);
});

test('defaults to 20 results and returns the unpaginated total', async () => {
  db.execute.mockResolvedValueOnce([[{ total: 40 }]]).mockResolvedValueOnce([[{ id: 1 }]]);
  const response = await request(app).get('/api/properties');
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ total: 40, limit: 20, offset: 0, results: [{ id: 1 }] });
  expect(db.execute.mock.calls[1][0]).toContain('ORDER BY id ASC');
  expect(db.execute.mock.calls[1][1]).toEqual(['20', '0']);
});

test('regression: minPrice and beds bind identically for count and paginated results', async () => {
  db.execute.mockResolvedValueOnce([[{ total: 7 }]]).mockResolvedValueOnce([[]]);
  const response = await request(app).get('/api/properties?beds=3&minPrice=300000&limit=10&offset=20');
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ total: 7, limit: 10, offset: 20, results: [] });
  expect(db.execute.mock.calls[0][1]).toEqual([300000, 3]);
  expect(db.execute.mock.calls[1][1]).toEqual([300000, 3, '10', '20']);
  expect(db.execute.mock.calls[0][0]).toContain('L_SystemPrice >= ? AND L_Keyword2 >= ?');
});

test('all six filters combine with AND and preserve ZIP leading zeros', async () => {
  db.execute.mockResolvedValueOnce([[{ total: 0 }]]).mockResolvedValueOnce([[]]);
  await request(app).get('/api/properties').query({ city: ' IRVINE ', zipcode: '01234', minPrice: '0', maxPrice: '700000', beds: '0', baths: '2.5' }).expect(200);
  expect(db.execute.mock.calls[0][1]).toEqual(['irvine', '01234', 0, 700000, 0, 2.5]);
  expect(db.execute.mock.calls[0][0].match(/ AND /g)).toHaveLength(5);
});

test('SQL injection text is passed as a bound value', async () => {
  const city = "Irvine' OR 1=1 --";
  db.execute.mockResolvedValueOnce([[{ total: 0 }]]).mockResolvedValueOnce([[]]);
  await request(app).get('/api/properties').query({ city }).expect(200);
  expect(db.execute.mock.calls[0][0]).not.toContain(city);
  expect(db.execute.mock.calls[0][1]).toEqual([city.toLowerCase()]);
});

test.each([
  'minPrice=abc', 'limit=0', 'limit=200', 'limit=-1', 'limit=1.5',
  'offset=-1', 'offset=9007199254740992', 'beds=2.5', 'beds=-1',
  'baths=2.55', 'baths=Infinity', 'minPrice=1e6', 'maxPrice=NaN',
  'minPrice=100&maxPrice=99', 'minPrice=-2', 'city=', 'city=%20',
  'city=a&city=b', 'limit=1&limit=2', 'city[x]=Irvine',
  'zipcode=abc', 'zipcode=1234', 'sort=price', 'baths=', 'city=%00',
  `city=${'a'.repeat(51)}`, 'maxPrice=2147483648', 'limit=0x10',
])('rejects invalid query %s before accessing MySQL', async (query) => {
  const response = await request(app).get(`/api/properties?${query}`);
  expect(response.status).toBe(400);
  expect(response.body.error).toEqual(expect.any(String));
  expect(db.execute).not.toHaveBeenCalled();
});

test('property database failures return safe JSON', async () => {
  db.execute.mockRejectedValue(new Error('SQL containing a secret'));
  const response = await request(app).get('/api/properties');
  expect(response.status).toBe(500);
  expect(response.body).toEqual({ error: 'Unable to complete the database request' });
});

test('a page-query failure is handled after a successful count', async () => {
  db.execute.mockResolvedValueOnce([[{ total: 1 }]]).mockRejectedValueOnce(new Error('query failed'));
  await request(app).get('/api/properties').expect(500);
});

test('unknown routes return JSON 404', async () => {
  await request(app).get('/unknown').expect(404, { error: 'Route not found' });
});
