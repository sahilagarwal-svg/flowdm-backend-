require("dns").setDefaultResultOrder("ipv4first");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS flows (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      active       BOOLEAN NOT NULL DEFAULT false,
      trigger_data JSONB NOT NULL,
      steps        JSONB NOT NULL,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS events (
      id        SERIAL PRIMARY KEY,
      type      TEXT NOT NULL,
      sender_id TEXT,
      flow_id   TEXT,
      keyword   TEXT,
      timestamp TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_events_ts    ON events(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_flows_active ON flows(active);
  `);
  console.log("[DB] PostgreSQL tables ready");
}

function toFlow(row) {
  return {
    id:      row.id,
    name:    row.name,
    active:  row.active,
    trigger: row.trigger_data,
    steps:   row.steps,
  };
}

const db = {
  async getActiveFlows() {
    const { rows } = await pool.query(
      "SELECT * FROM flows WHERE active = true ORDER BY created_at ASC"
    );
    return rows.map(toFlow);
  },

  async getAllFlows() {
    const { rows } = await pool.query(
      "SELECT * FROM flows ORDER BY created_at ASC"
    );
    return rows.map(toFlow);
  },

  async saveFlow(flow) {
    const { rows } = await pool.query("SELECT id FROM flows WHERE id = $1", [flow.id]);
    if (rows.length > 0) {
      await pool.query(
        "UPDATE flows SET name = $1, active = $2, trigger_data = $3, steps = $4 WHERE id = $5",
        [flow.name, flow.active, JSON.stringify(flow.trigger), JSON.stringify(flow.steps), flow.id]
      );
    } else {
      await pool.query(
        "INSERT INTO flows (id, name, active, trigger_data, steps) VALUES ($1, $2, $3, $4, $5)",
        [flow.id, flow.name, flow.active, JSON.stringify(flow.trigger), JSON.stringify(flow.steps)]
      );
    }
    return flow;
  },

  async deleteFlow(id) {
    await pool.query("DELETE FROM flows WHERE id = $1", [id]);
  },

  async logEvent(event) {
    await pool.query(
      "INSERT INTO events (type, sender_id, flow_id, keyword, timestamp) VALUES ($1, $2, $3, $4, $5)",
      [event.type, event.senderId || null, event.flowId || null, event.keyword || null, new Date().toISOString()]
    );
  },

  async getRecentEvents(limit = 50) {
    const { rows } = await pool.query(
      "SELECT * FROM events ORDER BY timestamp DESC LIMIT $1",
      [limit]
    );
    return rows.map((row) => ({
      type:      row.type,
      senderId:  row.sender_id,
      flowId:    row.flow_id,
      keyword:   row.keyword,
      timestamp: row.timestamp,
    }));
  },

  async getStats() {
    const since   = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const dmTypes = ["dm_keyword", "new_follower_dm", "story_reply_dm", "comment_dm"];

    const { rows: [countRow] } = await pool.query(
      "SELECT COUNT(*) AS c FROM events WHERE timestamp > $1 AND type = ANY($2)",
      [since, dmTypes]
    );

    const { rows: byTypeRows } = await pool.query(
      "SELECT type, COUNT(*) AS count FROM events WHERE timestamp > $1 GROUP BY type",
      [since]
    );

    const byType = byTypeRows.reduce((acc, row) => {
      acc[row.type] = Number(row.count);
      return acc;
    }, {});

    return { totalDMs: Number(countRow.c), byType };
  },

  init,
};

module.exports = db;
