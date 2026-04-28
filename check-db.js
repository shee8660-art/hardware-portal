const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./hardware.db');

console.log('📋 Listing all tables in your database...\n');

// Get all table names
db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", (err, tables) => {
    if (err) {
        console.error(err);
        return;
    }
    
    console.log('Tables found:', tables.map(t => t.name).join(', '));
    console.log('\n📝 Getting structure for each table...\n');
    
    // For each table, get its structure
    tables.forEach(table => {
        db.all(`PRAGMA table_info(${table.name})`, (err, columns) => {
            console.log(`\n=== TABLE: ${table.name} ===`);
            columns.forEach(col => {
                console.log(`  - ${col.name} (${col.type}) ${col.pk ? 'PRIMARY KEY' : ''}`);
            });
        });
    });
    
    // Also get the CREATE statements
    setTimeout(() => {
        console.log('\n\n=== FULL SQL SCHEMA ===');
        db.all("SELECT sql FROM sqlite_master WHERE type='table' AND sql IS NOT NULL", (err, schemas) => {
            schemas.forEach(schema => {
                console.log(schema.sql + ';\n');
            });
        });
    }, 1000);
});