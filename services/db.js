// Uses Node.js built-in sqlite (node:sqlite), available since Node 22.5+.
// No native compilation needed — works out of the box on Node 24.
const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs   = require("fs");

const DATA_DIR = path.join(__dirname, "../data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const sqlite = new DatabaseSync(path.join(DATA_DIR, "flowdm.db"));

sqlite.exec("PRAGMA journal_mode = WAL");

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS flows (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    active       INTEGER NOT NULL DEFAULT 0,
    trigger_data TEXT NOT NULL,
    steps        TEXT NOT NULL,
    created_at   TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS events (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    type      TEXT NOT NULL,
    sender_id TEXT,
    flow_id   TEXT,
    keyword   TEXT,
    timestamp TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_events_ts    ON events(timestamp DESC);
  CREATE INDEX IF NOT EXISTS idx_flows_active ON flows(active);
`);

// ─── Seed default flows on first run ─────────────────────────────────────────
const { c: flowCount } = sqlite.prepare("SELECT COUNT(*) as c FROM flows").get();
if (flowCount === 0) {
  const ins = sqlite.prepare(
    "INSERT INTO flows (id, name, active, trigger_data, steps) VALUES (?, ?, ?, ?, ?)"
  );
  const defaults = [
    {
      id: "flow_welcome",
      name: "Welcome DM sequence",
      active: 1,
      trigger: JSON.stringify({ type: "new_follower" }),
      steps: JSON.stringify([
        { type: "delay", ms: 10000 },
        { type: "send_message", message: "Hey! Thanks for following 👋 We'd love to help you out — what brings you here today?" },
      ]),
    },
    {
      id: "flow_link_keyword",
      name: 'Keyword: "link"',
      active: 1,
      trigger: JSON.stringify({ type: "keyword", keywords: ["link", "links"] }),
      steps: JSON.stringify([
        { type: "send_message", message: "Here's the link you asked for 👇\nhttps://yourwebsite.com/link-in-bio" },
      ]),
    },
    {
      id: "flow_comment_price",
      name: "Comment → DM offer",
      active: 1,
      trigger: JSON.stringify({ type: "comment_keyword", keywords: ["price", "how much", "cost"] }),
      steps: JSON.stringify([
        { type: "send_message", message: "Hey! Saw your comment 😊 Here's our pricing page: https://yourwebsite.com/pricing" },
      ]),
    },
    {
      id: "flow_story_reply",
      name: "Story reply auto-DM",
      active: 1,
      trigger: JSON.stringify({ type: "story_reply" }),
      steps: JSON.stringify([
        { type: "send_message", message: "Thanks for watching our story! Can I help you with anything? 🙌" },
      ]),
    },
  ];
  for (const r of defaults) ins.run(r.id, r.name, r.active, r.trigger, r.steps);
}

// ─── Row → plain JS object ────────────────────────────────────────────────────
function toFlow(row) {
  return {
    id:      row.id,
    name:    row.name,
    active:  row.active === 1,
    trigger: JSON.parse(row.trigger_data),
    steps:   JSON.parse(row.steps),
  };
}

// ─── Prepared statements (created once, reused) ───────────────────────────────
const stmts = {
  getActive:    sqlite.prepare("SELECT * FROM flows WHERE active = 1"),
  getAll:       sqlite.prepare("SELECT * FROM flows ORDER BY created_at ASC"),
  getById:      sqlite.prepare("SELECT * FROM flows WHERE id = ?"),
  insertFlow:   sqlite.prepare("INSERT INTO flows (id, name, active, trigger_data, steps) VALUES (?, ?, ?, ?, ?)"),
  updateFlow:   sqlite.prepare("UPDATE flows SET name = ?, active = ?, trigger_data = ?, steps = ? WHERE id = ?"),
  deleteFlow:   sqlite.prepare("DELETE FROM flows WHERE id = ?"),
  logEvent:     sqlite.prepare("INSERT INTO events (type, sender_id, flow_id, keyword, timestamp) VALUES (?, ?, ?, ?, ?)"),
  recentEvents: sqlite.prepare("SELECT * FROM events ORDER BY timestamp DESC LIMIT ?"),
};

// ─── Public interface — same shape as the old JSON version ────────────────────
const db = {
  getActiveFlows() {
    return stmts.getActive.all().map(toFlow);
  },

  getAllFlows() {
    return stmts.getAll.all().map(toFlow);
  },

  saveFlow(flow) {
    const exists     = stmts.getById.get(flow.id);
    const triggerStr = JSON.stringify(flow.trigger);
    const stepsStr   = JSON.stringify(flow.steps);
    const activeInt  = flow.active ? 1 : 0;

    if (exists) {
      stmts.updateFlow.run(flow.name, activeInt, triggerStr, stepsStr, flow.id);
    } else {
      stmts.insertFlow.run(flow.id, flow.name, activeInt, triggerStr, stepsStr);
    }
    return flow;
  },

  deleteFlow(id) {
    stmts.deleteFlow.run(id);
  },

  logEvent(event) {
    stmts.logEvent.run(
      event.type,
      event.senderId || null,
      event.flowId   || null,
      event.keyword  || null,
      new Date().toISOString()
    );
  },

  getRecentEvents(limit = 50) {
    return stmts.recentEvents.all(limit).map((row) => ({
      type:      row.type,
      senderId:  row.sender_id,
      flowId:    row.flow_id,
      keyword:   row.keyword,
      timestamp: row.timestamp,
    }));
  },

  getStats() {
    const since   = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const dmTypes = ["dm_keyword", "new_follower_dm", "story_reply_dm", "comment_dm"];
    const holders = dmTypes.map(() => "?").join(", ");

    const { c: totalDMs } = sqlite
      .prepare(`SELECT COUNT(*) as c FROM events WHERE timestamp > ? AND type IN (${holders})`)
      .get(since, ...dmTypes);

    const byTypeRows = sqlite
      .prepare("SELECT type, COUNT(*) as count FROM events WHERE timestamp > ? GROUP BY type")
      .all(since);

    const byType = byTypeRows.reduce((acc, row) => {
      acc[row.type] = row.count;
      return acc;
    }, {});

    return { totalDMs, byType };
  },
};

module.exports = db;
