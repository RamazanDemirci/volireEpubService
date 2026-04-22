import { list, put } from "@vercel/blob";
import crypto from "crypto";
import express from "express";
import sql from "../config/db.js"; // Bir üst klasöre çıkıp config'e gider

const router = express.Router();

const getFileHash = (content) =>
  crypto.createHash("md5").update(content).digest("hex");

router.post("/ingest-email-book", async (req, res) => {
  const { email, fileName, fileBlob } = req.body;
  if (!email || !fileName || !fileBlob)
    return res.status(400).json({ error: "Missing data" });

  try {
    const targetEmail = email.toLowerCase().trim();
    const buffer = Buffer.from(fileBlob, "base64");
    const fileHash = getFileHash(buffer);

    const profiles =
      await sql`SELECT id FROM profiles WHERE account_id = ${targetEmail} ORDER BY created_at ASC LIMIT 1`;
    if (profiles.length === 0)
      return res.status(404).json({ error: "Profile not found" });

    const mainProfileId = profiles[0].id;
    const existingBook =
      await sql`SELECT id, url FROM book_metadata WHERE file_hash = ${fileHash} LIMIT 1`;

    if (existingBook.length > 0) {
      return res.json({ status: "already_exists", url: existingBook[0].url });
    }

    const uuid = crypto.randomUUID();
    const blobPath = `inbox/${targetEmail}/${mainProfileId}/${uuid}.epub`;
    const blob = await put(blobPath, buffer, {
      access: "public",
      contentType: "application/epub+zip",
    });

    await sql`INSERT INTO book_metadata (id, original_name, url, file_hash) VALUES (${uuid}, ${fileName}, ${blob.url}, ${fileHash})`;

    res.json({ status: "success", path: blobPath });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/check-inbox", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId gerekli" });

    const prefix = `inbox/${userId.trim()}/`;
    const { blobs } = await list({ prefix });

    res.json(blobs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
