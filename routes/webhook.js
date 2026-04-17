const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const FlowEngine = require("../services/FlowEngine");

// ─── Verify webhook from Meta ──────────────────────────────────────────
router.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log("Webhook verified by Meta");
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// ─── Receive Instagram events ──────────────────────────────────────────
router.post("/", (req, res) => {
  // Verify signature from Meta
  const sig = req.headers["x-hub-signature-256"];
  const expected =
    "sha256=" +
    crypto
      .createHmac("sha256", process.env.APP_SECRET)
      .update(JSON.stringify(req.body))
      .digest("hex");

  if (sig !== expected) {
    console.warn("Invalid signature — ignoring event");
    return res.sendStatus(403);
  }

  res.sendStatus(200); // Respond immediately to Meta

  // Process events asynchronously
  const body = req.body;
  if (body.object !== "instagram") return;

  body.entry?.forEach((entry) => {
    entry.messaging?.forEach((event) => {
      handleMessagingEvent(event);
    });
    entry.changes?.forEach((change) => {
      handleChangeEvent(change);
    });
  });
});

// ─── Event dispatcher ──────────────────────────────────────────────────
async function handleMessagingEvent(event) {
  const senderId = event.sender?.id;
  if (!senderId) return;

  // Incoming DM
  if (event.message && !event.message.is_echo) {
    const text = event.message.text || "";
    console.log(`DM from ${senderId}: "${text}"`);
    await FlowEngine.handleIncomingDM(senderId, text);
  }

  // Story reply (user replied to your story)
  if (event.message?.reply_to?.story) {
    console.log(`Story reply from ${senderId}`);
    await FlowEngine.handleStoryReply(senderId, event);
  }
}

async function handleChangeEvent(change) {
  // New follower
  if (change.field === "follow") {
    const followerId = change.value?.id;
    if (followerId) {
      console.log(`New follower: ${followerId}`);
      await FlowEngine.handleNewFollower(followerId);
    }
  }

  // Comment on post
  if (change.field === "comments") {
    const comment = change.value;
    console.log(`New comment from ${comment?.from?.id}: "${comment?.text}"`);
    await FlowEngine.handleComment(comment);
  }
}

module.exports = router;
