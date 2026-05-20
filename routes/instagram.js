const express     = require("express");
const router      = express.Router();
const db          = require("../services/db");
const requireAuth = require("../middleware/auth");

// All routes require a valid JWT

// GET /api/instagram/accounts
// Returns the connected Instagram accounts visible to the caller.
// Admin (JWT has username) sees all clients. Users see only their own.
router.get("/accounts", requireAuth, async (req, res) => {
  try {
    let accounts;
    if (req.user.userId) {
      accounts = await db.getClientsByUserId(req.user.userId);
    } else {
      accounts = await db.getClients(); // admin sees everything
    }
    res.json(accounts);
  } catch (err) {
    console.error("[Instagram] GET /accounts:", err.message);
    res.status(500).json({ error: "Failed to load accounts" });
  }
});

// DELETE /api/instagram/accounts/:id
// Disconnects an Instagram account — nulls out tokens and marks inactive.
// Does NOT delete the record so flows and contacts are preserved.
router.delete("/accounts/:id", requireAuth, async (req, res) => {
  try {
    const client = await db.getClientById(req.params.id);
    if (!client) return res.status(404).json({ error: "Account not found" });

    // Users can only disconnect their own accounts
    if (req.user.userId && client.userId !== req.user.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    await db.updateClientToken(req.params.id, {
      accessToken:    null,
      tokenExpiresAt: null,
      isActive:       false,
    });
    res.json({ success: true });
  } catch (err) {
    console.error("[Instagram] DELETE /accounts/:id:", err.message);
    res.status(500).json({ error: "Failed to disconnect account" });
  }
});

module.exports = router;
