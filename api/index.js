import { list, put } from "@vercel/blob"; // <--- 'list' buraya eklendi
import express from "express";
import sql from "../src/config/db.js";

const app = express();
app.use(express.json({ limit: "50mb" }));

// --- 0. CHECK-INBOX (Düzeltildi) ---
app.get("/check-inbox", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    // Vercel Blob listeleme
    const { blobs } = await list({ prefix: `inbox/${userId}/` });

    // Android tarafındaki BookResponse modeline uygun eşleme
    const results = blobs.map((b) => {
      const fileName = b.pathname.split("/").pop();
      return {
        id: fileName.replace(".epub", "").replace(/\s/g, "_"), // Android id bekliyor
        name: fileName,
        url: b.url,
        size: b.size,
      };
    });

    res.json(results);
  } catch (e) {
    console.error("List Error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// --- 1. GMAIL EPUB INGEST ---
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

    // Opsiyonel: Veritabanına da işlemek istersen burada bırakabilirsin
    // Ama /check-inbox artık doğrudan Blob'dan okuduğu için DB zorunlu değil
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

// --- 2. AYARLARI SENKRONİZE ET ---
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

// --- 3. İLERLEMEYİ KAYDET ---
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

// --- 4. İLERLEMEYİ GETİR ---
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
