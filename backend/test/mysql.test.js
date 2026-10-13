const mysql = require('mysql2/promise');
const request = require('supertest');
const { database } = require('../src/config');
const createApp = require('../src/app');

const describeMysql = process.env.RUN_MYSQL_TESTS === '1' ? describe : describe.skip;

describeMysql('real MySQL search behavior (connection-local temporary fixture)', () => {
  let db;
  let app;
  const rows = Array.from({ length: 35 }, (_, i) => ({
    id: i + 1,
    L_City: i % 2 ? 'Tustin' : i % 4 ? ' IRVINE ' : 'Irvine',
    L_Zip: i % 3 ? '92618' : '01234',
    L_SystemPrice: i * 100000,
    L_Keyword2: i % 5,
    LM_Dec_3: (i % 7) / 2,
  }));
  rows.push({ id: 36, L_City: "O'Fallon", L_Zip: '63366', L_SystemPrice: 450000, L_Keyword2: 3, LM_Dec_3: 2.5 });
  rows.push({ id: 37, L_City: null, L_Zip: null, L_SystemPrice: null, L_Keyword2: null, LM_Dec_3: null });

  beforeAll(async () => {
    db = await mysql.createConnection(database);
    // Temporary table shadows the real table only on this connection. It is
    // automatically removed on disconnect; MLS data is never changed.
    await db.query(`CREATE TEMPORARY TABLE rets_property (
      id INT PRIMARY KEY, L_City VARCHAR(50), L_Zip VARCHAR(20),
      L_SystemPrice INT, L_Keyword2 INT, LM_Dec_3 DECIMAL(4,1)
    )`);
    for (const row of rows) {
      await db.execute('INSERT INTO rets_property VALUES (?, ?, ?, ?, ?, ?)', Object.values(row));
    }
    app = createApp(db);
  }, 15000);
  afterAll(async () => { if (db) await db.end(); });

  test('default page, offset, and out-of-range page have correct totals and stable order', async () => {
    const first = await request(app).get('/api/properties').expect(200);
    expect(first.body.total).toBe(rows.length);
    expect(first.body.results.map(r => r.id)).toEqual(rows.slice(0, 20).map(r => r.id));
    const next = await request(app).get('/api/properties?limit=10&offset=20').expect(200);
    expect(next.body.results.map(r => r.id)).toEqual(rows.slice(20, 30).map(r => r.id));
    const empty = await request(app).get('/api/properties?offset=100').expect(200);
    expect(empty.body).toEqual({ total: rows.length, limit: 20, offset: 100, results: [] });
  });

  const filters = [
    ['city', ' IRVINE ', r => r.L_City?.trim().toLowerCase() === 'irvine'],
    ['zipcode', '01234', r => r.L_Zip === '01234'],
    ['minPrice', '300000', r => r.L_SystemPrice !== null && r.L_SystemPrice >= 300000],
    ['maxPrice', '2000000', r => r.L_SystemPrice !== null && r.L_SystemPrice <= 2000000],
    ['beds', '3', r => r.L_Keyword2 !== null && r.L_Keyword2 >= 3],
    ['baths', '2.5', r => r.LM_Dec_3 !== null && r.LM_Dec_3 >= 2.5],
  ];
  test.each(Array.from({ length: 64 }, (_, mask) => [mask]))('filter combination %i matches independent fixture expectations', async (mask) => {
    const active = filters.filter((_, index) => mask & (1 << index));
    const expected = rows.filter(row => active.every(([, , predicate]) => predicate(row)));
    const query = Object.fromEntries(active.map(([key, value]) => [key, value]));
    const response = await request(app).get('/api/properties').query({ ...query, limit: '10', offset: '1' }).expect(200);
    expect(response.body.total).toBe(expected.length);
    expect(response.body.results.map(r => r.id)).toEqual(expected.slice(1, 11).map(r => r.id));
  });

  test('quoted city works, while injection text matches no rows', async () => {
    const city = await request(app).get('/api/properties').query({ city: "O'Fallon" }).expect(200);
    expect(city.body.results.map(r => r.id)).toEqual([36]);
    const injection = await request(app).get('/api/properties').query({ city: "Irvine' OR 1=1 --" }).expect(200);
    expect(injection.body.total).toBe(0);
  });
});
