// db-sqlite.js
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./hardware.db');
console.log('✅ Connected to SQLite (Development)');
module.exports = db;