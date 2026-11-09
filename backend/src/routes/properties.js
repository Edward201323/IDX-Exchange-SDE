// Routes mounted at /api/properties: paginated search, single-listing detail,
// and a listing's open houses. Every route takes the listing's L_ListingID.
const express = require('express');
const { parseSearch, buildWhere, ValidationError } = require('../search');

module.exports = function propertiesRoute(db) {
  const router = express.Router();
  // Validates :id once for every route below, so malformed IDs get a 400 before any query runs.
  router.param('id', (req, _res, next, id) => {
    // Listing IDs are strings, not the table's internal numeric primary key.
    if (!/^[A-Za-z0-9_-]{1,255}$/.test(id)) {
      return next(new ValidationError('Listing ID must contain 1–255 letters, digits, underscores, or hyphens'));
    }
    next();
  });
  // GET /api/properties: filtered, paginated search returning { total, limit, offset, results }.
  router.get('/', async (req, res, next) => {
    try {
      const { filters, limit, offset } = parseSearch(req.query);
      const { sql, values } = buildWhere(filters);
      const [[{ total }]] = await db.execute(`SELECT COUNT(*) AS total FROM rets_property${sql}`, values);
      // Separate arrays prevent pagination parameters from corrupting count/filter bindings.
      // Decimal strings avoid mysql2 encoding JS pagination numbers as DOUBLE.
      const [results] = await db.execute(
        `SELECT * FROM rets_property${sql} ORDER BY id ASC LIMIT ? OFFSET ?`,
        [...values, String(limit), String(offset)],
      );
      res.json({ total: Number(total), limit, offset, results });
    } catch (error) {
      next(error);
    }
  });
  // GET /api/properties/:id/openhouses: 404 if the listing doesn't exist, otherwise its events
  // (possibly []) sorted by date and start time. Registered before /:id, per the week 4 requirement.
  router.get('/:id/openhouses', async (req, res, next) => {
    try {
      const [properties] = await db.execute('SELECT L_ListingID FROM rets_property WHERE L_ListingID = ? LIMIT 1', [req.params.id]);
      if (!properties.length) return res.status(404).json({ error: 'Property not found' });
      const [events] = await db.execute(
        'SELECT * FROM rets_openhouse WHERE L_ListingID = ? ORDER BY OpenHouseDate ASC, OH_StartTime ASC, id ASC',
        [req.params.id],
      );
      // all_data is legacy LONGTEXT: returning it unchanged avoids crashing on invalid JSON.
      res.json(events);
    } catch (error) {
      next(error);
    }
  });
  // GET /api/properties/:id: the full property row, or 404 if no listing has that ID.
  router.get('/:id', async (req, res, next) => {
    try {
      const [properties] = await db.execute('SELECT * FROM rets_property WHERE L_ListingID = ? LIMIT 1', [req.params.id]);
      if (!properties.length) return res.status(404).json({ error: 'Property not found' });
      res.json(properties[0]);
    } catch (error) {
      next(error);
    }
  });
  return router;
};
