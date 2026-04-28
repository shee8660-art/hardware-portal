// models/database.js - Optimized for Neon.tech and Render
const bcrypt = require('bcryptjs');

const isProduction = process.env.NODE_ENV === 'production';

let db;
let query;

if (isProduction) {
    // PRODUCTION: Use PostgreSQL (Neon.tech)
    const { Pool } = require('pg');
    
    // Neon.tech works with standard SSL settings
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        },
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
    });
    
    db = pool;
    
    // Helper function for queries
    query = async (text, params) => {
        try {
            const start = Date.now();
            const result = await db.query(text, params);
            const duration = Date.now() - start;
            console.log('Executed query:', { text, duration, rows: result.rowCount });
            return result.rows;
        } catch (err) {
            console.error('Query error:', err.message);
            throw err;
        }
    };
    
    console.log('✅ Connected to PostgreSQL (Production)');
} else {
    // DEVELOPMENT: Use SQLite
    const sqlite3 = require('sqlite3').verbose();
    db = new sqlite3.Database('./hardware.db');
    
    query = (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    };
    
    console.log('✅ Connected to SQLite (Development)');
}

// Helper function to get a single row
async function get(sql, params = []) {
    const rows = await query(sql, params);
    return rows[0];
}

// Helper function to run a command (INSERT, UPDATE, DELETE)
async function run(sql, params = []) {
    if (isProduction) {
        const result = await db.query(sql, params);
        return result;
    } else {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    }
}

