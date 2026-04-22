import express from "express";
import sql from "../../src/config/db.js";
import { accountService } from "../../src/services/accountService.js";

const router = express.Router();

// POST: /api/sync/auth
router.post("/auth", async (req, res) => {
  try {
    const { email, displayName } = req.query;
    const data = await accountService.syncAccount(
      email || req.body.email,
      displayName || req.body.displayName,
    );
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST: /api/sync/progress
router.post("/progress", async (req, res) => {
  const { userId, bookId, lastPartIndex, lastWordIndex, timestamp } = req.body;
  try {
    await sql`INSERT INTO user_progress (user_id, book_id, last_chapter, last_index, updated_at) 
                  VALUES (${userId}, ${bookId}, ${lastPartIndex}, ${lastWordIndex}, ${timestamp ? new Date(timestamp) : new Date()}) 
                  ON CONFLICT (user_id, book_id) DO UPDATE SET last_chapter = EXCLUDED.last_chapter, last_index = EXCLUDED.last_index, updated_at = EXCLUDED.updated_at`;
    res.json({ status: "success" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET: /api/sync/progress
router.get("/progress", async (req, res) => {
  try {
    const { userId, bookId } = req.query;
    const progress =
      await sql`SELECT last_chapter as "lastPartIndex", last_index as "lastWordIndex" FROM user_progress WHERE user_id = ${userId} AND book_id = ${bookId}`;
    res.json(progress[0] || { lastPartIndex: 0, lastWordIndex: 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
