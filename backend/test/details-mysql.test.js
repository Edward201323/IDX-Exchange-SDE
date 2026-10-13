const mysql = require('mysql2/promise');
const request = require('supertest');
const { database } = require('../src/config');
const createApp = require('../src/app');
const describeMysql = process.env.RUN_MYSQL_TESTS === '1' ? describe : describe.skip;

describeMysql('real MySQL detail and open-house behavior', () => {
  let db, app;
  beforeAll(async () => {
    db = await mysql.createConnection(database);
    await db.query('CREATE TEMPORARY TABLE rets_property (id INT PRIMARY KEY, L_ListingID VARCHAR(255))');
    await db.query('CREATE TEMPORARY TABLE rets_openhouse (id INT PRIMARY KEY, L_ListingID VARCHAR(255), OpenHouseDate DATE, OH_StartTime TIME, all_data LONGTEXT)');
    await db.execute('INSERT INTO rets_property VALUES (1, ?), (2, ?)', ['00123', 'no-events']);
    await db.query(`INSERT INTO rets_openhouse VALUES
      (1, '00123', '2026-10-18', '09:00:00', '{broken'),
      (2, '00123', '2026-10-17', '14:00:00', NULL),
      (3, '00123', '2026-10-17', '10:00:00', ''),
      (4, '00123', '2026-10-17', '10:00:00', '{}'),
      (5, 'another', '2026-10-16', '09:00:00', '{}')`);
    app = createApp(db, { info: jest.fn(), error: jest.fn() });
  });
  afterAll(async () => { if (db) await db.end(); });
  test('listing ID differs from internal ID and preserves leading zeros', async () => {
    await request(app).get('/api/properties/00123').expect(200, { id: 1, L_ListingID: '00123' });
    await request(app).get('/api/properties/1').expect(404);
  });
  test('events belong to the listing and sort by date, time, then ID', async () => {
    const response = await request(app).get('/api/properties/00123/openhouses').expect(200);
    expect(response.body.map(row => row.id)).toEqual([3, 4, 2, 1]);
    expect(response.body.map(row => row.all_data)).toEqual(['', '{}', null, '{broken']);
  });
  test('empty events and unknown listing have distinct responses', async () => {
    await request(app).get('/api/properties/no-events/openhouses').expect(200, []);
    await request(app).get('/api/properties/missing/openhouses').expect(404);
  });
});
