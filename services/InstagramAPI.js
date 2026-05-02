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

  // resolve credentials — use client overrides if provided, else fall back to env
  _creds(client) {
    return {
      token:     client?.accessToken  || this.accessToken,
      accountId: client?.igAccountId  || this.igAccountId,
    };
  }

  async sendDM(recipientId, text, client = null) {
    checkRateLimit();
    const { token, accountId } = this._creds(client);
    try {
      const data = await postMessage(accountId, token, {
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

  async sendImageDM(recipientId, imageUrl, client = null) {
    checkRateLimit();
    const { token, accountId } = this._creds(client);
    try {
      const data = await postMessage(accountId, token, {
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

  async sendVideoDM(recipientId, videoUrl, client = null) {
    checkRateLimit();
    const { token, accountId } = this._creds(client);
    try {
      const data = await postMessage(accountId, token, {
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

  async sendButtonsDM(recipientId, text, buttons, client = null) {
    checkRateLimit();
    const { token, accountId } = this._creds(client);
    try {
      const data = await postMessage(accountId, token, {
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

  async getUserProfile(userId, client = null) {
    const { token } = this._creds(client);
    try {
      const res = await fetch(
        `${BASE}/${userId}?fields=id,name,username,profile_pic&access_token=${token}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      console.error(`[InstagramAPI] getUserProfile failed → ${userId}: ${err.message}`);
      throw err;
    }
  }

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
