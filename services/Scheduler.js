const db           = require("./db");
const InstagramAPI = require("./InstagramAPI");
const MetaOAuth    = require("./MetaOAuth");

const POLL_INTERVAL    = 60  * 1000;        // check scheduled messages every 60 s
const REFRESH_INTERVAL = 24 * 60 * 60 * 1000; // refresh tokens once per day
const REFRESH_DAYS_BEFORE_EXPIRY = 7;

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

// Refresh all OAuth tokens that expire within REFRESH_DAYS_BEFORE_EXPIRY days.
// Marks the account inactive if the refresh fails so the user knows to reconnect.
async function runTokenRefresh() {
  try {
    const expiring = await db.getClientsExpiringWithin(REFRESH_DAYS_BEFORE_EXPIRY);
    if (expiring.length === 0) {
      console.log("[Scheduler] Token refresh: no tokens expiring soon");
      return;
    }

    console.log(`[Scheduler] Token refresh: refreshing ${expiring.length} token(s)`);

    for (const client of expiring) {
      if (!client.accessToken) continue; // skip manually-managed clients
      try {
        const refreshed    = await MetaOAuth.refreshLongLivedToken(client.accessToken);
        const expiresIn    = refreshed.expires_in || 5184000;
        const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

        await db.updateClientToken(client.id, {
          accessToken:    refreshed.access_token,
          tokenExpiresAt: tokenExpiresAt,
          isActive:       true,
        });
        console.log(`[Scheduler] Token refreshed for client ${client.id} (${client.igUsername})`);
      } catch (err) {
        console.error(`[Scheduler] Token refresh failed for client ${client.id}:`, err.message);
        // Mark inactive so the dashboard shows a reconnect prompt
        await db.updateClientToken(client.id, {
          accessToken:    client.accessToken,
          tokenExpiresAt: client.tokenExpiresAt,
          isActive:       false,
        });
      }
    }
  } catch (err) {
    console.error("[Scheduler] Token refresh error:", err.message);
  }
}

function start() {
  setInterval(runScheduledMessages, POLL_INTERVAL);
  console.log("[Scheduler] Started — checking every 60s for due messages");

  // Run token refresh once on startup then daily
  runTokenRefresh();
  setInterval(runTokenRefresh, REFRESH_INTERVAL);
  console.log("[Scheduler] Token refresh job started — runs daily");
}

module.exports = { start };
