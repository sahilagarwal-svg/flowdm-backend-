const InstagramAPI = require("./InstagramAPI");
const MessageQueue = require("./MessageQueue");
const db           = require("./db");

function naturalDelay(minMs = 2000, maxMs = 5000) {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class FlowEngine {
  // ─── Handle incoming DM ────────────────────────────────────────────────────
  async handleIncomingDM(senderId, text, client = null) {
    try {
      const clientId  = client?.id || null;
      const lowerText = (text || "").toLowerCase().trim();
      const flows     = await db.getActiveFlows(clientId);

      for (const flow of flows) {
        if (flow.trigger.type !== "keyword") continue;
        const keywords = (flow.trigger.keywords || []).map((k) => k.toLowerCase());
        if (keywords.some((kw) => lowerText.includes(kw))) {
          console.log(`[FlowEngine] "${flow.name}" triggered by keyword "${lowerText}" from ${senderId}`);
          await this.executeFlow(flow, senderId, client);
          await db.logEvent({ type: "dm_keyword", senderId, flowId: flow.id, keyword: lowerText, clientId });
          return;
        }
      }

      const defaultFlow = flows.find((f) => f.trigger.type === "any_dm");
      if (defaultFlow) {
        await this.executeFlow(defaultFlow, senderId, client);
        await db.logEvent({ type: "dm_keyword", senderId, flowId: defaultFlow.id, clientId });
      }
    } catch (err) {
      console.error(`[FlowEngine] handleIncomingDM error (sender=${senderId}):`, err.message);
    }
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
      for (const flow of flows) {
        if (flow.trigger.type !== "comment_keyword") continue;
        const keywords = (flow.trigger.keywords || []).map((k) => k.toLowerCase());
        if (keywords.some((kw) => commentText.includes(kw))) {
          await this.executeFlow(flow, commenterId, client);
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
    const profile = await this._fetchProfile(recipientId, client);

    for (const step of flow.steps) {
      try {
        if (step.type === "send_message") {
          const message = this._applyVars(step.message, profile);
          await this._sendWithFallback(recipientId, { type: "text", message }, client);
          await naturalDelay(2000, 5000);
        } else if (step.type === "send_image") {
          await this._sendWithFallback(recipientId, { type: "image", imageUrl: step.imageUrl }, client);
          await naturalDelay(2000, 5000);
        } else if (step.type === "send_video") {
          await this._sendWithFallback(recipientId, { type: "video", videoUrl: step.videoUrl }, client);
          await naturalDelay(2000, 5000);
        } else if (step.type === "send_buttons") {
          const text = this._applyVars(step.text, profile);
          await this._sendWithFallback(recipientId, { type: "buttons", text, buttons: step.buttons }, client);
          await naturalDelay(2000, 5000);
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
