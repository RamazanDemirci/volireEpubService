import express from "express";
import bookRoutes from "./routes/bookRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import syncRoutes from "./routes/syncRoutes.js";

const app = express();
app.use(express.json({ limit: "50mb" }));

// Rotaları Bağla
app.use("/api/books", bookRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/sync", syncRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

export default app;
