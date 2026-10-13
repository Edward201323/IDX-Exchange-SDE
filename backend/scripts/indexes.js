const indexDefinitions = [
  ['idx_search_city_price', '((LOWER(TRIM(L_City))), L_SystemPrice)'],
  ['idx_search_price', '(L_SystemPrice)'],
  ['idx_search_beds', '(L_Keyword2)'],
  ['idx_search_baths', '(LM_Dec_3)'],
];

async function ensureIndexes(db, log = console.log) {
  const connection = typeof db.getConnection === 'function' ? await db.getConnection() : db;
  let originalMode;
  try {
  const [[mode]] = await connection.query('SELECT @@SESSION.sql_mode AS value');
  originalMode = mode.value;
  // The provided dump has zero-date defaults. Permit those existing defaults
  // only on this migration connection, preserving all other SQL mode checks.
  const migrationMode = originalMode.split(',').filter(value => !['NO_ZERO_DATE', 'NO_ZERO_IN_DATE'].includes(value)).join(',');
  await connection.query('SET SESSION sql_mode = ?', [migrationMode]);
  const [existing] = await connection.query('SHOW INDEXES FROM rets_property');
  const names = new Set(existing.map((row) => row.Key_name));
  const definitions = [...indexDefinitions];
  if (!existing.some((row) => row.Column_name === 'L_Zip' && row.Seq_in_index === 1)) {
    definitions.push(['idx_search_zip', '(L_Zip)']);
  }
  for (const [name, columns] of definitions) {
    if (names.has(name)) {
      log(`${name}: already present`);
      continue;
    }
    // Identifiers and expressions are fixed application constants, never user input.
    await connection.query(`CREATE INDEX ${name} ON rets_property ${columns}`);
    log(`${name}: created`);
  }
  await connection.query('ANALYZE TABLE rets_property');
  } finally {
    try {
      if (originalMode !== undefined) await connection.query('SET SESSION sql_mode = ?', [originalMode]);
    } finally {
      if (connection !== db) connection.release();
    }
  }
}

if (require.main === module) {
  const pool = require('../src/db');
  ensureIndexes(pool)
    .catch((error) => { console.error('Index migration failed:', error.message); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { ensureIndexes, indexDefinitions };
