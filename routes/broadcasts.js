const router       = require("express").Router();
const { v4: uuid } = require("uuid");
const db           = require("../services/db");
const InstagramAPI = require("../services/InstagramAPI");

// GET /api/broadcasts
router.get("/", async (req, res) => {
  try {
    const clientId = req.headers["x-client-id"] || null;
    const list = await db.getBroadcasts(clientId);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/broadcasts  { name, message }
router.post("/", async (req, res) => {
  const clientId = req.headers["x-client-id"] || null;
  const { name, message } = req.body;
  if (!name || !message) return res.status(400).json({ error: "name and message are required" });

  const id = uuid();
  try {
    const recipientIds = await db.getActiveContactIds(clientId);
    if (recipientIds.length === 0) {
      return res.status(400).json({ error: "No active contacts to send to" });
    }

    await db.saveBroadcast({ id, clientId, name, message, status: "sending", total: recipientIds.length });
    res.json({ id, total: recipientIds.length, status: "sending" });

    // Send in background — 2 messages/sec to stay under rate limits
    const client = clientId ? await db.getClientById(clientId) : null;
    let sent = 0;
    for (const recipientId of recipientIds) {
      try {
        await InstagramAPI.sendDM(recipientId, message, client);
        sent++;
      } catch (err) {
        console.warn(`[Broadcast] Failed to send to ${recipientId}: ${err.message}`);
      }
      await new Promise(r => setTimeout(r, 500)); // 2 msg/s
    }

    const status = sent === recipientIds.length ? "completed" : sent > 0 ? "partial" : "failed";
    await db.updateBroadcast(id, { status, sent, total: recipientIds.length, sentAt: new Date() });
    console.log(`[Broadcast] "${name}" done — ${sent}/${recipientIds.length} sent`);
  } catch (err) {
    console.error("[Broadcast] Error:", err.message);
    await db.updateBroadcast(id, { status: "failed", sent: 0, total: 0, sentAt: new Date() }).catch(() => {});
  }
});

module.exports = router;
