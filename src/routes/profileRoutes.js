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

// İlerleme Kaydı (Progress): POST /api/profiles/progress
router.post("/progress", async (req, res) => {
  const { profileId, bookId, lastPartIndex, lastWordIndex } = req.body;
  try {
    const [profile] =
      await sql`SELECT book_progress_map FROM profiles WHERE id = ${profileId}`;
    if (!profile) return res.status(404).json({ error: "Profil bulunamadı" });

    const updatedMap = {
      ...(profile.book_progress_map || {}),
      [bookId]: { lastPartIndex, lastWordIndex, updatedAt: new Date() },
    };

    await accountService.updateProfile(profileId, {
      book_progress_map: updatedMap,
      last_book_id: bookId,
    });

    res.json({ status: "success" });
  } catch (e) {
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
