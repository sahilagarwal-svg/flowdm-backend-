const router = require("express").Router();
const db     = require("../services/db");

// GET /api/contacts?limit=200&offset=0
router.get("/", async (req, res) => {
  try {
    const clientId = req.headers["x-client-id"] || null;
    const limit    = Math.min(parseInt(req.query.limit)  || 200, 1000);
    const offset   = parseInt(req.query.offset) || 0;
    const contacts = await db.getContacts(clientId, limit, offset);
    res.json(contacts);
  } catch (err) {
    console.error("[contacts] GET /:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/contacts/:igUserId/optout
router.patch("/:igUserId/optout", async (req, res) => {
  try {
    const clientId = req.headers["x-client-id"] || null;
    const { igUserId } = req.params;
    const { optedOut } = req.body;
    if (typeof optedOut !== "boolean") return res.status(400).json({ error: "optedOut must be boolean" });
    await db.setContactOptOut(igUserId, clientId, optedOut);
    res.json({ ok: true });
  } catch (err) {
    console.error("[contacts] PATCH optout:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
