const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "../data");
const FLOWS_FILE = path.join(DATA_DIR, "flows.json");
const EVENTS_FILE = path.join(DATA_DIR, "events.json");

// Ensure data dir exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Seed default flows if none exist
if (!fs.existsSync(FLOWS_FILE)) {
  const defaultFlows = [
    {
      id: "flow_welcome",
      name: "Welcome DM sequence",
      active: true,
      trigger: { type: "new_follower" },
      steps: [
        { type: "delay", ms: 10000 },
        {
          type: "send_message",
          message:
            "Hey! Thanks for following 👋 We'd love to help you out — what brings you here today?",
        },
      ],
    },
    {
      id: "flow_link_keyword",
      name: 'Keyword: "link"',
      active: true,
      trigger: { type: "keyword", keywords: ["link", "links"] },
      steps: [
        {
          type: "send_message",
          message:
            "Here's the link you asked for 👇\nhttps://yourwebsite.com/link-in-bio",
        },
      ],
    },
    {
      id: "flow_comment_price",
      name: "Comment → DM offer",
      active: true,
      trigger: { type: "comment_keyword", keywords: ["price", "how much", "cost"] },
      steps: [
        {
          type: "send_message",
          message:
            "Hey! Saw your comment 😊 Here's our pricing page: https://yourwebsite.com/pricing — feel free to reply here if you have questions!",
        },
      ],
    },
    {
      id: "flow_story_reply",
      name: "Story reply auto-DM",
      active: true,
      trigger: { type: "story_reply" },
      steps: [
        {
          type: "send_message",
          message:
            "Thanks for watching our story! Can I help you with anything? 🙌",
        },
      ],
    },
  ];
  fs.writeFileSync(FLOWS_FILE, JSON.stringify(defaultFlows, null, 2));
}

if (!fs.existsSync(EVENTS_FILE)) {
  fs.writeFileSync(EVENTS_FILE, JSON.stringify([], null, 2));
}

// ─── DB helpers ─────────────────────────────────────────────────────────

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const db = {
  getActiveFlows() {
    const flows = readJSON(FLOWS_FILE);
    return flows.filter((f) => f.active);
  },

  getAllFlows() {
    return readJSON(FLOWS_FILE);
  },

  saveFlow(flow) {
    const flows = readJSON(FLOWS_FILE);
    const idx = flows.findIndex((f) => f.id === flow.id);
    if (idx >= 0) flows[idx] = flow;
    else flows.push(flow);
    writeJSON(FLOWS_FILE, flows);
    return flow;
  },

  deleteFlow(id) {
    const flows = readJSON(FLOWS_FILE).filter((f) => f.id !== id);
    writeJSON(FLOWS_FILE, flows);
  },

  logEvent(event) {
    const events = readJSON(EVENTS_FILE);
    events.unshift({ ...event, timestamp: new Date().toISOString() });
    // Keep last 10,000 events
    writeJSON(EVENTS_FILE, events.slice(0, 10000));
  },

  getRecentEvents(limit = 50) {
    return readJSON(EVENTS_FILE).slice(0, limit);
  },

  getStats() {
    const events = readJSON(EVENTS_FILE);
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = events.filter(
      (e) => new Date(e.timestamp).getTime() > sevenDaysAgo
    );
    return {
      totalDMs: recent.filter((e) =>
        ["dm_keyword", "new_follower_dm", "story_reply_dm", "comment_dm"].includes(e.type)
      ).length,
      byType: recent.reduce((acc, e) => {
        acc[e.type] = (acc[e.type] || 0) + 1;
        return acc;
      }, {}),
    };
  },
};

module.exports = db;
