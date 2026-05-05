const InstagramAPI  = require("./InstagramAPI");
const MessageQueue  = require("./MessageQueue");
const db            = require("./db");
const { appendLead, extractPhoneNumber } = require("./googleSheets");

// Per-user lock — ensures only one flow runs per user at a time
const userLocks = new Map();
function withUserLock(userId, fn) {
  const prev = userLocks.get(userId) || Promise.resolve();
  const next = prev
    .then(() => fn())
    .finally(() => { if (userLocks.get(userId) === next) userLocks.delete(userId); });
  userLocks.set(userId, next);
  return next;
}

function naturalDelay(minMs = 500, maxMs = 1200) {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Check if any step in the flow uses name variables — only then fetch profile
function flowUsesProfile(steps) {
  return steps.some(s =>
    (s.message && /\{\{(first_name|name)\}\}/.test(s.message)) ||
    (s.text    && /\{\{(first_name|name)\}\}/.test(s.text))
  );
}

class FlowEngine {
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

      for (const flow of flows) {
        if (flow.trigger.type !== "keyword") continue;
        const keywords = (flow.trigger.keywords || []).map((k) => k.toLowerCase());
        if (keywords.some((kw) => lowerText.includes(kw))) {
          console.log(`[FlowEngine] "${flow.name}" triggered by keyword "${lowerText}" from ${senderId}`);
          withUserLock(senderId, () => this.executeFlow(flow, senderId, client));
          await db.logEvent({ type: "dm_keyword", senderId, flowId: flow.id, keyword: lowerText, clientId });
          return;
        }
      }

      const defaultFlow = flows.find((f) => f.trigger.type === "any_dm");
      if (defaultFlow) {
        withUserLock(senderId, () => this.executeFlow(defaultFlow, senderId, client));
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

      setTimeout(() => {
        withUserLock(followerId, () => this.executeFlow(flow, followerId, client))
          .then(() => db.logEvent({ type: "new_follower_dm", senderId: followerId, flowId: flow.id, clientId }))
          .catch(err => console.error(`[FlowEngine] new_follower flow error (follower=${followerId}):`, err.message));
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
      withUserLock(senderId, () => this.executeFlow(flow, senderId, client));
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
      for (const flow of flows) {
        if (flow.trigger.type !== "comment_keyword") continue;
        const keywords = (flow.trigger.keywords || []).map((k) => k.toLowerCase());
        if (keywords.some((kw) => commentText.includes(kw))) {
          withUserLock(commenterId, () => this.executeFlow(flow, commenterId, client));
          await db.logEvent({ type: "comment_dm", senderId: commenterId, flowId: flow.id, clientId });
          return;
        }
      }
    } catch (err) {
      console.error(`[FlowEngine] handleComment error:`, err.message);
    }
  }

  // ─── Execute a flow step by step ──────────────────────────────────────────
  async executeFlow(flow, recipientId, client = null) {
    // Only fetch profile if the flow actually uses name variables (saves ~300ms)
    const profile = flowUsesProfile(flow.steps)
      ? await this._fetchProfile(recipientId, client)
      : null;

    for (let i = 0; i < flow.steps.length; i++) {
      const step = flow.steps[i];
      try {
        if (step.type === "send_message") {
          const message = this._applyVars(step.message, profile);
          await this._sendWithFallback(recipientId, { type: "text", message }, client);
        } else if (step.type === "send_image") {
          await this._sendWithFallback(recipientId, { type: "image", imageUrl: step.imageUrl }, client);
        } else if (step.type === "send_video") {
          await this._sendWithFallback(recipientId, { type: "video", videoUrl: step.videoUrl }, client);
        } else if (step.type === "send_buttons") {
          const text = this._applyVars(step.text, profile);
          await this._sendWithFallback(recipientId, { type: "buttons", text, buttons: step.buttons }, client);
        } else if (step.type === "send_carousel") {
          await this._sendWithFallback(recipientId, { type: "carousel", cards: step.cards }, client);
        } else if (step.type === "delay") {
          await this._sleep(step.ms);
          continue; // skip naturalDelay after an explicit delay step
        }
        // Add a small gap between steps (skip after last step)
        if (i < flow.steps.length - 1) await naturalDelay(500, 1200);
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
