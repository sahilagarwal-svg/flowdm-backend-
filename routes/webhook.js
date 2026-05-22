const express     = require("express");
const router      = require("express").Router();
const crypto      = require("crypto");
const FlowEngine  = require("../services/FlowEngine");
const db          = require("../services/db");

// Dedup cache — prevents processing the same message/event twice (Meta sometimes retries)
const _seen = new Map();
setInterval(() => {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [k, t] of _seen) if (t < cutoff) _seen.delete(k);
}, 60 * 1000);

function isDuplicate(id) {
  if (!id) return false;
  if (_seen.has(id)) return true;
  _seen.set(id, Date.now());
  return false;
}

function verifyMetaSignature(req, res, next) {
  const appSecret = process.env.APP_SECRET;
  if (!appSecret) return next();
  const signature = req.headers["x-hub-signature-256"];
  if (!signature) {
    // No signature — allow through but log (echo/delivery events may omit it)
    console.warn("[Webhook] Warning — x-hub-signature-256 missing, allowing through");
    return next();
  }
  const expected = "sha256=" + crypto
    .createHmac("sha256", appSecret)
    .update(req.rawBody || "")
    .digest("hex");
  try {
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      console.warn("[Webhook] Rejected — invalid x-hub-signature-256 (tampered request)");
      return res.status(403).json({ error: "Forbidden" });
    }
  } catch {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

function verifyN8nSecret(req, res, next) {
  const expected = process.env.N8N_SHARED_SECRET;
  if (!expected) return next();
  const received = req.headers["x-n8n-secret"];
  if (received !== expected) {
    console.warn(`[Webhook] Rejected request — bad x-n8n-secret from ${req.ip}`);
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

// ─── Resolve which client owns this Instagram account ─────────────────────────
async function resolveClient(igAccountId) {
  if (!igAccountId) return null;
  try {
    return await db.getClientByAccountId(igAccountId);
  } catch {
    return null;
  }
}

router.get("/", (req, res) => {
  const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;
  const { "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge } = req.query;
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[Webhook] Meta verification challenge accepted");
    return res.status(200).send(challenge);
  }
  res.status(403).json({ error: "Webhook verification failed" });
});

router.post("/", verifyMetaSignature, verifyN8nSecret, async (req, res) => {
  res.sendStatus(200);

  const body = req.body;
  if (!body || body.object !== "instagram") return;

  for (const entry of body.entry || []) {
    // entry.id is the Instagram account that received the event
    console.log(`[Webhook] Entry ID: ${entry.id}`);
    const client = await resolveClient(entry.id);
    console.log(`[Webhook] Resolved client: ${client ? client.igUsername || client.id : 'DEFAULT'}`)

    for (const event of entry.messaging || []) {
      try {
        const senderId = event.sender?.id;
        if (!senderId) continue;

        if (event.postback) {
          if (isDuplicate(event.postback.mid || `${senderId}:${event.postback.payload}`)) continue;
          const payload = event.postback.payload || "";
          console.log(`[Webhook] Postback from ${senderId}: "${payload}"`);
          await FlowEngine.handleIncomingDM(senderId, payload, client);
        } else if (event.message && !event.message.is_echo) {
          if (isDuplicate(event.message.mid)) continue;
          const hasStoryMention = event.message.attachments?.some(a => a.type === "story_mention");
          if (hasStoryMention) {
            console.log(`[Webhook] Story mention from ${senderId}`);
            await FlowEngine.handleStoryMention(senderId, event, client);
          } else if (event.message.reply_to?.story) {
            console.log(`[Webhook] Story reply from ${senderId}`);
            await FlowEngine.handleStoryReply(senderId, event, client);
          } else {
            const text = event.message.quick_reply?.payload || event.message.text || "";
            console.log(`[Webhook] DM from ${senderId}: "${text}"`);
            await FlowEngine.handleIncomingDM(senderId, text, client);
          }
        }
      } catch (err) {
        console.error("[Webhook] Error processing messaging event:", err.message);
      }
    }

    for (const change of entry.changes || []) {
      try {
        if (change.field === "follow") {
          const followerId = change.value?.id;
          if (followerId) {
            console.log(`[Webhook] New follower: ${followerId}`);
            await FlowEngine.handleNewFollower(followerId, client);
          }
        } else if (change.field === "comments") {
          const comment = change.value;
          if (isDuplicate(comment?.id)) continue;
          console.log(`[Webhook] Comment from ${comment?.from?.id}: "${comment?.text}"`);
          await FlowEngine.handleComment(comment, client);
        }
      } catch (err) {
        console.error("[Webhook] Error processing change event:", err.message);
      }
    }
  }
});

module.exports = router;
