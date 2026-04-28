// db-pg.js
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});
console.log('✅ Connected to Supabase (Production)');
module.exports = pool;