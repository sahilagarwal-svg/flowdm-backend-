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
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      ig_username    TEXT,
      ig_account_id  TEXT,
      access_token   TEXT,
      app_secret     TEXT,
      webhook_token  TEXT,
      lead_sheet_url TEXT,
      created_at     TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS lead_sheet_url        TEXT;
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS page_id               TEXT;
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS page_access_token     TEXT;
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS token_expires_at      TIMESTAMPTZ;
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_active             BOOLEAN DEFAULT true;
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS profile_picture_url   TEXT;
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS display_name          TEXT;
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS oauth_user_id         TEXT;
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS user_id               TEXT;

    CREATE TABLE IF NOT EXISTS oauth_states (
      state      TEXT PRIMARY KEY,
      user_id    TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS data_deletions (
      id            TEXT PRIMARY KEY,
      oauth_user_id TEXT NOT NULL,
      status        TEXT DEFAULT 'pending',
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      completed_at  TIMESTAMPTZ
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

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_events_ts      ON events(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_flows_active   ON flows(active);
    CREATE INDEX IF NOT EXISTS idx_flows_client   ON flows(client_id);
    CREATE INDEX IF NOT EXISTS idx_events_client  ON events(client_id);

    CREATE TABLE IF NOT EXISTS contacts (
      ig_user_id        TEXT NOT NULL,
      client_id         TEXT NOT NULL DEFAULT '',
      name              TEXT,
      username          TEXT,
      first_seen_at     TIMESTAMPTZ DEFAULT NOW(),
      last_seen_at      TIMESTAMPTZ DEFAULT NOW(),
      interaction_count INT DEFAULT 1,
      opted_out         BOOLEAN DEFAULT false,
      PRIMARY KEY (ig_user_id, client_id)
    );
    CREATE INDEX IF NOT EXISTS idx_contacts_client ON contacts(client_id);

    CREATE TABLE IF NOT EXISTS broadcasts (
      id         TEXT PRIMARY KEY,
      client_id  TEXT NOT NULL DEFAULT '',
      name       TEXT NOT NULL,
      message    TEXT NOT NULL,
      status     TEXT DEFAULT 'draft',
      total      INT DEFAULT 0,
      sent       INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      sent_at    TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS scheduled_messages (
      id            SERIAL PRIMARY KEY,
      recipient_id  TEXT NOT NULL,
      client_id     TEXT NOT NULL DEFAULT '',
      msg_type      TEXT NOT NULL,
      payload       JSONB NOT NULL,
      scheduled_for TIMESTAMPTZ NOT NULL,
      sent          BOOLEAN DEFAULT false,
      flow_id       TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sched_due ON scheduled_messages(scheduled_for) WHERE sent=false;
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
    id:                row.id,
    name:              row.name,
    igUsername:        row.ig_username,
    igAccountId:       row.ig_account_id,
    displayName:       row.display_name       || null,
    profilePictureUrl: row.profile_picture_url || null,
    pageId:            row.page_id             || null,
    tokenExpiresAt:    row.token_expires_at    || null,
    isActive:          row.is_active !== false,
    userId:            row.user_id             || null,
    leadSheetUrl:      row.lead_sheet_url      || null,
    createdAt:         row.created_at,
    appSecret:         withToken ? row.app_secret         : undefined,
    webhookToken:      withToken ? row.webhook_token      : undefined,
    accessToken:       withToken ? row.access_token       : undefined,
    pageAccessToken:   withToken ? row.page_access_token  : undefined,
    oauthUserId:       withToken ? row.oauth_user_id      : undefined,
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
         access_token=$4, app_secret=$5, webhook_token=$6, lead_sheet_url=$7 WHERE id=$8`,
        [client.name, client.igUsername, client.igAccountId,
         client.accessToken, client.appSecret, client.webhookToken,
         client.leadSheetUrl || null, client.id]
      );
    } else {
      await pool.query(
        `INSERT INTO clients (id, name, ig_username, ig_account_id, access_token, app_secret, webhook_token, lead_sheet_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [client.id, client.name, client.igUsername, client.igAccountId,
         client.accessToken, client.appSecret, client.webhookToken,
         client.leadSheetUrl || null]
      );
    }
    return client;
  },

  async deleteClient(id) {
    await pool.query("UPDATE flows SET client_id = NULL WHERE client_id = $1", [id]);
    await pool.query("DELETE FROM clients WHERE id = $1", [id]);
  },

  // Upsert an OAuth-connected client — updates if same ig_account_id already exists
  async saveOAuthClient(client) {
    const { rows } = await pool.query(
      "SELECT id FROM clients WHERE ig_account_id=$1", [client.igAccountId]
    );
    if (rows.length > 0) {
      await pool.query(
        `UPDATE clients SET name=$1, ig_username=$2, display_name=$3, profile_picture_url=$4,
         access_token=$5, page_id=$6, page_access_token=$7, token_expires_at=$8,
         oauth_user_id=$9, is_active=true, user_id=$10 WHERE ig_account_id=$11`,
        [client.name, client.igUsername, client.displayName, client.profilePictureUrl,
         client.accessToken, client.pageId, client.pageAccessToken, client.tokenExpiresAt,
         client.oauthUserId, client.userId, client.igAccountId]
      );
      return rows[0].id;
    }
    await pool.query(
      `INSERT INTO clients
         (id, name, ig_username, display_name, profile_picture_url, ig_account_id,
          access_token, page_id, page_access_token, token_expires_at, oauth_user_id, is_active, user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,$12)`,
      [client.id, client.name, client.igUsername, client.displayName, client.profilePictureUrl,
       client.igAccountId, client.accessToken, client.pageId, client.pageAccessToken,
       client.tokenExpiresAt, client.oauthUserId, client.userId]
    );
    return client.id;
  },

  // Returns all clients belonging to a specific user (for self-service portal)
  async getClientsByUserId(userId) {
    const { rows } = await pool.query(
      "SELECT * FROM clients WHERE user_id=$1 ORDER BY created_at ASC", [userId]
    );
    return rows.map(r => toClient(r, false));
  },

  // Returns clients with tokens expiring within N days (for refresh job)
  async getClientsExpiringWithin(days) {
    const { rows } = await pool.query(
      `SELECT * FROM clients
       WHERE token_expires_at IS NOT NULL
         AND token_expires_at < NOW() + make_interval(days => $1::int)
         AND is_active = true`,
      [days]
    );
    return rows.map(r => toClient(r, true));
  },

  // Update just the token fields after a refresh
  async updateClientToken(id, { accessToken, tokenExpiresAt, isActive }) {
    await pool.query(
      "UPDATE clients SET access_token=$1, token_expires_at=$2, is_active=$3 WHERE id=$4",
      [accessToken, tokenExpiresAt, isActive !== false, id]
    );
  },

  // ─── OAuth States (CSRF protection) ─────────────────────────────────────────
  async createOAuthState(state, userId = null) {
    await pool.query(
      "INSERT INTO oauth_states (state, user_id) VALUES ($1,$2)", [state, userId]
    );
  },

  // Deletes and returns the state record — returns null if not found or expired (>10 min)
  async consumeOAuthState(state) {
    const { rows } = await pool.query(
      `DELETE FROM oauth_states
       WHERE state=$1 AND created_at > NOW() - INTERVAL '10 minutes'
       RETURNING *`,
      [state]
    );
    return rows.length ? rows[0] : null;
  },

  // ─── Users ───────────────────────────────────────────────────────────────────
  async createUser(user) {
    await pool.query(
      "INSERT INTO users (id, email, password_hash) VALUES ($1,$2,$3)",
      [user.id, user.email.toLowerCase(), user.passwordHash]
    );
  },

  async getUserByEmail(email) {
    const { rows } = await pool.query(
      "SELECT * FROM users WHERE email=$1", [email.toLowerCase()]
    );
    return rows.length ? rows[0] : null;
  },

  async getUserById(id) {
    const { rows } = await pool.query("SELECT * FROM users WHERE id=$1", [id]);
    return rows.length ? rows[0] : null;
  },

  // ─── Data Deletions (Meta compliance) ───────────────────────────────────────
  async deleteUserData(oauthUserId) {
    const { rows } = await pool.query(
      "SELECT id, user_id FROM clients WHERE oauth_user_id=$1", [oauthUserId]
    );
    const userIds = [...new Set(rows.map(r => r.user_id).filter(Boolean))];
    for (const row of rows) {
      const cid = row.id;
      await pool.query("DELETE FROM contacts          WHERE client_id=$1", [cid]);
      await pool.query("DELETE FROM events            WHERE client_id=$1", [cid]);
      await pool.query("DELETE FROM broadcasts        WHERE client_id=$1", [cid]);
      await pool.query("DELETE FROM scheduled_messages WHERE client_id=$1", [cid]);
      await pool.query("DELETE FROM flows             WHERE client_id=$1", [cid]);
      await pool.query("DELETE FROM clients           WHERE id=$1",        [cid]);
    }
    for (const uid of userIds) {
      await pool.query("DELETE FROM users WHERE id=$1", [uid]);
    }
  },

  async createDataDeletion(record) {
    await pool.query(
      "INSERT INTO data_deletions (id, oauth_user_id) VALUES ($1,$2)",
      [record.id, record.oauthUserId]
    );
  },

  async completeDataDeletion(id) {
    await pool.query(
      "UPDATE data_deletions SET status='deleted', completed_at=NOW() WHERE id=$1", [id]
    );
  },

  async getDataDeletion(id) {
    const { rows } = await pool.query(
      "SELECT * FROM data_deletions WHERE id=$1", [id]
    );
    return rows.length ? rows[0] : null;
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

  // ─── Contacts ───────────────────────────────────────────────────────────────
  async upsertContact(igUserId, clientId, { name, username } = {}) {
    const cid = clientId || '';
    await pool.query(`
      INSERT INTO contacts (ig_user_id, client_id, name, username, first_seen_at, last_seen_at, interaction_count)
      VALUES ($1, $2, $3, $4, NOW(), NOW(), 1)
      ON CONFLICT (ig_user_id, client_id) DO UPDATE SET
        name              = COALESCE(EXCLUDED.name, contacts.name),
        username          = COALESCE(EXCLUDED.username, contacts.username),
        last_seen_at      = NOW(),
        interaction_count = contacts.interaction_count + 1
    `, [igUserId, cid, name || null, username || null]);
  },

  async getContacts(clientId = null, limit = 200, offset = 0) {
    const cid = clientId || '';
    const { rows } = await pool.query(
      'SELECT * FROM contacts WHERE client_id=$1 ORDER BY last_seen_at DESC LIMIT $2 OFFSET $3',
      [cid, limit, offset]
    );
    return rows.map(r => ({
      igUserId: r.ig_user_id, clientId: r.client_id || null,
      name: r.name, username: r.username,
      firstSeenAt: r.first_seen_at, lastSeenAt: r.last_seen_at,
      interactionCount: r.interaction_count, optedOut: r.opted_out,
    }));
  },

  async isContactOptedOut(igUserId, clientId = null) {
    const cid = clientId || '';
    const { rows } = await pool.query(
      'SELECT opted_out FROM contacts WHERE ig_user_id=$1 AND client_id=$2',
      [igUserId, cid]
    );
    return rows.length ? rows[0].opted_out : false;
  },

  async setContactOptOut(igUserId, clientId, optedOut) {
    const cid = clientId || '';
    await pool.query(
      `INSERT INTO contacts (ig_user_id, client_id, opted_out) VALUES ($1, $2, $3)
       ON CONFLICT (ig_user_id, client_id) DO UPDATE SET opted_out = EXCLUDED.opted_out`,
      [igUserId, cid, optedOut]
    );
  },

  async getActiveContactIds(clientId = null) {
    const cid = clientId || '';
    const { rows } = await pool.query(
      'SELECT ig_user_id FROM contacts WHERE client_id=$1 AND opted_out=false ORDER BY last_seen_at DESC',
      [cid]
    );
    return rows.map(r => r.ig_user_id);
  },

  // ─── Broadcasts ──────────────────────────────────────────────────────────────
  async saveBroadcast(b) {
    const cid = b.clientId || '';
    await pool.query(
      'INSERT INTO broadcasts (id, client_id, name, message, status, total, sent) VALUES ($1,$2,$3,$4,$5,$6,0)',
      [b.id, cid, b.name, b.message, b.status || 'sending', b.total || 0]
    );
  },

  async updateBroadcast(id, { status, sent, total, sentAt }) {
    await pool.query(
      'UPDATE broadcasts SET status=$1, sent=$2, total=$3, sent_at=$4 WHERE id=$5',
      [status, sent, total, sentAt || null, id]
    );
  },

  async getBroadcasts(clientId = null) {
    const cid = clientId || '';
    const { rows } = await pool.query(
      'SELECT * FROM broadcasts WHERE client_id=$1 ORDER BY created_at DESC',
      [cid]
    );
    return rows.map(r => ({
      id: r.id, name: r.name, message: r.message, status: r.status,
      total: r.total, sent: r.sent, createdAt: r.created_at, sentAt: r.sent_at,
    }));
  },

  // ─── Scheduled Messages (drip/sequences) ────────────────────────────────────
  async scheduleMessage({ recipientId, clientId, msgType, payload, scheduledFor, flowId }) {
    const cid = clientId || '';
    await pool.query(
      'INSERT INTO scheduled_messages (recipient_id, client_id, msg_type, payload, scheduled_for, flow_id) VALUES ($1,$2,$3,$4,$5,$6)',
      [recipientId, cid, msgType, JSON.stringify(payload), scheduledFor, flowId || null]
    );
  },

  async getDueScheduledMessages() {
    const { rows } = await pool.query(
      'SELECT * FROM scheduled_messages WHERE sent=false AND scheduled_for <= NOW() ORDER BY scheduled_for ASC LIMIT 50'
    );
    return rows.map(r => ({
      id: r.id, recipientId: r.recipient_id, clientId: r.client_id || null,
      msgType: r.msg_type, payload: r.payload, scheduledFor: r.scheduled_for, flowId: r.flow_id,
    }));
  },

  async markScheduledMessageSent(id) {
    await pool.query('UPDATE scheduled_messages SET sent=true WHERE id=$1', [id]);
  },

  // ─── Settings ────────────────────────────────────────────────────────────────
  async getSetting(key) {
    const { rows } = await pool.query("SELECT value FROM settings WHERE key = $1", [key]);
    return rows.length ? rows[0].value : null;
  },

  async setSetting(key, value) {
    await pool.query(
      "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
      [key, value]
    );
  },

  init,
};

module.exports = db;
