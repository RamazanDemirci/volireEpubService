import express from "express";
import sql from "./db.js";

const app = express();
app.use(express.json({ limit: "50mb" }));

app.get("/get-profile", async (req, res) => {
  const { userId } = req.query;
  try {
    const users = await sql`
      SELECT id, name, current_theme as "currentTheme", current_font_size as "currentFontSize"
      FROM users WHERE id = ${userId}
    `;
    if (users.length === 0)
      return res.status(404).json({ error: "User not found" });
    res.json(users[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/get-progress", async (req, res) => {
  const { userId, bookId } = req.query;
  try {
    const progress = await sql`
      SELECT last_chapter as "lastChapter", last_index as "lastIndex"
      FROM user_progress 
      WHERE user_id = ${userId} AND book_id = ${bookId}
      LIMIT 1
    `;
    res.json(progress[0] || { lastChapter: 0, lastIndex: 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/sync-all", async (req, res) => {
  const { userId, bookId, lastChapter, lastIndex, settings } = req.body;
  try {
    await sql.begin(async (sql) => {
      await sql`
        UPDATE users SET 
          current_theme = ${settings.theme},
          current_font_size = ${settings.fontSize}
        WHERE id = ${userId}
      `;
      await sql`
        INSERT INTO user_progress (user_id, book_id, last_chapter, last_index, updated_at)
        VALUES (${userId}, ${bookId}, ${lastChapter}, ${lastIndex}, NOW())
        ON CONFLICT (user_id, book_id) 
        DO UPDATE SET 
          last_chapter = EXCLUDED.last_chapter,
          last_index = EXCLUDED.last_index,
          updated_at = NOW()
      `;
    });
    res.json({ status: "success", message: "Sync completed" });
  } catch (e) {
    console.error("Sync Error:", e);
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
