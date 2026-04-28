const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const db = new sqlite3.Database('./hardware.db');

// Initialize database tables
function initDatabase() {
    console.log('Initializing database...');
    
    db.serialize(() => {
        // Users table
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
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
            )
        `);
        
        // Hardware Requests table with grading columns
        db.run(`
            CREATE TABLE IF NOT EXISTS hardware_requests (
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
            )
        `);
        
        // Deployed Units table
        db.run(`
            CREATE TABLE IF NOT EXISTS deployed_units (
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
            )
        `);
        
        // Asset Categories table
        db.run(`
            CREATE TABLE IF NOT EXISTS asset_categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category_name TEXT UNIQUE,
                created_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Activity Logs table
        db.run(`
            CREATE TABLE IF NOT EXISTS activity_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                action TEXT,
                details TEXT,
                ip_address TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
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
            db.run(`INSERT OR IGNORE INTO asset_categories (category_name) VALUES (?)`, [cat]);
        });
        
        // Insert default admin user
        const hashedPassword = bcrypt.hashSync('admin123', 10);
        
        db.get('SELECT id FROM users WHERE username = ?', ['admin'], (err, row) => {
            if (!row) {
                db.run(`INSERT INTO users (username, password, role, fullname, email, branch_code, branch_name) 
                        VALUES (?, ?, ?, ?, ?, ?, ?)`, 
                        ['admin', hashedPassword, 'admin', 'System Administrator', 'admin@example.com', 'ADMIN', 'Head Office']);
            }
        });
        
        // Insert sample DIT user
        db.get('SELECT id FROM users WHERE username = ?', ['dituser'], (err, row) => {
            if (!row) {
                db.run(`INSERT INTO users (username, password, role, fullname, email, branch_code, branch_name) 
                        VALUES (?, ?, ?, ?, ?, ?, ?)`, 
                        ['dituser', hashedPassword, 'dit', 'DIT Officer', 'dit@example.com', 'DIT001', 'Main Branch']);
            }
        });
        
        // Insert sample BIT user
        db.get('SELECT id FROM users WHERE username = ?', ['bituser'], (err, row) => {
            if (!row) {
                db.run(`INSERT INTO users (username, password, role, fullname, email, branch_code, branch_name) 
                        VALUES (?, ?, ?, ?, ?, ?, ?)`, 
                        ['bituser', hashedPassword, 'bit', 'BIT Staff', 'bit@example.com', 'BIT001', 'Store Branch']);
            }
        });
    });
}

function logActivity(userId, action, details, ip = null) {
    db.run(`INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)`,
        [userId, action, details, ip]);
}

initDatabase();

module.exports = { db, initDatabase, logActivity };