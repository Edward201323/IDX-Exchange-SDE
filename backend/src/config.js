const path = require('node:path');
const dotenv = require('dotenv');

// Shell environment wins, then backend/.env, then the existing root .env.
dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });
dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

function port(value, fallback, name) {
  const result = Number(value ?? fallback);
  if (!Number.isInteger(result) || result < 1 || result > 65535) {
    throw new Error(`${name} must be an integer from 1 to 65535`);
  }
  return result;
}

module.exports = {
  port: port(process.env.PORT, 5000, 'PORT'),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  database: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: port(process.env.DB_PORT, 3306, 'DB_PORT'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD ?? process.env.MYSQL_ROOT_PASSWORD,
    database: process.env.DB_NAME || process.env.MYSQL_DATABASE || 'rets',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 50,
    connectTimeout: 5000,
    decimalNumbers: true,
  },
};
