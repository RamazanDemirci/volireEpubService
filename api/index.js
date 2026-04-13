import express from "express";
import sql from "../src/config/db.js";
import { put } from "@vercel/blob";

const app = express();
app.use(express.json({ limit: "50mb" }));

// --- 1. AYARLARI SENKRONİZE ET (Android: syncSettings) ---
app.post("/sync/settings", async (req, res) => {
  const {
    userId,
    readingMode,
    isSmartBreak,
    readingWpm,
    wordDisplayCount,
    language,
    timestamp,
  } = req.body;
  try {
    await sql`
      UPDATE users SET 
        current_theme = ${readingMode}, 
        current_font_size = ${wordDisplayCount},
        updated_at = ${new Date(timestamp)}
      WHERE id = ${userId}
    `;
    res.json({ status: "success", message: "Settings synced" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- 2. İLERLEMEYİ KAYDET (Android: syncProgress) ---
app.post("/sync/progress", async (req, res) => {
  const { userId, bookId, lastPartIndex, lastWordIndex, timestamp } = req.body;
  try {
    await sql`
      INSERT INTO user_progress (user_id, book_id, last_chapter, last_index, updated_at)
      VALUES (${userId}, ${bookId}, ${lastPartIndex}, ${lastWordIndex}, ${new Date(timestamp)})
      ON CONFLICT (user_id, book_id) 
      DO UPDATE SET 
        last_chapter = EXCLUDED.last_chapter,
        last_index = EXCLUDED.last_index,
        updated_at = EXCLUDED.updated_at
    `;
    res.json({ status: "success", message: "Progress synced" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- 3. İLERLEMEYİ GETİR (Android: getProgress) ---
app.get("/sync/progress", async (req, res) => {
  const { userId, bookId } = req.query;
  try {
    const progress = await sql`
      SELECT last_chapter as "lastPartIndex", last_index as "lastWordIndex"
      FROM user_progress 
      WHERE user_id = ${userId} AND book_id = ${bookId}
    `;
    res.json(progress[0] || { lastPartIndex: 0, lastWordIndex: 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- 4. GMAIL EPUB INGEST ---
app.post("/ingest-email-book", async (req, res) => {
  const { userId, fileName, fileBlob } = req.body;
  if (!userId || !fileName || !fileBlob)
    return res.status(400).json({ error: "Missing data" });

  try {
    const buffer = Buffer.from(fileBlob, "base64");
    const blob = await put(`inbox/${userId}/${fileName}`, buffer, {
      access: "public",
      contentType: "application/epub+zip",
    });
    res.json({ status: "success", url: blob.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
