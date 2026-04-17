const fetch = require("node-fetch");

const BASE = "https://graph.facebook.com/v21.0";

// ─── Sliding-window rate limiter: max 200 outgoing messages per hour ──────────
const HOURLY_LIMIT = 200;
const WINDOW_MS    = 60 * 60 * 1000;
const sentLog      = []; // timestamps of recent sends

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
  if (!res.ok) {
    throw new Error(data?.error?.message || `HTTP ${res.status}`);
  }
  return data;
}

class InstagramAPI {
  constructor() {
    this.accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    this.igAccountId = process.env.INSTAGRAM_ACCOUNT_ID;
  }

  // ─── Send a text DM ─────────────────────────────────────────────────────────
  async sendDM(recipientId, text) {
    checkRateLimit();
    try {
      const data = await postMessage(this.igAccountId, this.accessToken, {
        recipient: { id: recipientId },
        message:   { text },
      });
      console.log(`[InstagramAPI] Text DM sent → ${recipientId} (msg_id=${data.message_id})`);
      return data;
    } catch (err) {
      console.error(`[InstagramAPI] sendDM failed → ${recipientId}: ${err.message}`);
      throw err;
    }
  }

  // ─── Send an image DM ────────────────────────────────────────────────────────
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

  // ─── Get user profile ────────────────────────────────────────────────────────
  async getUserProfile(userId) {
    try {
      const res = await fetch(
        `${BASE}/${userId}?fields=name,username&access_token=${this.accessToken}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      console.error(`[InstagramAPI] getUserProfile failed → ${userId}: ${err.message}`);
      throw err;
    }
  }

  // ─── Get media list ──────────────────────────────────────────────────────────
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
