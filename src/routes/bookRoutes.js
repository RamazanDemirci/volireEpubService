import { put } from "@vercel/blob";
import crypto from "crypto";
import express from "express";
import sql from "../config/db.js";
import { bookService } from "../services/bookService.js";

const router = express.Router();

/**
 * GET /api/books/check-inbox
 */
router.get("/check-inbox", async (req, res) => {
  const { email, profileId } = req.query;
  if (!email) return res.status(400).json({ error: "Email gerekli" });

  try {
    const books = await bookService.getEnrichedBookList(email, profileId);
    res.json(books);
  } catch (e) {
    console.error("Inbox Error:", e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/books/rename
 */
router.post("/rename", async (req, res) => {
  const { bookId, profileId, newName } = req.body;
  if (!bookId || !profileId || !newName)
    return res.status(400).json({ error: "Eksik veri" });

  try {
    await bookService.updateDisplayName(profileId, bookId, newName);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/books/ingest-email-book
 * E-posta ile gelen kitapları işler
 */
router.post("/ingest-email-book", async (req, res) => {
  const { email, fileName, fileBlob } = req.body;

  try {
    const buffer = Buffer.from(fileBlob, "base64");
    const fingerprint = await bookService.generateFingerprint(buffer);

    // Ana profili bul
    const [profile] =
      await sql`SELECT id FROM profiles WHERE account_id = ${email.toLowerCase()} ORDER BY created_at LIMIT 1`;
    if (!profile) throw new Error("Profil bulunamadı");

    // Metadata kontrol/kayıt
    let [metadata] =
      await sql`SELECT id, url FROM book_metadata WHERE fingerprint = ${fingerprint}`;

    if (!metadata) {
      const uuid = crypto.randomUUID();
      const blob = await put(
        `inbox/${email}/${profile.id}/${uuid}.epub`,
        buffer,
        {
          access: "public",
          contentType: "application/epub+zip",
        },
      );

      [metadata] = await sql`
        INSERT INTO book_metadata (id, fingerprint, original_name, url) 
        VALUES (${uuid}, ${fingerprint}, ${fileName}, ${blob.url})
        RETURNING id, url
      `;
    }

    res.json({ status: "success", bookId: metadata.id, url: metadata.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
