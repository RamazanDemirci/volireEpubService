const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const db = new sqlite3.Database(path.join(__dirname, "../../library.db"));

const initDB = () => {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            name TEXT, 
            last_book TEXT, 
            last_chapter INTEGER DEFAULT 0, 
            last_index INTEGER DEFAULT 0, 
            word_count INTEGER DEFAULT 1
        )`);

    // Örnek bir kullanıcı ekleyelim (Eğer tablo boşsa)
    db.get("SELECT count(*) as count FROM users", (err, row) => {
      if (row.count === 0) {
        db.run("INSERT INTO users (name) VALUES ('Ramazan')");
      }
    });
  });
};

module.exports = { db, initDB };
