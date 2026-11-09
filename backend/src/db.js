// One shared MySQL connection pool, reused across requests instead of opening a connection per request.
const mysql = require('mysql2/promise');
const { database } = require('./config');

module.exports = mysql.createPool(database);
