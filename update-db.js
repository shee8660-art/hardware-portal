const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

db.serialize(() => {
  // Categories table
  db.run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
  )`);

  // Hardware Requests table
  db.run(`CREATE TABLE IF NOT EXISTS hardware_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER,
    item_name TEXT,
    quantity INTEGER,
    cost REAL,
    status TEXT DEFAULT 'Prepared',
    requested_by TEXT,
    FOREIGN KEY (category_id) REFERENCES categories(id)
  )`);

  console.log("✅ Tables 'categories' and 'hardware_requests' created/verified.");
});

db.close();