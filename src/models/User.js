const { db } = require("../config/db");

const User = {
  getAll: (callback) => {
    db.all("SELECT * FROM users", [], callback);
  },
  updateProgress: (data, callback) => {
    const { userId, lastBook, lastChapter, lastIndex, wordCount } = data;
    db.run(
      `UPDATE users SET last_book = ?, last_chapter = ?, last_index = ?, word_count = ? WHERE id = ?`,
      [lastBook, lastChapter, lastIndex, wordCount, userId],
      callback,
    );
  },
};

module.exports = User;
