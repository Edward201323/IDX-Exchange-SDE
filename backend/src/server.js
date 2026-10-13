const { port } = require('./config');
const pool = require('./db');
const createApp = require('./app');

const server = createApp(pool).listen(port, '127.0.0.1', () => {
  console.log(`IDX API listening at http://localhost:${port}`);
});
server.on('error', async (error) => {
  console.error('Server failed:', error.code);
  await pool.end();
  process.exitCode = 1;
});
function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
