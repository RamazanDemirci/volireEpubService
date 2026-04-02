const express = require("express");
const { put, list, del } = require("@vercel/blob"); // Vercel Blob araçları
const app = express();

// Büyük dosya transferi için limitler
app.use(express.json({ limit: "50mb" }));

const PORT = process.env.PORT || 3000;

// --- 1. GMAIL'DEN GELEN KİTABI "INBOX"A KOY ---
app.post("/ingest-email-book", async (req, res) => {
  try {
    const { userId, fileName, fileBlob } = req.body;

    // Base64 veriyi binary (Buffer) formatına çevir
    const buffer = Buffer.from(fileBlob, "base64");

    // Vercel Blob'da 'inbox/userId/kitap-adi.epub' yoluna kaydet
    // 'addRandomSuffix: false' yapıyoruz ki dosya adı temiz kalsın
    const blob = await put(`inbox/${userId}/${fileName}`, buffer, {
      access: "public",
      addRandomSuffix: false,
    });

    console.log(`Yeni kitap inbox'a eklendi: ${fileName}`);
    res.json({ status: "ok", url: blob.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- 2. ANDROID İÇİN "GELEN KUTUSU" SORGULAMA ---
app.get("/check-inbox", async (req, res) => {
  try {
    const { userId } = req.query; // Örn: /check-inbox?userId=admin

    // Blob içindeki 'inbox/userId/' ile başlayan dosyaları listele
    const { blobs } = await list({ prefix: `inbox/${userId}/` });

    res.json(
      blobs.map((b) => ({
        name: b.pathname.split("/").pop(), // Sadece dosya adını al
        url: b.url,
        size: b.size,
      })),
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- 3. KİTAP İNDİRİLDİKTEN SONRA SİLME (OPSİYONEL) ---
// Android kitabı başarıyla indirdiğinde bu endpoint'i çağırıp sunucuyu temizleyebilir
app.delete("/remove-from-inbox", async (req, res) => {
  try {
    const { fileUrl } = req.query;
    await del(fileUrl);
    res.json({ status: "deleted" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`Relay Server running on port ${PORT}`));
