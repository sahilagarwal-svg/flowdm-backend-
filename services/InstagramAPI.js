const fetch = require("node-fetch");

const BASE = "https://graph.instagram.com/v25.0";

// ─── Sliding-window rate limiter: max 200 outgoing messages per hour ──────────
const HOURLY_LIMIT = 200;
const WINDOW_MS    = 60 * 60 * 1000;
const sentLog      = [];

function checkRateLimit() {
  const now = Date.now();
  while (sentLog.length && sentLog[0] < now - WINDOW_MS) sentLog.shift();
  if (sentLog.length >= HOURLY_LIMIT) {
    throw new Error(`[InstagramAPI] Hourly rate limit reached (${HOURLY_LIMIT} msgs/hr)`);
  }
  sentLog.push(now);
}

// ─── Shared POST helper ────────────────────────────────────────────────────────
async function postMessage(accountId, accessToken, body) {
  const res = await fetch(`${BASE}/${accountId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  return data;
}

class InstagramAPI {
  constructor() {
    this.accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    this.igAccountId = process.env.INSTAGRAM_ACCOUNT_ID;
  }

  // ─── Text DM ─────────────────────────────────────────────────────────────────
  async sendDM(recipientId, text) {
    checkRateLimit();
    try {
      const data = await postMessage(this.igAccountId, this.accessToken, {
        recipient: { id: recipientId },
        message: { text },
      });
      console.log(`[InstagramAPI] Text DM sent → ${recipientId} (msg_id=${data.message_id})`);
      return data;
    } catch (err) {
      console.error(`[InstagramAPI] sendDM failed → ${recipientId}: ${err.message}`);
      throw err;
    }
  }

  // ─── Image DM ─────────────────────────────────────────────────────────────────
  async sendImageDM(recipientId, imageUrl) {
    checkRateLimit();
    try {
      const data = await postMessage(this.igAccountId, this.accessToken, {
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: "image",
            payload: { url: imageUrl, is_reusable: true },
          },
        },
      });
      console.log(`[InstagramAPI] Image DM sent → ${recipientId} (msg_id=${data.message_id})`);
      return data;
    } catch (err) {
      console.error(`[InstagramAPI] sendImageDM failed → ${recipientId}: ${err.message}`);
      throw err;
    }
  }

  // ─── Video DM ─────────────────────────────────────────────────────────────────
  async sendVideoDM(recipientId, videoUrl) {
    checkRateLimit();
    try {
      const data = await postMessage(this.igAccountId, this.accessToken, {
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: "video",
            payload: { url: videoUrl, is_reusable: true },
          },
        },
      });
      console.log(`[InstagramAPI] Video DM sent → ${recipientId} (msg_id=${data.message_id})`);
      return data;
    } catch (err) {
      console.error(`[InstagramAPI] sendVideoDM failed → ${recipientId}: ${err.message}`);
      throw err;
    }
  }

  // ─── Buttons DM (Button Template) ────────────────────────────────────────────
  // Uses button template so buttons appear INSIDE the message bubble (like ManyChat).
  // Instagram limits: max 3 buttons, title max 20 chars each.
  // When user taps a button, webhook receives postback.payload — matched as keyword.
  async sendButtonsDM(recipientId, text, buttons) {
    checkRateLimit();
    try {
      const data = await postMessage(this.igAccountId, this.accessToken, {
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "button",
              text: String(text).substring(0, 640),
              buttons: buttons.slice(0, 3).map(b => ({
                type: "postback",
                title: String(b.title).substring(0, 20),
                payload: b.payload || String(b.title).toLowerCase().replace(/\s+/g, "_"),
              })),
            },
          },
        },
      });
      console.log(`[InstagramAPI] Button template sent → ${recipientId} (msg_id=${data.message_id})`);
      return data;
    } catch (err) {
      console.error(`[InstagramAPI] sendButtonsDM failed → ${recipientId}: ${err.message}`);
      throw err;
    }
  }

  // ─── Get user profile ─────────────────────────────────────────────────────────
  async getUserProfile(userId) {
    try {
      const res = await fetch(
        `${BASE}/${userId}?fields=id,name&access_token=${this.accessToken}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      console.error(`[InstagramAPI] getUserProfile failed → ${userId}: ${err.message}`);
      throw err;
    }
  }

  // ─── Get media list ───────────────────────────────────────────────────────────
  async getMedia(limit = 10) {
    try {
      const res = await fetch(
        `${BASE}/${this.igAccountId}/media?fields=id,caption,media_type,timestamp&limit=${limit}&access_token=${this.accessToken}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      console.error(`[InstagramAPI] getMedia failed: ${err.message}`);
      throw err;
    }
  }
}

module.exports = new InstagramAPI();
