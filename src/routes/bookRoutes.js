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
    if (!email) return res.status(400).json({ error: "Email gerekli" });

    let targetPath = `inbox/${email.trim()}/`;
    if (profileId) targetPath += `${profileId.trim()}/`;

    const { blobs } = await list({ prefix: targetPath });
    if (!blobs || blobs.length === 0) return res.json([]);

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
    const nameMap = {};

    try {
      // Postgres dizisi formatına dönüştürme: {id1,id2,id3}
      const pgArray = `{${ids.join(",")}}`;

      // Vercel Postgres'te sql fonksiyonu bazen doğrudan dizi bazen sonuç nesnesi döner
      const result = await sql`
        SELECT id, original_name 
        FROM book_metadata 
        WHERE id = ANY(${pgArray}::varchar[])
      `;

      // 'rows' undefined ise 'result' nesnesinin kendisine veya 'result.rows'a bak
      const rows = result.rows || (Array.isArray(result) ? result : []);

      if (rows && Array.isArray(rows)) {
        rows.forEach((row) => {
          nameMap[row.id] = row.original_name;
        });
      }
    } catch (dbError) {
      console.error("DB Sorgu Hatası (Sessiz):", dbError);
      // Veritabanı hatası olsa bile uygulama çökmemeli, UUID ile devam etmeli.
    }

    const response = blobData.map((b) => ({
      id: b.id,
      // Eğer DB'den isim geldiyse onu kullan, yoksa UUID dosya adını
      name: nameMap[b.id] || b.fileName,
      url: b.url,
      size: b.size,
      uploadedAt: b.uploadedAt,
    }));

    res.json(response);
  } catch (e) {
    console.error("Genel API Hatası:", e);
    res.status(500).json({ error: e.message });
  }
});

router.post("/rename", async (req, res) => {
  const { bookId, profileId, newName } = req.body;

  try {
    await sql`
      INSERT INTO profile_books (profile_id, book_id, display_name)
      VALUES (${profileId}, ${bookId}, ${newName})
      ON CONFLICT (profile_id, book_id) 
      DO UPDATE SET display_name = ${newName}
    `;
    res.status(200).json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
