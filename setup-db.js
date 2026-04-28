const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");

// Remove old database if needed (uncomment to reset)
// fs.unlinkSync("./database.db");

console.log("🔧 Initializing database...");

const db = new sqlite3.Database("./database.db", (err) => {
  if (err) return console.error("❌ DB ERROR:", err);
});

db.serialize(() => {

  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT
    )
  `);

  // Insert default users
  const stmt = db.prepare("INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)");
  stmt.run("admin", "admin123", "Admin");
  stmt.run("dit", "dit123", "DIT");
  stmt.run("depot", "depot123", "Depot");
  stmt.run("user", "user123", "User");
  stmt.finalize();

  // Categories table
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE
    )
  `);

  // Hardware requests table (full structure)
  db.run(`
    CREATE TABLE IF NOT EXISTS hardware_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_no TEXT,
      branch_name TEXT,
      date_reported TEXT,
      date_acknowledged TEXT,
      aging TEXT,
      category TEXT,
      brand TEXT,
      model TEXT,
      serial_no TEXT,
      quantity INTEGER,
      cost REAL,
      status TEXT DEFAULT 'Prepared',
      remarks TEXT,
      hardware_age TEXT,
      requested_by TEXT
    )
  `);

});

db.close(() => console.log("📁 Database setup complete!"));
