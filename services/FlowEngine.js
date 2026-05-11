const InstagramAPI  = require("./InstagramAPI");
const MessageQueue  = require("./MessageQueue");
const db            = require("./db");
const { appendLead, extractPhoneNumber } = require("./googleSheets");

// Cached delay settings — refresh every 60 seconds
let _delayCache = null;
let _delayCacheAt = 0;

async function naturalDelay() {
  const now = Date.now();
  if (!_delayCache || now - _delayCacheAt > 60000) {
    const minVal = await db.getSetting("reply_delay_min");
    const maxVal = await db.getSetting("reply_delay_max");
    _delayCache = {
      min: minVal ? parseInt(minVal) : 1000,
      max: maxVal ? parseInt(maxVal) : 2500,
    };
    _delayCacheAt = now;
  }
  const ms = Math.floor(Math.random() * (_delayCache.max - _delayCache.min + 1)) + _delayCache.min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes

const STOP_WORDS = new Set([
  "is","the","for","a","an","what","how","i","to","do","can","you","me","my",
  "we","our","am","are","was","were","be","been","have","has","had","will",
  "would","could","should","may","might","does","did","of","in","on","at",
  "by","with","about","as","it","its","that","this","and","or","but","if",
  "so","just","get","all","please","tell","more","want","need","give","us",
])

class FlowEngine {
  constructor() {
    this._cooldowns = new Map();
    // Clean up expired entries every 5 minutes to prevent memory leak
    setInterval(() => {
      const now = Date.now();
      for (const [key, ts] of this._cooldowns) {
        if (now - ts > COOLDOWN_MS) this._cooldowns.delete(key);
      }
    }, 5 * 60 * 1000);
  }

  _isOnCooldown(senderId, flowId) {
    const key = `${senderId}:${flowId}`;
    const last = this._cooldowns.get(key);
    return last && (Date.now() - last) < COOLDOWN_MS;
  }

  _setCooldown(senderId, flowId) {
    this._cooldowns.set(`${senderId}:${flowId}`, Date.now());
  }

  // ─── Handle incoming DM ────────────────────────────────────────────────────
  async handleIncomingDM(senderId, text, client = null) {
    try {
      const clientId  = client?.id || null;
      const lowerText = (text || "").toLowerCase().trim();
      const flows     = await db.getActiveFlows(clientId);

      // Phone number lead capture — runs independently of flows
      const phone = extractPhoneNumber(text);
      if (phone) {
        const sheetUrl = client?.leadSheetUrl ||
          (client === null ? await db.getSetting("default_lead_sheet_url") : null);
        if (sheetUrl) {
          this._captureLeadToSheet(senderId, text, phone, client, sheetUrl).catch(err =>
            console.error("[FlowEngine] Lead capture error:", err.message)
          );
        }
      }

      // Score all keyword flows — pick the best match instead of first match
      let bestFlow  = null;
      let bestScore = 0;
      for (const flow of flows) {
        if (flow.trigger.type !== "keyword") continue;
        const score = this._scoreFlow(flow, lowerText);
        if (score > bestScore) { bestScore = score; bestFlow = flow; }
      }

      if (bestFlow) {
        if (this._isOnCooldown(senderId, bestFlow.id)) {
          console.log(`[FlowEngine] Cooldown active for ${senderId} on flow "${bestFlow.name}" — skipping`);
          return;
        }
        console.log(`[FlowEngine] "${bestFlow.name}" matched (score=${bestScore}) for "${lowerText}" from ${senderId}`);
        this._setCooldown(senderId, bestFlow.id);
        await this.executeFlow(bestFlow, senderId, client);
        await db.logEvent({ type: "dm_keyword", senderId, flowId: bestFlow.id, keyword: lowerText, clientId });
        return;
      }

      const defaultFlow = flows.find((f) => f.trigger.type === "any_dm");
      if (defaultFlow) {
        if (this._isOnCooldown(senderId, defaultFlow.id)) {
          console.log(`[FlowEngine] Cooldown active for ${senderId} on flow "${defaultFlow.name}" — skipping`);
          return;
        }
        this._setCooldown(senderId, defaultFlow.id);
        await this.executeFlow(defaultFlow, senderId, client);
        await db.logEvent({ type: "dm_keyword", senderId, flowId: defaultFlow.id, clientId });
      }
    } catch (err) {
      console.error(`[FlowEngine] handleIncomingDM error (sender=${senderId}):`, err.message);
    }
  }

  // ─── Capture phone lead to Google Sheet ───────────────────────────────────
  async _captureLeadToSheet(senderId, text, phone, client, sheetUrl) {
    const profile = await this._fetchProfile(senderId, client).catch(() => null);
    await appendLead(sheetUrl, {
      phoneRaw:         phone.raw,
      phoneNormalized:  phone.normalized,
      name:             profile?.name     || "",
      username:         profile?.username || "",
      igUserId:         senderId,
      messageText:      text,
      source:           "Instagram DM",
    });
    await db.logEvent({ type: "lead_captured", senderId, clientId: client?.id || null });
  }

  // ─── Handle new follower ───────────────────────────────────────────────────
  async handleNewFollower(followerId, client = null) {
    try {
      const clientId = client?.id || null;
      const flows    = await db.getActiveFlows(clientId);
      const flow     = flows.find((f) => f.trigger.type === "new_follower");
      if (!flow) return;

      setTimeout(async () => {
        try {
          if (this._isOnCooldown(followerId, flow.id)) {
            console.log(`[FlowEngine] Cooldown active for ${followerId} on new_follower flow — skipping`);
            return;
          }
          this._setCooldown(followerId, flow.id);
          await this.executeFlow(flow, followerId, client);
          await db.logEvent({ type: "new_follower_dm", senderId: followerId, flowId: flow.id, clientId });
        } catch (err) {
          console.error(`[FlowEngine] new_follower flow error (follower=${followerId}):`, err.message);
        }
      }, 10_000);
    } catch (err) {
      console.error(`[FlowEngine] handleNewFollower error (follower=${followerId}):`, err.message);
    }
  }

  // ─── Handle story reply ────────────────────────────────────────────────────
  async handleStoryReply(senderId, event, client = null) {
    try {
      const clientId = client?.id || null;
      const flows    = await db.getActiveFlows(clientId);
      const flow     = flows.find((f) => f.trigger.type === "story_reply");
      if (!flow) return;
      if (this._isOnCooldown(senderId, flow.id)) {
        console.log(`[FlowEngine] Cooldown active for ${senderId} on story_reply flow — skipping`);
        return;
      }
      this._setCooldown(senderId, flow.id);
      await this.executeFlow(flow, senderId, client);
      await db.logEvent({ type: "story_reply_dm", senderId, flowId: flow.id, clientId });
    } catch (err) {
      console.error(`[FlowEngine] handleStoryReply error (sender=${senderId}):`, err.message);
    }
  }

  // ─── Handle comment ────────────────────────────────────────────────────────
  async handleComment(comment, client = null) {
    try {
      const clientId    = client?.id || null;
      const commentText = (comment?.text || "").toLowerCase();
      const commenterId = comment?.from?.id;
      if (!commenterId) return;

      const flows = await db.getActiveFlows(clientId);
      let bestFlow  = null;
      let bestScore = 0;
      for (const flow of flows) {
        if (flow.trigger.type !== "comment_keyword") continue;
        const score = this._scoreFlow(flow, commentText);
        if (score > bestScore) { bestScore = score; bestFlow = flow; }
      }
      if (bestFlow) {
        if (this._isOnCooldown(commenterId, bestFlow.id)) {
          console.log(`[FlowEngine] Cooldown active for ${commenterId} on comment flow — skipping`);
          return;
        }
        this._setCooldown(commenterId, bestFlow.id);
        await this.executeFlow(bestFlow, commenterId, client);
        await db.logEvent({ type: "comment_dm", senderId: commenterId, flowId: bestFlow.id, clientId });
      }
    } catch (err) {
      console.error(`[FlowEngine] handleComment error:`, err.message);
    }
  }

  // ─── Execute a flow step by step ──────────────────────────────────────────
  async executeFlow(flow, recipientId, client = null) {
    const profile = await this._fetchProfile(recipientId, client);

    for (const step of flow.steps) {
      try {
        if (step.type === "send_message") {
          const message = this._applyVars(step.message, profile);
          await this._sendWithFallback(recipientId, { type: "text", message }, client);
          await naturalDelay();
        } else if (step.type === "send_image") {
          await this._sendWithFallback(recipientId, { type: "image", imageUrl: step.imageUrl }, client);
          await naturalDelay();
        } else if (step.type === "send_video") {
          await this._sendWithFallback(recipientId, { type: "video", videoUrl: step.videoUrl }, client);
          await naturalDelay();
        } else if (step.type === "send_buttons") {
          const text = this._applyVars(step.text, profile);
          await this._sendWithFallback(recipientId, { type: "buttons", text, buttons: step.buttons }, client);
          await naturalDelay();
        } else if (step.type === "send_carousel") {
          await this._sendWithFallback(recipientId, { type: "carousel", cards: step.cards }, client);
          await naturalDelay();
        } else if (step.type === "send_image_burst") {
          // Fire all images simultaneously — no delay between them
          await Promise.all(
            (step.imageUrls || []).map(url =>
              this._sendWithFallback(recipientId, { type: "image", imageUrl: url }, client)
            )
          );
          await naturalDelay();
        } else if (step.type === "delay") {
          await this._sleep(step.ms);
        }
      } catch (err) {
        console.error(`[FlowEngine] Step "${step.type}" failed for ${recipientId}:`, err.message);
      }
    }
  }

  async _sendWithFallback(recipientId, task, client = null) {
    try {
      if (task.type === "image") {
        await InstagramAPI.sendImageDM(recipientId, task.imageUrl, client);
      } else if (task.type === "video") {
        await InstagramAPI.sendVideoDM(recipientId, task.videoUrl, client);
      } else if (task.type === "buttons") {
        await InstagramAPI.sendButtonsDM(recipientId, task.text, task.buttons, client);
      } else if (task.type === "carousel") {
        await InstagramAPI.sendCarouselDM(recipientId, task.cards, client);
      } else {
        await InstagramAPI.sendDM(recipientId, task.message, client);
      }
    } catch (err) {
      console.warn(`[FlowEngine] Direct send failed, enqueuing for retry — ${err.message}`);
      MessageQueue.enqueue({ ...task, recipientId, client });
    }
  }

  async _fetchProfile(recipientId, client = null) {
    try {
      return await InstagramAPI.getUserProfile(recipientId, client);
    } catch {
      return null;
    }
  }

  // ─── Score a flow against an incoming message ─────────────────────────────
  // Phase 1: each keyword found as a substring scores its length (longer = more specific)
  // Phase 2: each meaningful word from the message that appears in any keyword scores +1
  _scoreFlow(flow, lowerText) {
    const keywords = (flow.trigger.keywords || []).map(k => k.toLowerCase().trim()).filter(Boolean);
    let score = 0;

    for (const kw of keywords) {
      if (lowerText.includes(kw)) {
        score += kw.length;
      }
    }

    const messageWords = lowerText
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter(w => w.length > 1 && !STOP_WORDS.has(w));

    for (const word of messageWords) {
      if (keywords.some(kw => kw.includes(word))) {
        score += 1;
      }
    }

    return score;
  }

  _applyVars(text, profile) {
    if (!text) return text || "";
    if (!profile) return text;
    const firstName = (profile.name || "").split(" ")[0] || "";
    return text
      .replace(/\{\{first_name\}\}/g, firstName)
      .replace(/\{\{name\}\}/g,       profile.name || "");
  }

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = new FlowEngine();
