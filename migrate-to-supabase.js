const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');

// Connect to your local SQLite
const sqlite = new sqlite3.Database('./hardware.db');

// Connect to Supabase (YOU NEED TO ADD YOUR URL)
const pool = new Pool({
    connectionString: 'postgresql://postgres:Joshrosete_1234@db.jfdpzsjksoilrcacfuay.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

async function migrateTable(tableName, columns) {
    return new Promise((resolve, reject) => {
        // Get data from SQLite
        sqlite.all(`SELECT * FROM ${tableName}`, async (err, rows) => {
            if (err) {
                console.error(`Error reading ${tableName}:`, err);
                reject(err);
                return;
            }
            
            if (rows.length === 0) {
                console.log(`📭 ${tableName}: No data to migrate`);
                resolve();
                return;
            }
            
            console.log(`📦 Migrating ${rows.length} rows to ${tableName}...`);
            
            // For each row, insert into Supabase
            for (const row of rows) {
                const columnNames = Object.keys(row);
                const values = Object.values(row);
                
                // Build INSERT query
                const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
                const query = `
                    INSERT INTO ${tableName} (${columnNames.join(', ')})
                    VALUES (${placeholders})
                `;
                
                try {
                    await pool.query(query, values);
                } catch (err) {
                    console.error(`Error inserting into ${tableName}:`, err.message);
                    console.log('Row that failed:', row);
                }
            }
            
            console.log(`✅ ${tableName}: Migration complete!`);
            resolve();
        });
    });
}

async function migrateAll() {
    console.log('🚀 Starting migration from SQLite to Supabase...\n');
    
    // Migrate tables in order (respecting foreign keys)
    await migrateTable('users', ['id', 'username', 'password', 'role', 'fullname', 'email', 'branch_code', 'branch_name', 'district', 'assigned_branches', 'wms_id', 'created_at']);
    await migrateTable('asset_categories', ['id', 'category_name', 'created_by', 'created_at']);
    await migrateTable('hardware_requests', ['id', 'ticket_no', 'user_id', 'branch_code', 'branch_name', 'date_reported', 'date_acknowledged', 'asset_category', 'brand', 'model', 'serial_number', 'status', 'remarks', 'hardware_age', 'delivery_status', 'deployed_details', 'execution_photo', 'received_photo', 'received_date', 'deployed_date', 'deployed_branch_code', 'deployed_branch_name', 'description', 'trf_number', 'timeliness_grade', 'deployment_grade', 'average_grade', 'grade_comment', 'approved_by', 'approved_at', 'deployed_at', 'created_at']);
    await migrateTable('deployed_units', ['id', 'request_id', 'ticket_no', 'branch_code', 'branch_name', 'brand', 'model', 'serial_number', 'deployment_date', 'deployment_photo', 'deployed_by', 'timeliness_grade', 'deployment_grade', 'average_grade', 'grade_comment', 'created_at']);
    await migrateTable('activity_logs', ['id', 'user_id', 'action', 'details', 'ip_address', 'created_at']);
    
    console.log('\n🎉 Migration complete! All data moved to Supabase.');
    process.exit();
}

// Run migration
migrateAll().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});