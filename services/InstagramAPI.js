const fetch = require("node-fetch");

const BASE = "https://graph.instagram.com/v19.0";

class InstagramAPI {
  constructor() {
    this.accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    this.igAccountId = process.env.INSTAGRAM_ACCOUNT_ID;
  }

  // ─── Send a DM ──────────────────────────────────────────────────────
  async sendDM(recipientId, text) {
    const url = `${BASE}/${this.igAccountId}/messages`;
    const body = {
      recipient: { id: recipientId },
      message: { text },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("Instagram API error:", data);
      throw new Error(data.error?.message || "Failed to send DM");
    }

    console.log(`DM sent to ${recipientId}:`, data.message_id);
    return data;
  }

  // ─── Get user profile ───────────────────────────────────────────────
  async getUserProfile(userId) {
    const url = `${BASE}/${userId}?fields=name,username&access_token=${this.accessToken}`;
    const res = await fetch(url);
    return res.json();
  }

  // ─── Get media list ─────────────────────────────────────────────────
  async getMedia(limit = 10) {
    const url = `${BASE}/${this.igAccountId}/media?fields=id,caption,media_type,timestamp&limit=${limit}&access_token=${this.accessToken}`;
    const res = await fetch(url);
    return res.json();
  }
}

module.exports = new InstagramAPI();
