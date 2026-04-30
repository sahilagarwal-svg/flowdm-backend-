const express = require("express");
const router  = express.Router();
const { v4: uuid } = require("uuid");
const db      = require("../services/db");

// GET all clients (tokens hidden)
router.get("/", async (req, res) => {
  try {
    res.json(await db.getClients());
  } catch (err) {
    console.error("[Clients] GET /:", err.message);
    res.status(500).json({ error: "Failed to load clients" });
  }
});

// GET single client (with credentials — for edit form)
router.get("/:id", async (req, res) => {
  try {
    const client = await db.getClientById(req.params.id);
    if (!client) return res.status(404).json({ error: "Client not found" });
    res.json(client);
  } catch (err) {
    console.error("[Clients] GET /:id:", err.message);
    res.status(500).json({ error: "Failed to load client" });
  }
});

// POST create client
router.post("/", async (req, res) => {
  const { name, igUsername, igAccountId, accessToken, appSecret, webhookToken } = req.body;
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "Client name is required" });
  }
  try {
    const client = {
      id: uuid(),
      name: String(name).trim(),
      igUsername:   igUsername   || null,
      igAccountId:  igAccountId  || null,
      accessToken:  accessToken  || null,
      appSecret:    appSecret    || null,
      webhookToken: webhookToken || null,
    };
    await db.saveClient(client);
    res.status(201).json({ ...client, accessToken: undefined });
  } catch (err) {
    console.error("[Clients] POST /:", err.message);
    res.status(500).json({ error: "Failed to create client" });
  }
});

// PATCH update client
router.patch("/:id", async (req, res) => {
  try {
    const existing = await db.getClientById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Client not found" });

    const updated = {
      id:           existing.id,
      name:         req.body.name         ?? existing.name,
      igUsername:   req.body.igUsername   ?? existing.igUsername,
      igAccountId:  req.body.igAccountId  ?? existing.igAccountId,
      accessToken:  req.body.accessToken  ?? existing.accessToken,
      appSecret:    req.body.appSecret    ?? existing.appSecret,
      webhookToken: req.body.webhookToken ?? existing.webhookToken,
    };
    await db.saveClient(updated);
    res.json({ ...updated, accessToken: undefined });
  } catch (err) {
    console.error("[Clients] PATCH /:id:", err.message);
    res.status(500).json({ error: "Failed to update client" });
  }
});

// DELETE client (flows stay but become unassigned / default)
router.delete("/:id", async (req, res) => {
  try {
    await db.deleteClient(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error("[Clients] DELETE /:id:", err.message);
    res.status(500).json({ error: "Failed to delete client" });
  }
});

module.exports = router;
