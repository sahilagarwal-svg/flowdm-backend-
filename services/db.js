require("dns").setDefaultResultOrder("ipv4first");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      ig_username   TEXT,
      ig_account_id TEXT,
      access_token  TEXT,
      app_secret    TEXT,
      webhook_token TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS flows (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      active       BOOLEAN NOT NULL DEFAULT false,
      trigger_data JSONB NOT NULL,
      steps        JSONB NOT NULL,
      client_id    TEXT,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS events (
      id        SERIAL PRIMARY KEY,
      type      TEXT NOT NULL,
      sender_id TEXT,
      flow_id   TEXT,
      keyword   TEXT,
      client_id TEXT,
      timestamp TIMESTAMPTZ NOT NULL
    );

    ALTER TABLE flows  ADD COLUMN IF NOT EXISTS client_id TEXT;
    ALTER TABLE events ADD COLUMN IF NOT EXISTS client_id TEXT;

    CREATE INDEX IF NOT EXISTS idx_events_ts      ON events(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_flows_active   ON flows(active);
    CREATE INDEX IF NOT EXISTS idx_flows_client   ON flows(client_id);
    CREATE INDEX IF NOT EXISTS idx_events_client  ON events(client_id);
  `);
  console.log("[DB] PostgreSQL tables ready");
}

function toFlow(row) {
  return {
    id:       row.id,
    name:     row.name,
    active:   row.active,
    trigger:  row.trigger_data,
    steps:    row.steps,
    clientId: row.client_id || null,
  };
}

function toClient(row, withToken = false) {
  return {
    id:            row.id,
    name:          row.name,
    igUsername:    row.ig_username,
    igAccountId:   row.ig_account_id,
    appSecret:     withToken ? row.app_secret   : undefined,
    webhookToken:  withToken ? row.webhook_token : undefined,
    accessToken:   withToken ? row.access_token  : undefined,
    createdAt:     row.created_at,
  };
}

const db = {
  // ─── Clients ────────────────────────────────────────────────────────────────
  async getClients() {
    const { rows } = await pool.query("SELECT * FROM clients ORDER BY created_at ASC");
    return rows.map(r => toClient(r, false));
  },

  async getClientById(id) {
    const { rows } = await pool.query("SELECT * FROM clients WHERE id = $1", [id]);
    return rows.length ? toClient(rows[0], true) : null;
  },

  async getClientByAccountId(igAccountId) {
    const { rows } = await pool.query("SELECT * FROM clients WHERE ig_account_id = $1", [igAccountId]);
    return rows.length ? toClient(rows[0], true) : null;
  },

  async saveClient(client) {
    const { rows } = await pool.query("SELECT id FROM clients WHERE id = $1", [client.id]);
    if (rows.length > 0) {
      await pool.query(
        `UPDATE clients SET name=$1, ig_username=$2, ig_account_id=$3,
         access_token=$4, app_secret=$5, webhook_token=$6 WHERE id=$7`,
        [client.name, client.igUsername, client.igAccountId,
         client.accessToken, client.appSecret, client.webhookToken, client.id]
      );
    } else {
      await pool.query(
        `INSERT INTO clients (id, name, ig_username, ig_account_id, access_token, app_secret, webhook_token)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [client.id, client.name, client.igUsername, client.igAccountId,
         client.accessToken, client.appSecret, client.webhookToken]
      );
    }
    return client;
  },

  async deleteClient(id) {
    await pool.query("UPDATE flows SET client_id = NULL WHERE client_id = $1", [id]);
    await pool.query("DELETE FROM clients WHERE id = $1", [id]);
  },

  // ─── Flows ──────────────────────────────────────────────────────────────────
  async getActiveFlows(clientId = null) {
    const { rows } = clientId
      ? await pool.query(
          "SELECT * FROM flows WHERE active=true AND client_id=$1 ORDER BY created_at ASC",
          [clientId]
        )
      : await pool.query(
          "SELECT * FROM flows WHERE active=true AND client_id IS NULL ORDER BY created_at ASC"
        );
    return rows.map(toFlow);
  },

  async getAllFlows(clientId = null) {
    const { rows } = clientId
      ? await pool.query(
          "SELECT * FROM flows WHERE client_id=$1 ORDER BY created_at ASC",
          [clientId]
        )
      : await pool.query(
          "SELECT * FROM flows WHERE client_id IS NULL ORDER BY created_at ASC"
        );
    return rows.map(toFlow);
  },

  async saveFlow(flow) {
    const clientId = flow.clientId || null;
    const { rows } = await pool.query("SELECT id FROM flows WHERE id=$1", [flow.id]);
    if (rows.length > 0) {
      await pool.query(
        "UPDATE flows SET name=$1, active=$2, trigger_data=$3, steps=$4, client_id=$5 WHERE id=$6",
        [flow.name, flow.active, JSON.stringify(flow.trigger), JSON.stringify(flow.steps), clientId, flow.id]
      );
    } else {
      await pool.query(
        "INSERT INTO flows (id, name, active, trigger_data, steps, client_id) VALUES ($1,$2,$3,$4,$5,$6)",
        [flow.id, flow.name, flow.active, JSON.stringify(flow.trigger), JSON.stringify(flow.steps), clientId]
      );
    }
    return flow;
  },

  async deleteFlow(id) {
    await pool.query("DELETE FROM flows WHERE id=$1", [id]);
  },

  // ─── Events ─────────────────────────────────────────────────────────────────
  async logEvent(event) {
    await pool.query(
      "INSERT INTO events (type, sender_id, flow_id, keyword, client_id, timestamp) VALUES ($1,$2,$3,$4,$5,$6)",
      [event.type, event.senderId || null, event.flowId || null,
       event.keyword || null, event.clientId || null, new Date().toISOString()]
    );
  },

  async getRecentEvents(limit = 50, clientId = null) {
    const safeLimit = Math.min(parseInt(limit) || 50, 500);
    const { rows } = clientId
      ? await pool.query(
          "SELECT * FROM events WHERE client_id=$1 ORDER BY timestamp DESC LIMIT $2",
          [clientId, safeLimit]
        )
      : await pool.query(
          "SELECT * FROM events WHERE client_id IS NULL ORDER BY timestamp DESC LIMIT $1",
          [safeLimit]
        );
    return rows.map((row) => ({
      type:      row.type,
      senderId:  row.sender_id,
      flowId:    row.flow_id,
      keyword:   row.keyword,
      timestamp: row.timestamp,
    }));
  },

  async getKeywordStats(clientId = null) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { rows } = clientId
      ? await pool.query(
          "SELECT keyword, COUNT(*) AS count FROM events WHERE keyword IS NOT NULL AND timestamp > $1 AND client_id = $2 GROUP BY keyword ORDER BY count DESC LIMIT 20",
          [since, clientId])
      : await pool.query(
          "SELECT keyword, COUNT(*) AS count FROM events WHERE keyword IS NOT NULL AND timestamp > $1 AND client_id IS NULL GROUP BY keyword ORDER BY count DESC LIMIT 20",
          [since]);
    return rows.map(r => ({ keyword: r.keyword, count: Number(r.count) }));
  },

  async getDailyStats(clientId = null) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const dmTypes = ["dm_keyword", "new_follower_dm", "story_reply_dm", "comment_dm"];
    const { rows } = clientId
      ? await pool.query(
          "SELECT DATE(timestamp) AS day, COUNT(*) AS count FROM events WHERE timestamp > $1 AND type = ANY($2) AND client_id = $3 GROUP BY DATE(timestamp) ORDER BY day ASC",
          [since, dmTypes, clientId])
      : await pool.query(
          "SELECT DATE(timestamp) AS day, COUNT(*) AS count FROM events WHERE timestamp > $1 AND type = ANY($2) AND client_id IS NULL GROUP BY DATE(timestamp) ORDER BY day ASC",
          [since, dmTypes]);
    return rows.map(r => ({
      day: new Date(r.day).toLocaleDateString('en', { weekday: 'short' }),
      dms: Number(r.count),
    }));
  },

  async getStats(clientId = null) {
    const since   = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const dmTypes = ["dm_keyword", "new_follower_dm", "story_reply_dm", "comment_dm"];

    const [countRes, byTypeRes] = clientId
      ? await Promise.all([
          pool.query(
            "SELECT COUNT(*) AS c FROM events WHERE timestamp>$1 AND type=ANY($2) AND client_id=$3",
            [since, dmTypes, clientId]
          ),
          pool.query(
            "SELECT type, COUNT(*) AS count FROM events WHERE timestamp>$1 AND client_id=$2 GROUP BY type",
            [since, clientId]
          ),
        ])
      : await Promise.all([
          pool.query(
            "SELECT COUNT(*) AS c FROM events WHERE timestamp>$1 AND type=ANY($2) AND client_id IS NULL",
            [since, dmTypes]
          ),
          pool.query(
            "SELECT type, COUNT(*) AS count FROM events WHERE timestamp>$1 AND client_id IS NULL GROUP BY type",
            [since]
          ),
        ]);

    const byType = byTypeRes.rows.reduce((acc, row) => {
      acc[row.type] = Number(row.count);
      return acc;
    }, {});

    return { totalDMs: Number(countRes.rows[0].c), byType };
  },

  init,
};

module.exports = db;
