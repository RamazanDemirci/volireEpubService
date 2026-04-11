import express from "express";
import sql from "./db.js";

const app = express();
app.use(express.json({ limit: "50mb" }));

// --- PROFİL VE AYARLARI GETİR ---
app.get("/get-profile", async (req, res) => {
  const { userId } = req.query;
  try {
    const users = await sql`
            SELECT id, name, current_theme as "currentTheme", current_font_size as "currentFontSize"
            FROM users WHERE id = ${userId}
        `;
    if (users.length === 0)
      return res.status(404).json({ error: "User not found" });
    res.json(users[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- KİTAP İLERLEMESİNİ GETİR ---
app.get("/get-progress", async (req, res) => {
  const { userId, bookId } = req.query;
  try {
    const progress = await sql`
            SELECT last_chapter as "lastChapter", last_index as "lastIndex"
            FROM user_progress 
            WHERE user_id = ${userId} AND book_id = ${bookId}
            LIMIT 1
        `;

    // Eğer kayıt yoksa varsayılan olarak 0,0 dönüyoruz (Android hata almasın diye)
    res.json(progress[0] || { lastChapter: 0, lastIndex: 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- TÜM VERİLERİ SENKRONİZE ET (SAVE) ---
app.post("/sync-all", async (req, res) => {
  const { userId, bookId, lastChapter, lastIndex, settings } = req.body;

  try {
    // Transaction (İşlem Grubu) kullanarak iki tabloyu aynı anda güncelliyoruz
    await sql.begin(async (sql) => {
      // 1. Kullanıcı Genel Ayarları Güncelle
      await sql`
                UPDATE users SET 
                    current_theme = ${settings.theme},
                    current_font_size = ${settings.fontSize}
                WHERE id = ${userId}
            `;

      // 2. Kitap İlerlemesini Kaydet (Yoksa ekle, varsa güncelle)
      await sql`
                INSERT INTO user_progress (user_id, book_id, last_chapter, last_index, updated_at)
                VALUES (${userId}, ${bookId}, ${lastChapter}, ${lastIndex}, NOW())
                ON CONFLICT (user_id, book_id) 
                DO UPDATE SET 
                    last_chapter = EXCLUDED.last_chapter,
                    last_index = EXCLUDED.last_index,
                    updated_at = NOW()
            `;
    });

    res.json({ status: "success", message: "Sync completed" });
  } catch (e) {
    console.error("Sync Error:", e);
    res.status(500).json({ error: e.message });
  }
});

// Port Dinleme
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
