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
    const { email, profileId } = req.query;

    if (!email)
      return res.status(400).json({ error: "Email parametresi gerekli" });

    // 1. Klasör yolunu oluştur
    let targetPath = `inbox/${email.trim()}/`;
    if (profileId) {
      targetPath += `${profileId.trim()}/`;
    }

    // 2. Vercel Blob listesini al
    const { blobs } = await list({ prefix: targetPath });

    if (blobs.length === 0) return res.json([]);

    // 3. Blob'lardan ID listesi (UUID) oluştur
    const blobData = blobs.map((b) => {
      const fileName = b.pathname.split("/").pop();
      return {
        id: fileName.replace(".epub", ""),
        fileName: fileName,
        url: b.url,
        size: b.size,
        uploadedAt: b.uploadedAt,
      };
    });

    const ids = blobData.map((b) => b.id);

    // 4. Veri tabanından original_name bilgilerini çek
    // Not: db.query senin kullandığın DB kütüphanesine göre (pg, mysql vb.) değişebilir
    const { rows } = await db.query(
      "SELECT id, original_name FROM book_metadata WHERE id = ANY($1)",
      [ids],
    );

    // ID-Name eşleşmesi için bir map oluştur
    const nameMap = {};
    rows.forEach((row) => {
      nameMap[row.id] = row.original_name;
    });

    // 5. Blob verisini veri tabanı isimleriyle birleştir
    const response = blobData.map((b) => ({
      id: b.id,
      // Veri tabanında varsa original_name, yoksa dosya adını göster
      name: nameMap[b.id] || b.fileName,
      url: b.url,
      size: b.size,
      uploadedAt: b.uploadedAt,
    }));

    res.json(response);
  } catch (e) {
    console.error("API Hatası:", e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
