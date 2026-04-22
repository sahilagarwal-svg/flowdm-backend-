const express = require("express");
const router = express.Router();
const db = require("../services/db");

router.get("/stats", (req, res) => {
  res.json(db.getStats());
});

router.get("/events", (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json(db.getRecentEvents(limit));
});

module.exports = router;
