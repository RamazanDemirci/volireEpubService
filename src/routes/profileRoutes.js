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
  const { profileId, bookId, lastPartIndex, pageStart, pageEnd, percentage } =
    req.body;

  try {
    await sql.begin(async (sql) => {
      // A) profiles tablosundaki JSON haritasını güncelle
      const [profile] =
        await sql`SELECT book_progress_map FROM profiles WHERE id = ${profileId}`;
      if (!profile) throw new Error("Profil bulunamadı");

      const updatedMap = {
        ...(profile.book_progress_map || {}),
        [bookId]: {
          lastPartIndex: parseInt(lastPartIndex),
          pageStart: parseInt(pageStart), // Yeni isim
          pageEnd: parseInt(pageEnd), // Yeni isim
          percentage: parseInt(percentage),
          updatedAt: new Date(),
        },
      };

      await sql`
        UPDATE profiles SET 
          book_progress_map = ${sql.json(updatedMap)},
          last_book_id = ${bookId}
        WHERE id = ${profileId}
      `;

      // B) book_progress tablosuna satır olarak ekle/güncelle
      await sql`
        INSERT INTO book_progress (
          profile_id, book_id, last_part_index, page_start, page_end, percentage, updated_at
        ) VALUES (
          ${profileId}, ${bookId}, ${parseInt(lastPartIndex)}, 
          ${parseInt(pageStart)}, ${parseInt(pageEnd)}, ${parseInt(percentage)}, 
          ${Date.now()}
        )
        ON CONFLICT (profile_id, book_id) 
        DO UPDATE SET 
          last_part_index = EXCLUDED.last_part_index,
          page_start = EXCLUDED.page_start,
          page_end = EXCLUDED.page_end,
          percentage = EXCLUDED.percentage,
          updated_at = EXCLUDED.updated_at
      `;
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
