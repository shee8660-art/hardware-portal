const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

db.serialize(() => {
  db.all("PRAGMA table_info(hardware_requests);", (err, columns) => {
    if (err) {
      console.error(err.message);
      return db.close();
    }

    const hasCategory = columns.some(col => col.name === "category");
    if (hasCategory) {
      console.log("✅ 'category' column already exists.");
      db.close();
    } else {
      db.run("ALTER TABLE hardware_requests ADD COLUMN category TEXT;", (err) => {
        if (err) console.error(err.message);
        else console.log("✅ 'category' column added to hardware_requests table.");
        db.close();
      });
    }
  });
});
