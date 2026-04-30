const express = require("express");
const router  = express.Router();
const db      = require("../services/db");

function getClientId(req) {
  const h = req.headers["x-client-id"];
  return h && h !== "null" && h !== "undefined" ? h : null;
}

router.get("/stats", async (req, res) => {
  try {
    res.json(await db.getStats(getClientId(req)));
  } catch (err) {
    console.error("[Analytics] GET /stats:", err.message);
    res.status(500).json({ error: "Failed to load stats" });
  }
});

router.get("/events", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    res.json(await db.getRecentEvents(limit, getClientId(req)));
  } catch (err) {
    console.error("[Analytics] GET /events:", err.message);
    res.status(500).json({ error: "Failed to load events" });
  }
});

module.exports = router;
