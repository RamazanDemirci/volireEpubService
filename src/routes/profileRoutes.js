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

// router.post("/progress", ...) içeriğini şununla değiştir:
router.post("/progress", async (req, res) => {
  // Destructuring kısmını yeni isimlere göre güncelledik
  const { profileId, bookId, lastPartIndex, pageStart, pageEnd, percentage } =
    req.body;

  try {
    await sql.begin(async (sql) => {
      const [profile] =
        await sql`SELECT book_progress_map FROM profiles WHERE id = ${profileId}`;
      if (!profile) throw new Error("Profil bulunamadı");

      // A) JSON Map Güncelleme
      const updatedMap = {
        ...(profile.book_progress_map || {}),
        [bookId]: {
          lastPartIndex: parseInt(lastPartIndex),
          pageStart: parseInt(pageStart || 0), // lastWordIndex yerine pageStart
          pageEnd: parseInt(pageEnd || 0),
          percentage: parseInt(percentage || 0),
          updatedAt: new Date(),
        },
      };

      await sql`
        UPDATE profiles SET 
          book_progress_map = ${sql.json(updatedMap)},
          last_book_id = ${bookId}
        WHERE id = ${profileId}
      `;

      // B) book_progress tablosu (Kolon isimlerin veritabanında neyse ona göre eşle)
      // Eğer veritabanında kolon isimlerini değiştirmediysen last_word_index'e pageStart'ı yazabilirsin
      // Ama en temizi kolon isimlerini de (page_start, page_end) olarak migrate etmektir.
      await sql`
        INSERT INTO book_progress (
          profile_id, book_id, last_part_index, last_word_index, updated_at
        ) VALUES (
          ${profileId}, 
          ${bookId}, 
          ${parseInt(lastPartIndex)}, 
          ${parseInt(pageStart || 0)}, 
          ${new Date()}
        )
        ON CONFLICT (profile_id, book_id) 
        DO UPDATE SET 
          last_part_index = EXCLUDED.last_part_index,
          last_word_index = EXCLUDED.last_word_index,
          updated_at = EXCLUDED.updated_at
      `;
    });

    res.json({ status: "success" });
  } catch (e) {
    console.error("Progress Hatası:", e);
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
