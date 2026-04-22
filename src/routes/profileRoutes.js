import express from "express";
import sql from "../config/db.js";

const router = express.Router();

// GET: /api/profiles/:accountId
// Belirli bir hesaba (email) bağlı tüm profilleri getirir
router.get("/:accountId", async (req, res) => {
  const { accountId } = req.params;

  try {
    const profiles = await sql`
      SELECT id, account_id, display_name, avatar_url, created_at 
      FROM profiles 
      WHERE account_id = ${accountId.toLowerCase().trim()}
      ORDER BY created_at ASC
    `;

    res.json(profiles);
  } catch (e) {
    console.error("Profile fetch error:", e);
    res.status(500).json({ error: "Profiller getirilirken bir hata oluştu." });
  }
});

// GET: /api/profiles/detail/:profileId
// Tek bir profilin detayını ID üzerinden getirir
router.get("/detail/:profileId", async (req, res) => {
  const { profileId } = req.params;

  try {
    const profile = await sql`
      SELECT * FROM profiles WHERE id = ${profileId}
    `;

    if (profile.length === 0) {
      return res.status(404).json({ error: "Profil bulunamadı." });
    }

    res.json(profile[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
