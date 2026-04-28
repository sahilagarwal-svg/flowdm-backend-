const express   = require("express");
const cors      = require("cors");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();
app.set("trust proxy", 1); // required for express-rate-limit behind Render's proxy
app.use(cors({
  origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(",") : "*",
}));
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

const path            = require("path");
const db              = require("./services/db");
const requireAuth     = require("./middleware/auth");
const authRouter      = require("./routes/auth");
const webhookRouter   = require("./routes/webhook");
const flowRouter      = require("./routes/flows");
const analyticsRouter = require("./routes/analytics");
const uploadRouter    = require("./routes/upload");

app.use("/api/auth",       authRouter);
app.use("/webhook",        webhookLimiter, webhookRouter);
app.use("/api/flows",      requireAuth, flowRouter);
app.use("/api/analytics",  requireAuth, analyticsRouter);
app.use("/api/upload",     requireAuth, uploadRouter);
app.use("/uploads",        express.static(path.join(__dirname, "uploads")));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3001;
db.init()
  .then(() => app.listen(PORT, () => console.log(`FlowDM backend running on port ${PORT}`)))
  .catch((err) => { console.error("DB init failed:", err.message); process.exit(1); });
