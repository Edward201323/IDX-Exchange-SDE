const request = require('supertest');
const createApp = require('../src/app');

let db, logger, app;
beforeEach(() => {
  db = { execute: jest.fn() };
  logger = { info: jest.fn(), error: jest.fn() };
  app = createApp(db, logger);
});

test('detail returns the full property using the listing ID as a bound string', async () => {
  const property = { id: 42, L_ListingID: '00123', L_Photos: null };
  db.execute.mockResolvedValueOnce([[property]]);
  await request(app).get('/api/properties/00123').expect(200, property);
  expect(db.execute).toHaveBeenCalledWith(expect.stringContaining('WHERE L_ListingID = ?'), ['00123']);
});

for (const suffix of ['', '/openhouses']) {
  test(`unknown property returns 404 for ${suffix || 'detail'}`, async () => {
    db.execute.mockResolvedValueOnce([[]]);
    await request(app).get(`/api/properties/unknown${suffix}`).expect(404, { error: 'Property not found' });
    expect(db.execute).toHaveBeenCalledTimes(1);
  });
  test.each(['a'.repeat(256), '%20', '%00', 'a%2Fb', "a%27OR%201=1", '%E0%A4%A'])(`invalid ID %s returns 400 for ${suffix || 'detail'}`, async id => {
    await request(app).get(`/api/properties/${id}${suffix}`).expect(400);
    expect(db.execute).not.toHaveBeenCalled();
  });
  test(`database failure is safe for ${suffix || 'detail'}`, async () => {
    db.execute.mockRejectedValueOnce(new Error('private database credentials'));
    await request(app).get(`/api/properties/123${suffix}`).expect(500, { error: 'Unable to complete the database request' });
  });
}

test.each([null, '', '{broken', '{"OpenHouseRemarks":"Welcome"}'])('legacy all_data %s is returned unchanged', async all_data => {
  const events = [{ id: 1, L_ListingID: '123', all_data }];
  db.execute.mockResolvedValueOnce([[{ L_ListingID: '123' }]]).mockResolvedValueOnce([events]);
  await request(app).get('/api/properties/123/openhouses').expect(200, events);
  expect(db.execute.mock.calls[1]).toEqual([
    expect.stringContaining('ORDER BY OpenHouseDate ASC, OH_StartTime ASC, id ASC'), ['123'],
  ]);
});

test('existing property without events returns an empty array', async () => {
  db.execute.mockResolvedValueOnce([[{ L_ListingID: '123' }]]).mockResolvedValueOnce([[]]);
  await request(app).get('/api/properties/123/openhouses').expect(200, []);
});

test('open-house query rejection is caught and subsequent requests recover', async () => {
  db.execute.mockResolvedValueOnce([[{ L_ListingID: '123' }]])
    .mockRejectedValueOnce(new Error('bad source data'));
  await request(app).get('/api/properties/123/openhouses').expect(500);
  db.execute.mockResolvedValueOnce([[{ L_ListingID: '123' }]]).mockResolvedValueOnce([[]]);
  await request(app).get('/api/properties/123/openhouses').expect(200, []);
});

test.each([['/api/health', 200], ['/missing', 404], ['/api/properties/%20', 400]])('logs completed request %s', async (url, status) => {
  db.execute.mockResolvedValueOnce([[{ 1: 1 }]]);
  await request(app).get(url).expect(status);
  expect(logger.info).toHaveBeenCalledTimes(1);
  const log = JSON.parse(logger.info.mock.calls[0][0]);
  expect(log).toEqual({ timestamp: expect.any(String), method: 'GET', url, status, durationMs: expect.any(Number) });
  expect(Number.isNaN(Date.parse(log.timestamp))).toBe(false);
  expect(log.durationMs).toBeGreaterThanOrEqual(0);
});

test('failed requests are logged with status 500', async () => {
  db.execute.mockRejectedValueOnce(new Error('unavailable'));
  await request(app).get('/api/properties/123').expect(500);
  expect(JSON.parse(logger.info.mock.calls[0][0]).status).toBe(500);
});
