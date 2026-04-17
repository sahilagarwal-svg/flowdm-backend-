const express     = require("express");
const router      = express.Router();
const FlowEngine  = require("../services/FlowEngine");

// ─── N8N shared-secret guard ──────────────────────────────────────────────────
// Add header  x-n8n-secret: <N8N_SHARED_SECRET>  to your n8n HTTP Request node.
function verifyN8nSecret(req, res, next) {
  const expected = process.env.N8N_SHARED_SECRET;
  if (!expected) return next(); // skip check if env var not set

  const received = req.headers["x-n8n-secret"];
  if (received !== expected) {
    console.warn(`[Webhook] Rejected request — bad x-n8n-secret from ${req.ip}`);
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

// ─── GET: Meta webhook verification challenge ─────────────────────────────────
router.get("/", (req, res) => {
  const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;
  const { "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge } = req.query;

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[Webhook] Meta verification challenge accepted");
    return res.status(200).send(challenge);
  }
  res.status(403).json({ error: "Webhook verification failed" });
});

// ─── POST: receive forwarded Instagram events from n8n ────────────────────────
router.post("/", verifyN8nSecret, async (req, res) => {
  res.sendStatus(200); // acknowledge immediately so n8n doesn't time out

  const body = req.body;
  if (!body || body.object !== "instagram") return;

  for (const entry of body.entry || []) {
    // Direct messages & story replies
    for (const event of entry.messaging || []) {
      try {
        const senderId = event.sender?.id;
        if (!senderId) continue;

        if (event.message && !event.message.is_echo) {
          if (event.message.reply_to?.story) {
            console.log(`[Webhook] Story reply from ${senderId}`);
            await FlowEngine.handleStoryReply(senderId, event);
          } else {
            const text = event.message.text || "";
            console.log(`[Webhook] DM from ${senderId}: "${text}"`);
            await FlowEngine.handleIncomingDM(senderId, text);
          }
        }
      } catch (err) {
        console.error("[Webhook] Error processing messaging event:", err.message);
      }
    }

    // Follows & comments
    for (const change of entry.changes || []) {
      try {
        if (change.field === "follow") {
          const followerId = change.value?.id;
          if (followerId) {
            console.log(`[Webhook] New follower: ${followerId}`);
            await FlowEngine.handleNewFollower(followerId);
          }
        } else if (change.field === "comments") {
          const comment = change.value;
          console.log(`[Webhook] Comment from ${comment?.from?.id}: "${comment?.text}"`);
          await FlowEngine.handleComment(comment);
        }
      } catch (err) {
        console.error("[Webhook] Error processing change event:", err.message);
      }
    }
  }
});

module.exports = router;
