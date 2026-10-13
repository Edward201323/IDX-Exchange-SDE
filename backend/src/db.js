const mysql = require('mysql2/promise');
const { database } = require('./config');

module.exports = mysql.createPool(database);
