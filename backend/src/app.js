// Builds the Express app: request logging, CORS, the health check, the properties
// routes, and the 404/error handlers. The DB is injected so tests can pass a mock pool.
const express = require('express');
const cors = require('cors');
const propertiesRoute = require('./routes/properties');
const { corsOrigin } = require('./config');
const { ValidationError } = require('./search');

module.exports = function createApp(db, logger = console) {
  const app = express();
  app.disable('x-powered-by');
  app.set('query parser', 'simple');
  // Request logger: prints one line per request once the response has finished.
  app.use((req, res, next) => {
    const started = process.hrtime.bigint();
    const timestamp = new Date().toISOString();
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
      // JSON encoding prevents control characters in a URL from forging log lines.
      logger.info?.(JSON.stringify({ timestamp, method: req.method, url: req.originalUrl,
        status: res.statusCode, durationMs: Number(durationMs.toFixed(3)) }));
    });
    next();
  });
  app.use(cors({ origin: corsOrigin }));
  // GET /api/health: runs SELECT 1 and reports a 500 instead of crashing if MySQL is down.
  app.get('/api/health', async (_req, res) => {
    try {
      await db.execute('SELECT 1');
      res.json({ status: 'ok', database: 'connected' });
    } catch (error) {
      logger.error('Health check failed:', error.code || 'DATABASE_ERROR');
      res.status(500).json({ status: 'error', database: 'disconnected' });
    }
  });
  app.use('/api/properties', propertiesRoute(db));
  app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
  // Central error handler: bad input becomes a 400; anything else is a generic 500 that hides DB details.
  app.use((error, _req, res, _next) => {
    if (error instanceof URIError) return res.status(400).json({ error: 'Malformed URL encoding' });
    if (error instanceof ValidationError) return res.status(400).json({ error: error.message });
    logger.error('Request failed:', error.code || 'DATABASE_ERROR');
    res.status(500).json({ error: 'Unable to complete the database request' });
  });
  return app;
};
