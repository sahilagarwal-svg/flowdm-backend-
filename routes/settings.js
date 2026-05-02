const express = require("express");
const router  = express.Router();
const db      = require("../services/db");

// GET a setting by key
router.get("/:key", async (req, res) => {
  try {
    const value = await db.getSetting(req.params.key);
    res.json({ key: req.params.key, value: value || "" });
  } catch (err) {
    console.error("[Settings] GET /:key:", err.message);
    res.status(500).json({ error: "Failed to load setting" });
  }
});

// POST set a setting
router.post("/", async (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: "key is required" });
  try {
    await db.setSetting(key, value || "");
    res.json({ key, value: value || "" });
  } catch (err) {
    console.error("[Settings] POST /:", err.message);
    res.status(500).json({ error: "Failed to save setting" });
  }
});

module.exports = router;
