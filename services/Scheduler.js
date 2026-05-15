const db           = require("./db");
const InstagramAPI = require("./InstagramAPI");

const POLL_INTERVAL = 60 * 1000; // check every minute

async function runScheduledMessages() {
  try {
    const due = await db.getDueScheduledMessages();
    if (due.length === 0) return;

    console.log(`[Scheduler] Processing ${due.length} due message(s)`);

    for (const msg of due) {
      try {
        const client = msg.clientId ? await db.getClientById(msg.clientId) : null;

        if (msg.msgType === "text") {
          await InstagramAPI.sendDM(msg.recipientId, msg.payload.message, client);
        } else if (msg.msgType === "image") {
          await InstagramAPI.sendImageDM(msg.recipientId, msg.payload.imageUrl, client);
        } else if (msg.msgType === "video") {
          await InstagramAPI.sendVideoDM(msg.recipientId, msg.payload.videoUrl, client);
        } else if (msg.msgType === "buttons") {
          await InstagramAPI.sendButtonsDM(msg.recipientId, msg.payload.text, msg.payload.buttons, client);
        }

        await db.markScheduledMessageSent(msg.id);
        console.log(`[Scheduler] Sent scheduled ${msg.msgType} to ${msg.recipientId}`);
      } catch (err) {
        console.error(`[Scheduler] Failed to send message id=${msg.id} to ${msg.recipientId}:`, err.message);
      }
    }
  } catch (err) {
    console.error("[Scheduler] Poll error:", err.message);
  }
}

function start() {
  setInterval(runScheduledMessages, POLL_INTERVAL);
  console.log("[Scheduler] Started — checking every 60s for due messages");
}

module.exports = { start };
