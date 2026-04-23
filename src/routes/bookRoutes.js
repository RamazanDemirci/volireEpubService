import { list, put } from "@vercel/blob";
import crypto from "crypto";
import express from "express";
import sql from "../config/db.js";

const router = express.Router();

const getFileHash = (content) =>
  crypto.createHash("md5").update(content).digest("hex");

// POST: /api/books/ingest-email-book
router.post("/ingest-email-book", async (req, res) => {
  const { email, fileName, fileBlob } = req.body;
  if (!email || !fileName || !fileBlob)
    return res.status(400).json({ error: "Missing data" });

  try {
    const targetEmail = email.toLowerCase().trim();
    const buffer = Buffer.from(fileBlob, "base64");
    const fileHash = getFileHash(buffer);

    // 1. Profili bul (account_id üzerinden)
    const profiles = await sql`
      SELECT id FROM profiles 
      WHERE account_id = ${targetEmail} 
      ORDER BY created_at ASC LIMIT 1
    `;

    if (profiles.length === 0) {
      return res
        .status(404)
        .json({ error: `Profile not found for: ${targetEmail}` });
    }

    const mainProfileId = profiles[0].id;

    // 2. Kitap daha önce yüklendi mi? (file_hash veya fingerprint kontrolü)
    const existingBook = await sql`
      SELECT id, url FROM book_metadata 
      WHERE file_hash = ${fileHash} OR fingerprint = ${fileHash} 
      LIMIT 1
    `;

    if (existingBook.length > 0) {
      return res.json({
        status: "already_exists",
        url: existingBook[0].url,
        bookId: existingBook[0].id,
      });
    }

    // 3. Vercel Blob'a yükle
    const uuid = crypto.randomUUID();
    const blobPath = `inbox/${targetEmail}/${mainProfileId}/${uuid}.epub`;
    const blob = await put(blobPath, buffer, {
      access: "public",
      contentType: "application/epub+zip",
    });

    // 4. Veritabanına kaydet (Şemandaki kolon isimlerine göre)
    // Hem fingerprint hem file_hash'e aynı hash'i yazıyoruz çünkü fingerprint NOT NULL.
    await sql`
      INSERT INTO book_metadata (id, fingerprint, original_name, url, file_hash) 
      VALUES (${uuid}, ${fileHash}, ${fileName}, ${blob.url}, ${fileHash})
    `;

    res.json({
      status: "success",
      path: blobPath,
      url: blob.url,
      bookId: uuid,
    });
  } catch (e) {
    console.error("Ingest error:", e);
    res.status(500).json({ error: e.message });
  }
});

router.get("/check-inbox", async (req, res) => {
  try {
    // 1. Parametreleri al
    const { email, profileId } = req.query;

    // API esnekliği: Sadece email gelirse mail klasörüne,
    // profileId de gelirse spesifik profil klasörüne baksın.
    const userId = email || profileId;

    if (!userId)
      return res.status(400).json({ error: "Email veya profileId gerekli" });

    // 2. Klasör yolunu (prefix) oluştur
    // Senin yapına göre: inbox/radem18@gmail.com/profile_w4jp2s5ho/
    let targetPath = `inbox/${email.trim()}/`;
    if (profileId) {
      targetPath += `${profileId.trim()}/`;
    }

    console.log("Aranan yol:", targetPath);

    // 3. Vercel Blob listeleme (list artık yukarıda import edildiği için çalışacak)
    const { blobs } = await list({ prefix: targetPath });

    // 4. Sonucu dön
    res.json(
      blobs.map((b) => ({
        id: b.pathname.split("/").pop().replace(".epub", ""), // UUID kısmı
        name: b.pathname.split("/").pop(), // Dosya adı
        url: b.url,
        size: b.size,
        uploadedAt: b.uploadedAt,
      })),
    );
  } catch (e) {
    console.error("API Hatası:", e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
