# FlowDM — Instagram Automation Backend

A ManyChat-style Instagram DM automation server built with Node.js + Express.

## Features

- ✅ Webhook receiver (verified & signature-checked)
- ✅ New follower → welcome DM
- ✅ Keyword triggers in DMs
- ✅ Comment keyword → auto DM
- ✅ Story reply → auto DM
- ✅ Flow builder via REST API
- ✅ Event logging + analytics

---

## Quick Start

### 1. Install dependencies
```bash
cd backend
npm install
```

### 2. Add your credentials
```bash
cp .env.example .env
# Fill in your values in .env
```

### 3. Start the server
```bash
npm run dev
```

### 4. Expose your server to the internet (for webhooks)
During development, use [ngrok](https://ngrok.com):
```bash
ngrok http 3001
# Copy the https URL — you'll paste it into Meta webhooks
```

---

## Meta Webhook Setup

1. Go to your Meta app → **Webhooks** → **Add Webhook**
2. Callback URL: `https://your-ngrok-url.ngrok.io/webhook`
3. Verify token: whatever you set in `WEBHOOK_VERIFY_TOKEN`
4. Subscribe to fields:
   - `messages`
   - `comments`
   - `follows`

---

## REST API

### Flows
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/flows` | List all flows |
| `POST` | `/api/flows` | Create a flow |
| `PATCH` | `/api/flows/:id` | Update / toggle a flow |
| `DELETE` | `/api/flows/:id` | Delete a flow |

### Example: Create a keyword flow
```json
POST /api/flows
{
  "name": "Keyword: info",
  "active": true,
  "trigger": {
    "type": "keyword",
    "keywords": ["info", "information"]
  },
  "steps": [
    {
      "type": "send_message",
      "message": "Here's all our info: https://yoursite.com/about"
    }
  ]
}
```

### Trigger types
| Type | When it fires |
|------|--------------|
| `new_follower` | Someone follows your account |
| `keyword` | Incoming DM contains a keyword |
| `comment_keyword` | Comment on your post contains keyword |
| `story_reply` | Someone replies to your story |
| `any_dm` | Any incoming DM (catch-all) |

---

## Deployment

For production, deploy to **Railway**, **Render**, or **Fly.io**:
```bash
# Railway
railway login && railway up

# Render
# Connect your GitHub repo at render.com
```

---

## Swapping the database

The `services/db.js` file uses a simple JSON file store. To use Postgres, replace the `db` object methods with your Postgres queries — the interface stays the same.

```bash
npm install pg
# Update db.js to use pg Pool
```
