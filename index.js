import express from "express";
import accountRoutes from "./src/routes/accountRoutes.js";
import bookRoutes from "./src/routes/bookRoutes.js";
import profileRoutes from "./src/routes/profileRoutes.js";

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Rotalar
app.use("/api/books", bookRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/accounts", accountRoutes); // Yeni ve net isimlendirme

app.get("/", (req, res) => {
  res.json({ status: "online", service: "Volire Epub Service" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export default app;
