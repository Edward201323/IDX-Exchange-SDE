const assert = require('node:assert/strict');
const pool = require('../src/db');
const createApp = require('../src/app');

async function main() {
  for (const table of ['rets_property', 'rets_openhouse']) {
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM ${table}`);
    assert(Number(total) > 0, `${table} must contain data`);
    console.log(`${table}: ${total} rows`);
    const [columns] = await pool.query(`DESCRIBE ${table}`);
    console.log(`${table}: ${columns.length} columns`);
  }
  const app = createApp(pool);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function get(url, status = 200) {
    const response = await fetch(base + url);
    assert.equal(response.status, status);
    return response.json();
  }
  try {
    assert.deepEqual(await get('/api/health'), { status: 'ok', database: 'connected' });
    const page = await get('/api/properties');
    assert.equal(page.limit, 20);
    assert.equal(page.results.length, Math.min(20, page.total));
    const second = await get('/api/properties?limit=10&offset=20');
    assert(!second.results.some(row => page.results.some(first => first.id === row.id)));
    const filtered = await get('/api/properties?city=%20IRVINE%20&minPrice=300000&beds=3');
    const [[{ total }]] = await pool.execute("SELECT COUNT(*) AS total FROM rets_property WHERE LOWER(TRIM(L_City)) = 'irvine' AND L_SystemPrice >= 300000 AND L_Keyword2 >= 3");
    assert.equal(filtered.total, Number(total));
    assert(filtered.results.every(row => row.L_City.trim().toLowerCase() === 'irvine' && row.L_SystemPrice >= 300000 && row.L_Keyword2 >= 3));
    for (const query of ['minPrice=abc', 'limit=0', 'limit=200']) await get(`/api/properties?${query}`, 400);
    const [indexes] = await pool.query('SHOW INDEXES FROM rets_property');
    for (const name of ['idx_search_city_price', 'idx_search_price', 'idx_search_beds', 'idx_search_baths']) {
      assert(indexes.some(row => row.Key_name === name), `Missing ${name}`);
    }
    const [plan] = await pool.execute("EXPLAIN SELECT COUNT(*) FROM rets_property WHERE LOWER(TRIM(L_City)) = ? AND L_SystemPrice >= ?", ['irvine', 300000]);
    assert(plan.some(row => row.key === 'idx_search_city_price'), 'City/price query should use its index');
    console.log(`Live API checks passed; Irvine + minPrice + beds matches ${filtered.total} listings.`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => { console.error('Verification failed:', error.message); process.exitCode = 1; }).finally(() => pool.end());
