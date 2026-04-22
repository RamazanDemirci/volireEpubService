import { del, list, put } from "@vercel/blob";
import express from "express";
import sql from "../src/config/db.js";

const app = express();
app.use(express.json({ limit: "50mb" }));

app.get("/check-inbox", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const { blobs } = await list({ prefix: `inbox/${userId}/` });

    const results = blobs.map((b) => {
      const fileName = b.pathname.split("/").pop();
      return {
        id: fileName.replace(".epub", "").replace(/\s/g, "_"),
        name: fileName,
        url: b.url,
        size: b.size,
      };
    });

    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/remove-from-inbox", async (req, res) => {
  try {
    const { fileUrl, userId, bookId } = req.query;
    if (!fileUrl) return res.status(400).json({ error: "fileUrl is required" });

    await del(fileUrl);

    if (userId && bookId) {
      await sql`
        DELETE FROM user_books 
        WHERE user_id = ${userId} AND book_id = ${bookId}
      `;
    }

    res.json({ status: "success", message: "Deleted from inbox" });
  } catch (e) {
    console.error("Delete Error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

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

    const bookId = fileName.replace(".epub", "").replace(/\s/g, "_");
    await sql`
      INSERT INTO user_books (user_id, book_id, file_name, file_url)
      VALUES (${userId}, ${bookId}, ${fileName}, ${blob.url})
      ON CONFLICT (user_id, book_id) DO UPDATE SET file_url = EXCLUDED.file_url
    `;

    res.json({ status: "success", url: blob.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/sync/settings", async (req, res) => {
  const { userId, readingMode, wordDisplayCount, timestamp } = req.body;
  try {
    await sql`
      UPDATE users SET 
        current_theme = ${readingMode}, 
        current_font_size = ${wordDisplayCount},
        updated_at = ${timestamp ? new Date(timestamp) : new Date()}
      WHERE id = ${userId}
    `;
    res.json({ status: "success", message: "Settings synced" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/sync/progress", async (req, res) => {
  const { userId, bookId, lastPartIndex, lastWordIndex, timestamp } = req.body;
  try {
    await sql`
      INSERT INTO user_progress (user_id, book_id, last_chapter, last_index, updated_at)
      VALUES (${userId}, ${bookId}, ${lastPartIndex}, ${lastWordIndex}, ${timestamp ? new Date(timestamp) : new Date()})
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
