// db.js - Simple switcher
const isProduction = process.env.NODE_ENV === 'production';

let db;

if (isProduction) {
    db = require('./db-pg');
} else {
    db = require('./db-sqlite');
}

module.exports = db;