const InstagramAPI = require("./InstagramAPI");
const db = require("./db"); // simple JSON-file DB (swap for Postgres/Mongo in prod)

class FlowEngine {
  // ─── Handle incoming DM ─────────────────────────────────────────────
  async handleIncomingDM(senderId, text) {
    const lowerText = text.toLowerCase().trim();

    // 1. Check keyword triggers
    const flows = await db.getActiveFlows();
    for (const flow of flows) {
      if (flow.trigger.type !== "keyword") continue;
      const keywords = flow.trigger.keywords.map((k) => k.toLowerCase());
      if (keywords.some((kw) => lowerText.includes(kw))) {
        console.log(`Flow "${flow.name}" triggered by keyword`);
        await this.executeFlow(flow, senderId);
        await db.logEvent({ type: "dm_keyword", senderId, flowId: flow.id, keyword: lowerText });
        return;
      }
    }

    // 2. No keyword matched — check for default reply flow
    const defaultFlow = flows.find((f) => f.trigger.type === "any_dm" && f.active);
    if (defaultFlow) {
      await this.executeFlow(defaultFlow, senderId);
    }
  }

  // ─── Handle new follower ───────────────────────────────────────────
  async handleNewFollower(followerId) {
    const flows = await db.getActiveFlows();
    const welcomeFlow = flows.find((f) => f.trigger.type === "new_follower" && f.active);
    if (!welcomeFlow) return;

    // Delay welcome DM by 10s to feel more natural
    setTimeout(async () => {
      await this.executeFlow(welcomeFlow, followerId);
      await db.logEvent({ type: "new_follower_dm", senderId: followerId, flowId: welcomeFlow.id });
    }, 10_000);
  }

  // ─── Handle story reply ────────────────────────────────────────────
  async handleStoryReply(senderId, event) {
    const flows = await db.getActiveFlows();
    const storyFlow = flows.find((f) => f.trigger.type === "story_reply" && f.active);
    if (!storyFlow) return;
    await this.executeFlow(storyFlow, senderId);
    await db.logEvent({ type: "story_reply_dm", senderId, flowId: storyFlow.id });
  }

  // ─── Handle comment ────────────────────────────────────────────────
  async handleComment(comment) {
    const flows = await db.getActiveFlows();
    const commentText = (comment?.text || "").toLowerCase();
    const commenterId = comment?.from?.id;
    if (!commenterId) return;

    for (const flow of flows) {
      if (flow.trigger.type !== "comment_keyword") continue;
      const keywords = flow.trigger.keywords.map((k) => k.toLowerCase());
      if (keywords.some((kw) => commentText.includes(kw))) {
        await this.executeFlow(flow, commenterId);
        await db.logEvent({ type: "comment_dm", senderId: commenterId, flowId: flow.id });
        return;
      }
    }
  }

  // ─── Execute a flow (send messages in sequence) ────────────────────
  async executeFlow(flow, recipientId) {
    for (const step of flow.steps) {
      if (step.type === "send_message") {
        await InstagramAPI.sendDM(recipientId, step.message);
      }
      if (step.type === "delay") {
        await this.sleep(step.ms);
      }
    }
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = new FlowEngine();
