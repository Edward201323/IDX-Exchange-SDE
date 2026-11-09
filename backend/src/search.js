// Search helpers for GET /api/properties: parseSearch validates the query string,
// and buildWhere turns the validated filters into a parameterized WHERE clause.
const allowed = new Set(['city', 'zipcode', 'minPrice', 'maxPrice', 'beds', 'baths', 'limit', 'offset']);

// Thrown for bad client input; the error handler in app.js turns it into a 400.
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

// Rejects unknown or repeated params and out-of-range numbers, then returns
// { filters, limit, offset } with limit defaulting to 20 and offset to 0.
function parseSearch(query) {
  const input = {};
  for (const [name, value] of Object.entries(query)) {
    if (!allowed.has(name)) throw new ValidationError(`Unknown query parameter: ${name}`);
    if (typeof value !== 'string' || !value.trim()) {
      throw new ValidationError(`${name} must be supplied once with a non-empty value`);
    }
    input[name] = value.trim();
  }
  const filters = {};
  // Parses one numeric param, or returns fallback when it's absent.
  function numeric(name, fallback, max, decimals = 0, min = 0) {
    if (input[name] === undefined) return fallback;
    const pattern = decimals ? new RegExp(`^\\d+(?:\\.\\d{1,${decimals}})?$`) : /^\d+$/;
    const value = Number(input[name]);
    if (!pattern.test(input[name]) || !Number.isFinite(value) || value < min || value > max) {
      throw new ValidationError(`${name} must be ${decimals ? 'a number' : 'an integer'} from ${min} to ${max}${decimals ? ` with at most ${decimals} decimal places` : ''}`);
    }
    return value;
  }
  if (input.city !== undefined) {
    if (input.city.length > 50 || /[\x00-\x1f\x7f]/.test(input.city)) {
      throw new ValidationError('city must be at most 50 characters without control characters');
    }
    filters.city = input.city.toLowerCase();
  }
  if (input.zipcode !== undefined) {
    if (!/^\d{5}(?:-\d{4})?$/.test(input.zipcode)) {
      throw new ValidationError('zipcode must be a five-digit ZIP code or ZIP+4');
    }
    filters.zipcode = input.zipcode;
  }
  filters.minPrice = numeric('minPrice', undefined, 2147483647, 2);
  filters.maxPrice = numeric('maxPrice', undefined, 2147483647, 2);
  filters.beds = numeric('beds', undefined, 1000);
  filters.baths = numeric('baths', undefined, 999.9, 1);
  if (filters.minPrice !== undefined && filters.maxPrice !== undefined && filters.minPrice > filters.maxPrice) {
    throw new ValidationError('minPrice must not exceed maxPrice');
  }
  return {
    filters,
    limit: numeric('limit', 20, 100, 0, 1),
    offset: numeric('offset', 0, 2147483647),
  };
}

// Each condition pushes exactly one value in the same order, so the ? placeholders always
// line up with their values. Column names come from this fixed list, never from user input.
function buildWhere(filters) {
  const conditions = [];
  const values = [];
  const columns = [
    ['city', 'LOWER(TRIM(L_City)) = ?'],
    ['zipcode', 'L_Zip = ?'],
    ['minPrice', 'L_SystemPrice >= ?'],
    ['maxPrice', 'L_SystemPrice <= ?'],
    ['beds', 'L_Keyword2 >= ?'],
    ['baths', 'LM_Dec_3 >= ?'],
  ];
  for (const [name, condition] of columns) {
    if (filters[name] !== undefined) {
      conditions.push(condition);
      values.push(filters[name]);
    }
  }
  return { sql: conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '', values };
}

module.exports = { parseSearch, buildWhere, ValidationError };
