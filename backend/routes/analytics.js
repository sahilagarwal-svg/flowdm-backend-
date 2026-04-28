const express = require("express");
const router  = express.Router();
const db      = require("../services/db");

router.get("/stats", async (req, res) => {
  try {
    res.json(await db.getStats());
  } catch (err) {
    console.error("[Analytics] GET /stats:", err.message);
    res.status(500).json({ error: "Failed to load stats" });
  }
});

router.get("/events", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    res.json(await db.getRecentEvents(limit));
  } catch (err) {
    console.error("[Analytics] GET /events:", err.message);
    res.status(500).json({ error: "Failed to load events" });
  }
});

module.exports = router;
