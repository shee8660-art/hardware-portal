// migrate.js - Run this ONCE to move your data to Supabase
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');

const sqlite = new sqlite3.Database('./hardware.db');
const pgPool = new Pool({
    connectionString: 'YOUR_SUPABASE_CONNECTION_STRING',
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    // Get all tables from SQLite
    sqlite.all("SELECT name FROM sqlite_master WHERE type='table'", async (err, tables) => {
        for (const table of tables) {
            const tableName = table.name;
            
            // Get data from SQLite
            sqlite.all(`SELECT * FROM ${tableName}`, async (err, rows) => {
                if (rows.length > 0) {
                    for (const row of rows) {
                        const columns = Object.keys(row).join(', ');
                        const values = Object.values(row);
                        const placeholders = values.map((_, i) => `$${i+1}`).join(', ');
                        
                        await pgPool.query(
                            `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`,
                            values
                        );
                    }
                    console.log(`✅ Migrated ${rows.length} rows to ${tableName}`);
                }
            });
        }
    });
}

migrate();