const express   = require("express");
const cors      = require("cors");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();
app.set("trust proxy", 1); // required for express-rate-limit behind Render's proxy
app.use(cors());
app.use(express.json());

// Webhook endpoint: allow up to 300 inbound events per 15 minutes.
// This protects the server from being flooded while still handling
// legitimate bursts from Meta/n8n.
const webhookLimiter = rateLimit({
  windowMs:       15 * 60 * 1000,
  max:            300,
  standardHeaders: true,
  legacyHeaders:  false,
  message:        { error: "Too many requests — slow down" },
});

const webhookRouter   = require("./routes/webhook");
const flowRouter      = require("./routes/flows");
const analyticsRouter = require("./routes/analytics");

app.use("/webhook",        webhookLimiter, webhookRouter);
app.use("/api/flows",      flowRouter);
app.use("/api/analytics",  analyticsRouter);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`FlowDM backend running on port ${PORT}`));
