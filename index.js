import express from "express";
import bookRoutes from "./src/routes/bookRoutes.js";
import profileRoutes from "./src/routes/profileRoutes.js";
import syncRoutes from "./src/routes/syncRoutes.js";

const app = express();

// Middleware: JSON verilerini ve büyük boyutlu Base64 (EPUB) dosyalarını kabul etmek için
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Rotaları Bağla (Endpoints)
app.use("/api/books", bookRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/sync", syncRoutes);

// Ana dizin için basit bir sağlık kontrolü (Health Check)
app.get("/", (req, res) => {
  res.json({ status: "online", service: "Volire Epub Service" });
});

// Port Ayarı
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
  🚀 Server running on port ${PORT}
  📂 API Endpoints:
  - Books:    http://localhost:${PORT}/api/books
  - Profiles: http://localhost:${PORT}/api/profiles
  - Sync:     http://localhost:${PORT}/api/sync
  `);
});

export default app;
