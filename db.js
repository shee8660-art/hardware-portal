// db.js
const { Pool } = require('pg');

// Check if we're in production (on Render) or development (on your computer)
const isProduction = process.env.NODE_ENV === 'production';

let db;

if (isProduction) {
    // Use Supabase in production
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }  // Required for Supabase
    });
    db = pool;
    console.log('✅ Connected to Supabase (Production)');
} else {
    // Use your local SQLite for development (keep your existing code)
    const sqlite3 = require('sqlite3').verbose();
    db = new sqlite3.Database('./hardware.db');
    console.log('✅ Connected to SQLite (Development)');
}

module.exports = db;