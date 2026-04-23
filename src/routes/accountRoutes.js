import express from "express";
import { accountService } from "../services/accountService.js";

const router = express.Router();

// POST /api/accounts/sync
// Android: accountRepository.syncAccount burayı çağırır
router.post("/sync", async (req, res) => {
  try {
    const email = req.body.email || req.query.email;
    const displayName = req.body.displayName || req.query.displayName;

    if (!email) return res.status(400).json({ error: "Email zorunludur." });

    const data = await accountService.syncAccount(email, displayName);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
