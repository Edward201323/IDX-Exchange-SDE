const fs = require('node:fs/promises');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const pool = require('../src/db');
const { ensureIndexes } = require('./indexes');
const { buildWhere, parseSearch } = require('../src/search');

const cases = [
  { city: 'Irvine' },
  { city: 'Irvine', minPrice: '300000', beds: '3' },
  { zipcode: '90210' },
  { minPrice: '3000000', maxPrice: '3100000' },
  { beds: '8' },
  { baths: '8' },
];

async function measure() {
  const output = [];
  for (const params of cases) {
    const { sql, values } = buildWhere(parseSearch(params).filters);
    const statement = `SELECT * FROM rets_property${sql} ORDER BY id ASC LIMIT 20`;
    const count = `SELECT COUNT(*) AS total FROM rets_property${sql}`;
    const [plan] = await pool.execute(`EXPLAIN ${statement}`, values);
    const [countPlan] = await pool.execute(`EXPLAIN ${count}`, values);
    const [analyze] = await pool.execute(`EXPLAIN ANALYZE ${statement}`, values);
    // One warm-up and three measured runs; count + page mirror the API workload.
    const milliseconds = [];
    let total;
    for (let i = 0; i < 4; i++) {
      const start = performance.now();
      [[{ total }]] = await pool.execute(count, values);
      await pool.execute(statement, values);
      if (i) milliseconds.push(Number((performance.now() - start).toFixed(3)));
    }
    output.push({ params, total, plan, countPlan, analyze, milliseconds });
  }
  return output;
}

async function main() {
  const [initialIndexes] = await pool.query('SHOW INDEXES FROM rets_property');
  const report = {
    capturedAt: new Date().toISOString(),
    note: 'Before means the indexes present at invocation. Re-running does not remove indexes. Timing includes local client overhead and varies with cache state.',
    initialIndexes,
    before: await measure(),
  };
  await ensureIndexes(pool);
  report.after = await measure();
  [report.finalIndexes] = await pool.query('SHOW INDEXES FROM rets_property');
  const filename = `query-performance-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const destination = path.resolve(__dirname, '../../docs', filename);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, JSON.stringify(report, null, 2) + '\n');
  console.log(`Saved query plans and measurements to ${destination}`);
  for (let i = 0; i < report.after.length; i++) {
    const result = report.after[i];
    console.log(JSON.stringify({ filters: result.params, beforeKeys: report.before[i].countPlan.map(r => r.key), afterKeys: result.countPlan.map(r => r.key), beforeMs: report.before[i].milliseconds, afterMs: result.milliseconds }));
  }
}

main().catch((error) => { console.error('Benchmark failed:', error.message); process.exitCode = 1; }).finally(() => pool.end());
