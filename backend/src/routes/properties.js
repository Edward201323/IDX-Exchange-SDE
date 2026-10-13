const express = require('express');
const { parseSearch, buildWhere, ValidationError } = require('../search');

module.exports = function propertiesRoute(db) {
  const router = express.Router();
  router.param('id', (req, _res, next, id) => {
    // Listing IDs are strings, not the table's internal numeric primary key.
    if (!/^[A-Za-z0-9_-]{1,255}$/.test(id)) {
      return next(new ValidationError('Listing ID must contain 1–255 letters, digits, underscores, or hyphens'));
    }
    next();
  });
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
