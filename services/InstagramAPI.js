const fetch = require("node-fetch");

// OAuth accounts use EAA tokens → graph.facebook.com
// Manually-added accounts use IGAAN tokens → graph.instagram.com
const FB_BASE = "https://graph.facebook.com/v21.0";
const IG_BASE = "https://graph.instagram.com/v21.0";

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

async function postMessage(base, accountId, accessToken, body) {
  const res = await fetch(`${base}/${accountId}/messages`, {
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

  // OAuth accounts have pageAccessToken (EAA format) → use graph.facebook.com
  // Manually-added / Default accounts have IGAAN token → use graph.instagram.com
  _creds(client) {
    if (client?.pageAccessToken) {
      return {
        token:     client.pageAccessToken,
        accountId: client.igAccountId,
        base:      FB_BASE,
      };
    }
    return {
      token:     client?.accessToken || this.accessToken,
      accountId: client?.igAccountId || this.igAccountId,
      base:      IG_BASE,
    };
  }

  async sendDM(recipientId, text, client = null) {
    checkRateLimit();
    const { token, accountId, base } = this._creds(client);
    try {
      const data = await postMessage(base, accountId, token, {
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
    const { token, accountId, base } = this._creds(client);
    try {
      const data = await postMessage(base, accountId, token, {
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
    const { token, accountId, base } = this._creds(client);
    try {
      const data = await postMessage(base, accountId, token, {
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
    const { token, accountId, base } = this._creds(client);
    try {
      const data = await postMessage(base, accountId, token, {
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

  // ─── Carousel DM (Generic Template) ──────────────────────────────────────────
  // Sends a horizontal swipeable carousel. Each card: image, title, subtitle, buttons.
  // Instagram limits: max 10 cards, title max 80 chars, max 3 buttons per card.
  async sendCarouselDM(recipientId, cards, client = null) {
    checkRateLimit();
    const { token, accountId, base } = this._creds(client);
    try {
      const elements = cards.slice(0, 10).map(card => {
        const el = { title: String(card.title || "Card").substring(0, 80) };
        if (card.imageUrl) el.image_url = card.imageUrl;
        if (card.subtitle) el.subtitle  = String(card.subtitle).substring(0, 80);
        if (card.buttons?.length) {
          el.buttons = card.buttons.slice(0, 3).map(b => ({
            type:    "postback",
            title:   String(b.title).substring(0, 20),
            payload: b.payload || String(b.title).toLowerCase().replace(/\s+/g, "_"),
          }));
        }
        return el;
      });
      const data = await postMessage(base, accountId, token, {
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: "template",
            payload: { template_type: "generic", elements },
          },
        },
      });
      console.log(`[InstagramAPI] Carousel sent → ${recipientId} (msg_id=${data.message_id})`);
      return data;
    } catch (err) {
      console.error(`[InstagramAPI] sendCarouselDM failed → ${recipientId}: ${err.message}`);
      throw err;
    }
  }

  // ─── Get user profile ─────────────────────────────────────────────────────────
  async getUserProfile(userId, client = null) {
    const { token, base } = this._creds(client);
    try {
      const res = await fetch(
        `${base}/${userId}?fields=id,name,username,profile_pic&access_token=${token}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      console.error(`[InstagramAPI] getUserProfile failed → ${userId}: ${err.message}`);
      throw err;
    }
  }

  // ─── Reply to a comment publicly (posts in comment section, tags user) ───────
  async replyToComment(commentId, message, client = null) {
    const { token, base } = this._creds(client);
    try {
      const res = await fetch(`${base}/${commentId}/replies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
      console.log(`[InstagramAPI] Comment reply posted → comment ${commentId}`);
      return data;
    } catch (err) {
      console.error(`[InstagramAPI] replyToComment failed → ${commentId}: ${err.message}`);
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
