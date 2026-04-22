import { del, list } from "@vercel/blob";
import express from "express";
import sql from "../src/config/db.js";
import { accountService } from "../src/services/accountService.js";
import { bookService } from "../src/services/bookService.js";

const app = express();
app.use(express.json({ limit: "50mb" }));

app.post("/auth/sync", async (req, res) => {
  try {
    const { email, displayName } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });

    const data = await accountService.syncAccount(email, displayName);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- PROFILE UPDATE ---
app.put("/profile/:id", async (req, res) => {
  try {
    const updated = await accountService.updateProfile(req.params.id, req.body);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/check-inbox", async (req, res) => {
  try {
    const { userId } = req.query; // Örn: test@gmail.com
    if (!userId) return res.status(400).json({ error: "userId gerekli" });

    const { blobs } = await list({
      prefix: `inbox/${userId.toLowerCase().trim()}/`,
    });

    if (blobs.length === 0) return res.json([]);

    const fileIds = blobs.map((b) =>
      b.pathname.split("/").pop().replace(".epub", ""),
    );

    const metadataRecords = await sql`
      SELECT id, original_name as name 
      FROM book_metadata 
      WHERE id IN ${sql(fileIds)}
    `;

    const results = blobs.map((blob) => {
      const uuid = blob.pathname.split("/").pop().replace(".epub", "");
      const meta = metadataRecords.find((m) => m.id === uuid);

      return {
        id: uuid,
        name: meta ? meta.name : "Bilinmeyen Kitap", // DB'de varsa gerçek adı, yoksa fallback
        url: blob.url,
        size: blob.size,
      };
    });

    res.json(results);
  } catch (e) {
    console.error("Inbox Hatası:", e.message);
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

  if (!userId || !fileName || !fileBlob) {
    return res
      .status(400)
      .json({ error: "Eksik veri: userId, fileName veya fileBlob gerekli." });
  }

  try {
    const result = await bookService.ingestBook(userId, fileName, fileBlob);
    res.json({ status: "success", ...result });
  } catch (e) {
    console.error("Ingest Error:", e.message);
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
