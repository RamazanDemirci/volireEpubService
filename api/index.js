import { del, list, put } from "@vercel/blob";
import crypto from "crypto";
import express from "express";
import sql from "../src/config/db.js";
import { accountService } from "../src/services/accountService.js";

const app = express();
app.use(express.json({ limit: "50mb" }));

// --- AUTH & SYNC ---
app.post("/auth/sync", async (req, res) => {
  try {
    const { email, displayName } = req.query;
    const targetEmail = email || req.body.email;
    const targetName = displayName || req.body.displayName;

    if (!targetEmail) return res.status(400).json({ error: "Email required" });

    const data = await accountService.syncAccount(targetEmail, targetName);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- NEW PROFILE CREATE ---
app.post("/profile", async (req, res) => {
  try {
    const { account_id, name, avatar_id } = req.body;
    if (!account_id || !name)
      return res.status(400).json({ error: "Missing fields" });

    const newProfile = await accountService.createProfile(
      account_id,
      name,
      avatar_id,
    );
    res.json(newProfile);
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

// --- INBOX & BOOKS ---
app.get("/check-inbox", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId gerekli" });

    const prefix = `inbox/${userId.trim()}/`;
    const { blobs } = await list({ prefix: prefix });

    if (blobs.length === 0) return res.json([]);

    const fileIds = blobs.map((b) =>
      b.pathname.split("/").pop().replace(".epub", ""),
    );

    const metadataRecords = await sql`
      SELECT id, original_name as name FROM book_metadata WHERE id IN ${sql(fileIds)}
    `;

    const results = blobs.map((blob) => {
      const uuid = blob.pathname.split("/").pop().replace(".epub", "");
      const meta = metadataRecords.find((m) => m.id === uuid);
      return {
        id: uuid,
        name: meta ? meta.name : "Bilinmeyen Kitap",
        url: blob.url,
        size: blob.size,
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
      await sql`DELETE FROM user_books WHERE user_id = ${userId} AND book_id = ${bookId}`;
    }
    res.json({ status: "success" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/ingest-email-book", async (req, res) => {
  const { email, fileName, fileBlob } = req.body;
  if (!email || !fileName || !fileBlob)
    return res
      .status(400)
      .json({ error: "Missing data (email, fileName, fileBlob)" });

  try {
    const targetEmail = email.toLowerCase().trim();
    const profiles = await sql`
      SELECT id FROM profiles 
      WHERE account_id = ${targetEmail} 
      ORDER BY created_at ASC LIMIT 1
    `;

    if (profiles.length === 0) {
      return res
        .status(404)
        .json({ error: "Profile not found for this email" });
    }

    const mainProfileId = profiles[0].id;
    const uuid = crypto.randomUUID();
    const blobPath = `inbox/${targetEmail}/${mainProfileId}/${uuid}.epub`;

    const buffer = Buffer.from(fileBlob, "base64");
    const blob = await put(blobPath, buffer, {
      access: "public",
      contentType: "application/epub+zip",
    });

    await sql`
      INSERT INTO book_metadata (id, original_name, url)
      VALUES (${uuid}, ${fileName}, ${blob.url})
    `;

    res.json({ status: "success", profileId: mainProfileId, path: blobPath });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- LEGACY SYNC SUPPORT ---
app.post("/sync/settings", async (req, res) => {
  const { userId, timestamp } = req.body;
  try {
    await sql`UPDATE accounts SET updated_at = ${timestamp ? new Date(timestamp) : new Date()} WHERE id = ${userId}`;
    res.json({ status: "success" });
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
      ON CONFLICT (user_id, book_id) DO UPDATE SET last_chapter = EXCLUDED.last_chapter, last_index = EXCLUDED.last_index, updated_at = EXCLUDED.updated_at
    `;
    res.json({ status: "success" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/sync/progress", async (req, res) => {
  const { userId, bookId } = req.query;
  try {
    const progress =
      await sql`SELECT last_chapter as "lastPartIndex", last_index as "lastWordIndex" FROM user_progress WHERE user_id = ${userId} AND book_id = ${bookId}`;
    res.json(progress[0] || { lastPartIndex: 0, lastWordIndex: 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
