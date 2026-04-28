// db.js - Database connection for your hardware portal
const { Pool } = require('pg');

// Check if we're on Render (production) or local (development)
const isProduction = process.env.NODE_ENV === 'production';

let db;

if (isProduction) {
    // Use Supabase on Render
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    db = pool;
    console.log('✅ Connected to Supabase (Production)');
} else {
    // Use SQLite for local development
    const sqlite3 = require('sqlite3').verbose();
    db = new sqlite3.Database('./hardware.db');
    console.log('✅ Connected to SQLite (Development)');
}

module.exports = db;