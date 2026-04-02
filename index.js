const express = require("express");
const { initDB } = require("./src/config/db");
const User = require("./src/models/User");
const { list } = require("@vercel/blob"); // Vercel Blob için
const Pusher = require("pusher");

const app = express();

// Büyük dosya transferleri (Base64) için limitleri artırıyoruz
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const PORT = 3000;

// Pusher Yapılandırması
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true,
});

initDB();

// --- 1. KAYITLI KİTAPLARI LİSTELE (Vercel Blob'dan) ---
app.get("/books", async (req, res) => {
  try {
    // Vercel Blob üzerindeki tüm dosyaları listeler
    const { blobs } = await list();
    const epubs = blobs.filter((b) => b.pathname.endsWith(".epub"));
    res.json(
      epubs.map((b) => ({
        name: b.pathname,
        url: b.url, // Android doğrudan bu URL'den indirebilir
        size: b.size,
      })),
    );
  } catch (e) {
    res.status(500).json({ error: "Blob listesi alınamadı: " + e.message });
  }
});

// --- 2. GMAIL'DEN GELEN ANLIK KİTAP (Tünel Modeli) ---
app.post("/ingest-email-book", async (req, res) => {
  try {
    const { userId, fileName, fileBlob } = req.body;

    if (!userId || !fileBlob) {
      return res.status(400).json({ error: "Veri eksik." });
    }

    // Dosyayı sunucuya kaydetmiyoruz, RAM'den Pusher'a basıyoruz
    await pusher.trigger(`user-${userId}`, "new-book", {
      file: fileBlob, // Base64 EPUB verisi
      name: fileName,
    });

    res.json({ status: "ok", message: "Kitap kullanıcıya iletildi." });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- 3. KULLANICI İŞLEMLERİ ---
app.get("/users", (req, res) => {
  User.getAll((err, rows) => res.json(rows));
});

app.post("/update-progress", (req, res) => {
  User.updateProgress(req.body, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ status: "ok" });
  });
});

app.listen(PORT, "0.0.0.0", () =>
  console.log(`Server running on port ${PORT}`),
);
