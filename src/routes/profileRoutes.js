import express from "express";
import sql from "../config/db.js";
import { accountService } from "../services/accountService.js";

const router = express.Router();

// Yeni Profil: POST /api/profiles
router.post("/", async (req, res) => {
  const { account_id, name, avatar_id } = req.body;
  try {
    const newProfile = await accountService.createProfile(
      account_id,
      name,
      avatar_id,
    );
    res.status(201).json(newProfile);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Profil Güncelleme: PUT /api/profiles/:id
router.put("/:id", async (req, res) => {
  try {
    const updated = await accountService.updateProfile(req.params.id, req.body);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/progress", async (req, res) => {
  const { profileId, bookId, lastPartIndex, lastWordIndex } = req.body;

  if (!profileId || !bookId) {
    return res
      .status(400)
      .json({ error: "Eksik parametre: profileId veya bookId" });
  }

  try {
    // 1. Mevcut profili ham sütun adıyla çek
    const [profile] =
      await sql`SELECT book_progress_map FROM profiles WHERE id = ${profileId}`;

    if (!profile) return res.status(404).json({ error: "Profil bulunamadı" });

    // 2. Map güncelleme (Snake_case sütun ismine dikkat)
    const currentMap = profile.book_progress_map || {};
    const updatedMap = {
      ...currentMap,
      [bookId]: {
        lastPartIndex: parseInt(lastPartIndex),
        lastWordIndex: parseInt(lastWordIndex),
        updatedAt: new Date().toISOString(), // Android'de String bekliyoruz
      },
    };

    // 3. Veritabanına yaz
    await sql`
      UPDATE profiles SET
        book_progress_map = ${sql.json(updatedMap)},
        last_book_id = ${bookId},
        updated_at = NOW()
      WHERE id = ${profileId}
    `;

    res.json({ status: "success" });
  } catch (e) {
    console.error("Progress Kayıt Hatası:", e);
    res.status(500).json({ error: e.message });
  }
});

// Profil Silme: DELETE /api/profiles/:id
router.delete("/:id", async (req, res) => {
  try {
    const profileId = req.params.id;

    if (!profileId) {
      return res.status(400).json({ error: "Profil ID zorunludur." });
    }

    await accountService.deleteProfile(profileId);

    res.json({
      status: "success",
      message: "Profil başarıyla silindi.",
    });
  } catch (e) {
    console.error("Delete Profile Error:", e);
    res.status(e.message.includes("bulunamadı") ? 404 : 500).json({
      error: e.message,
    });
  }
});

export default router;