// Initialize database tables
async function initDatabase() {
    console.log('Initializing database...');
    
    if (isProduction) {
        try {
            // Test the connection first
            const testResult = await query('SELECT NOW() as now');
            console.log('✅ Database connection test successful:', testResult[0].now);
            
            // Create tables
            await run(`CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE,
                password TEXT,
                role TEXT CHECK(role IN ('admin', 'dit', 'bit')),
                fullname TEXT,
                email TEXT,
                branch_code TEXT,
                branch_name TEXT,
                district TEXT,
                assigned_branches TEXT,
                wms_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
            console.log('✅ Users table ready');
            
            await run(`CREATE TABLE IF NOT EXISTS hardware_requests (
                id SERIAL PRIMARY KEY,
                ticket_no TEXT UNIQUE,
                user_id INTEGER REFERENCES users(id),
                branch_code TEXT,
                branch_name TEXT,
                date_reported TIMESTAMP,
                date_acknowledged TIMESTAMP,
                asset_category TEXT,
                brand TEXT,
                model TEXT,
                serial_number TEXT,
                status TEXT DEFAULT 'For DM Approval',
                remarks TEXT DEFAULT 'Pending',
                hardware_age TEXT,
                delivery_status TEXT DEFAULT 'Pending',
                deployed_details TEXT,
                execution_photo TEXT,
                received_photo TEXT,
                received_date TIMESTAMP,
                deployed_date TIMESTAMP,
                deployed_branch_code TEXT,
                deployed_branch_name TEXT,
                description TEXT,
                trf_number TEXT,
                timeliness_grade INTEGER DEFAULT NULL,
                deployment_grade INTEGER DEFAULT NULL,
                average_grade REAL DEFAULT NULL,
                grade_comment TEXT,
                approved_by INTEGER,
                approved_at TIMESTAMP,
                deployed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
            console.log('✅ Hardware requests table ready');
            
            await run(`CREATE TABLE IF NOT EXISTS deployed_units (
                id SERIAL PRIMARY KEY,
                request_id INTEGER REFERENCES hardware_requests(id),
                ticket_no TEXT,
                branch_code TEXT,
                branch_name TEXT,
                brand TEXT,
                model TEXT,
                serial_number TEXT,
                deployment_date TIMESTAMP,
                deployment_photo TEXT,
                deployed_by INTEGER REFERENCES users(id),
                timeliness_grade INTEGER DEFAULT NULL,
                deployment_grade INTEGER DEFAULT NULL,
                average_grade REAL DEFAULT NULL,
                grade_comment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
            console.log('✅ Deployed units table ready');
            
            await run(`CREATE TABLE IF NOT EXISTS asset_categories (
                id SERIAL PRIMARY KEY,
                category_name TEXT UNIQUE,
                created_by INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
            console.log('✅ Asset categories table ready');
            
            await run(`CREATE TABLE IF NOT EXISTS activity_logs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                action TEXT,
                details TEXT,
                ip_address TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
            console.log('✅ Activity logs table ready');
            
            // Insert default asset categories
            const categories = [
                'Server', 'Workstation', 'POS', 'Hard Disk', 'Thermal Printer',
                'Thermal Printer Power Adaptor', 'Dot Matrix Printer', 'Inkjet Printer',
                '3in1 Inkjet Printer', 'Shelftag Printer', 'Monitor', 'Cash Drawer',
                'Cradle', 'Data Collector', 'Network Switch 48P', 'Network Switch 24P',
                'Access Point', 'Magnetic Swipe Reader', 'Fingerprint Scanner',
                'Vertical Scanner', 'Handheld Scanner', 'Scanner Power Adaptor',
                'Scanner Data Cable', 'Tower UPS', 'Regular UPS', 'Price Verifier',
                'Speaker', 'WebCam', 'Keyboard', 'Mouse', 'Laptop'
            ];
            
            for (const cat of categories) {
                await run(`INSERT INTO asset_categories (category_name) SELECT $1 WHERE NOT EXISTS (SELECT 1 FROM asset_categories WHERE category_name = $1)`, [cat]);
            }
            console.log('✅ Asset categories inserted');
            
            // Create default users
            const hashedPassword = bcrypt.hashSync('admin123', 10);
            
            const adminExists = await get('SELECT id FROM users WHERE username = $1', ['admin']);
            if (!adminExists) {
                await run(`INSERT INTO users (username, password, role, fullname, email, branch_code, branch_name) 
                        VALUES ($1, $2, $3, $4, $5, $6, $7)`, 
                        ['admin', hashedPassword, 'admin', 'System Administrator', 'admin@example.com', 'ADMIN', 'Head Office']);
                console.log('✅ Admin user created');
            }
            
            const ditExists = await get('SELECT id FROM users WHERE username = $1', ['dituser']);
            if (!ditExists) {
                await run(`INSERT INTO users (username, password, role, fullname, email, branch_code, branch_name) 
                        VALUES ($1, $2, $3, $4, $5, $6, $7)`, 
                        ['dituser', hashedPassword, 'dit', 'DIT Officer', 'dit@example.com', 'DIT001', 'Main Branch']);
                console.log('✅ DIT user created');
            }
            
            const bitExists = await get('SELECT id FROM users WHERE username = $1', ['bituser']);
            if (!bitExists) {
                await run(`INSERT INTO users (username, password, role, fullname, email, branch_code, branch_name) 
                        VALUES ($1, $2, $3, $4, $5, $6, $7)`, 
                        ['bituser', hashedPassword, 'bit', 'BIT Staff', 'bit@example.com', 'BIT001', 'Store Branch']);
                console.log('✅ BIT user created');
            }
            
            console.log('✅ Database initialization complete');
            
        } catch (err) {
            console.error('Database initialization error:', err);
            throw err;
        }
    } else {
        // DEVELOPMENT: SQLite (keep your existing SQLite code)
        const sqlite3 = require('sqlite3').verbose();
        const dbSqlite = new sqlite3.Database('./hardware.db');
        
        dbSqlite.serialize(() => {
            // Users table
            dbSqlite.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE,
                password TEXT,
                role TEXT CHECK(role IN ('admin', 'dit', 'bit')),
                fullname TEXT,
                email TEXT,
                branch_code TEXT,
                branch_name TEXT,
                district TEXT,
                assigned_branches TEXT,
                wms_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            
            // Hardware Requests table
            dbSqlite.run(`CREATE TABLE IF NOT EXISTS hardware_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticket_no TEXT UNIQUE,
                user_id INTEGER,
                branch_code TEXT,
                branch_name TEXT,
                date_reported DATETIME,
                date_acknowledged DATETIME,
                asset_category TEXT,
                brand TEXT,
                model TEXT,
                serial_number TEXT,
                status TEXT DEFAULT 'For DM Approval',
                remarks TEXT DEFAULT 'Pending',
                hardware_age TEXT,
                delivery_status TEXT DEFAULT 'Pending',
                deployed_details TEXT,
                execution_photo TEXT,
                received_photo TEXT,
                received_date DATETIME,
                deployed_date DATETIME,
                deployed_branch_code TEXT,
                deployed_branch_name TEXT,
                description TEXT,
                trf_number TEXT,
                timeliness_grade INTEGER DEFAULT NULL,
                deployment_grade INTEGER DEFAULT NULL,
                average_grade REAL DEFAULT NULL,
                grade_comment TEXT,
                approved_by INTEGER,
                approved_at DATETIME,
                deployed_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )`);
            
            // Deployed Units table
            dbSqlite.run(`CREATE TABLE IF NOT EXISTS deployed_units (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                request_id INTEGER,
                ticket_no TEXT,
                branch_code TEXT,
                branch_name TEXT,
                brand TEXT,
                model TEXT,
                serial_number TEXT,
                deployment_date DATETIME,
                deployment_photo TEXT,
                deployed_by INTEGER,
                timeliness_grade INTEGER DEFAULT NULL,
                deployment_grade INTEGER DEFAULT NULL,
                average_grade REAL DEFAULT NULL,
                grade_comment TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(request_id) REFERENCES hardware_requests(id),
                FOREIGN KEY(deployed_by) REFERENCES users(id)
            )`);
            
            // Asset Categories table
            dbSqlite.run(`CREATE TABLE IF NOT EXISTS asset_categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category_name TEXT UNIQUE,
                created_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            
            // Activity Logs table
            dbSqlite.run(`CREATE TABLE IF NOT EXISTS activity_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                action TEXT,
                details TEXT,
                ip_address TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            
            // Insert default asset categories
            const categories = [
                'Server', 'Workstation', 'POS', 'Hard Disk', 'Thermal Printer',
                'Thermal Printer Power Adaptor', 'Dot Matrix Printer', 'Inkjet Printer',
                '3in1 Inkjet Printer', 'Shelftag Printer', 'Monitor', 'Cash Drawer',
                'Cradle', 'Data Collector', 'Network Switch 48P', 'Network Switch 24P',
                'Access Point', 'Magnetic Swipe Reader', 'Fingerprint Scanner',
                'Vertical Scanner', 'Handheld Scanner', 'Scanner Power Adaptor',
                'Scanner Data Cable', 'Tower UPS', 'Regular UPS', 'Price Verifier',
                'Speaker', 'WebCam', 'Keyboard', 'Mouse', 'Laptop'
            ];
            
            categories.forEach(cat => {
                dbSqlite.run(`INSERT OR IGNORE INTO asset_categories (category_name) VALUES (?)`, [cat]);
            });
            
            // Insert default admin user
            const hashedPassword = bcrypt.hashSync('admin123', 10);
            
            dbSqlite.get('SELECT id FROM users WHERE username = ?', ['admin'], (err, row) => {
                if (!row) {
                    dbSqlite.run(`INSERT INTO users (username, password, role, fullname, email, branch_code, branch_name) 
                            VALUES (?, ?, ?, ?, ?, ?, ?)`, 
                            ['admin', hashedPassword, 'admin', 'System Administrator', 'admin@example.com', 'ADMIN', 'Head Office']);
                }
            });
            
            dbSqlite.get('SELECT id FROM users WHERE username = ?', ['dituser'], (err, row) => {
                if (!row) {
                    dbSqlite.run(`INSERT INTO users (username, password, role, fullname, email, branch_code, branch_name) 
                            VALUES (?, ?, ?, ?, ?, ?, ?)`, 
                            ['dituser', hashedPassword, 'dit', 'DIT Officer', 'dit@example.com', 'DIT001', 'Main Branch']);
                }
            });
            
            dbSqlite.get('SELECT id FROM users WHERE username = ?', ['bituser'], (err, row) => {
                if (!row) {
                    dbSqlite.run(`INSERT INTO users (username, password, role, fullname, email, branch_code, branch_name) 
                            VALUES (?, ?, ?, ?, ?, ?, ?)`, 
                            ['bituser', hashedPassword, 'bit', 'BIT Staff', 'bit@example.com', 'BIT001', 'Store Branch']);
                }
            });
        });
        
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log('✅ SQLite database initialized');
    }
}

async function logActivity(userId, action, details, ip = null) {
    try {
        if (isProduction) {
            await run(`INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)`,
                [userId, action, details, ip]);
        } else {
            const sqlite3 = require('sqlite3').verbose();
            const dbSqlite = new sqlite3.Database('./hardware.db');
            dbSqlite.run(`INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)`,
                [userId, action, details, ip]);
        }
    } catch (err) {
        console.error('Error logging activity:', err);
    }
}

// Initialize the database
initDatabase().catch(console.error);

module.exports = { db, query, get, run, initDatabase, logActivity, isProduction };